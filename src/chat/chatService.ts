import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { api } from '../api/client'
import type { Product, RestChat, RestMessage } from '../api/types'
import { productImages, productTitle } from '../lib/format'
import { firestore } from '../lib/firebase'
import { getChatTransport, whenChatTransportReady } from './transport'

export type OfferData = {
  price: number
  isConfirmed: boolean
  offerNumber: number
  quotedBy: string
}

export type UiMessage = {
  id: string
  senderId: string
  receiverId?: string
  text: string
  createdAt: number
  messageType: string
  priceData?: OfferData
  productData?: Record<string, string>
  imageUrl?: string
}

export type UiChat = {
  id: string
  productId: string
  sellerId: string
  buyerId: string
  sellerName: string
  buyerName: string
  productTitle: string
  productImage: string
  productPrice: string
  lastMessage: string
  updatedAt: number
  dealStatus: string
  finalPrice?: number
  orderId?: string
  hasMessages: boolean
}

function timestampToMillis(value: unknown) {
  if (!value) return Date.now()
  if (typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? Date.now() : parsed
  }
  return Date.now()
}

function mapFirestoreChat(id: string, data: Record<string, unknown>): UiChat {
  return {
    id: String(data.chatId || id),
    productId: String(data.productId || ''),
    sellerId: String(data.sellerId || ''),
    buyerId: String(data.buyerId || ''),
    sellerName: String(data.sellerName || 'Seller'),
    buyerName: String(data.buyerName || 'Buyer'),
    productTitle: String(data.productTitle || 'Listing'),
    productImage: String(data.productImage || ''),
    productPrice: String(data.productPrice || ''),
    lastMessage: String(data.lastMessage || ''),
    updatedAt: timestampToMillis(data.lastMessageTime || data.createdAt),
    dealStatus: String(data.dealStatus || 'active'),
    finalPrice: typeof data.finalPrice === 'number' ? data.finalPrice : undefined,
    orderId: data.orderId ? String(data.orderId) : undefined,
    hasMessages: data.hasMessages !== false,
  }
}

function parseRestText(text: string): Pick<UiMessage, 'text' | 'messageType' | 'priceData'> {
  if (text.startsWith('{"kind"')) {
    try {
      const parsed = JSON.parse(text) as { kind: string; text?: string; price?: number; offerNumber?: number; quotedBy?: string; isConfirmed?: boolean }
      if (parsed.kind === 'price_quote') {
        return {
          text: parsed.text || `Offer ₹${parsed.price}`,
          messageType: 'price_quote',
          priceData: {
            price: Number(parsed.price || 0),
            offerNumber: Number(parsed.offerNumber || 1),
            quotedBy: parsed.quotedBy || '',
            isConfirmed: Boolean(parsed.isConfirmed),
          },
        }
      }
    } catch {
      /* plain text */
    }
  }
  return { text, messageType: 'text' }
}

// productPrice is display text ("₹2000") in chats written by the mobile app.
export function chatPrice(chat: UiChat) {
  const parsed = Number(chat.productPrice.replace(/[^\d.]/g, ''))
  return chat.productPrice && !Number.isNaN(parsed) ? parsed : chat.finalPrice
}

export function mapRestChat(chat: RestChat): UiChat {
  const messages = chat.messages || []
  const last = messages[messages.length - 1]
  return {
    id: chat.id,
    productId: chat.product?.id || '',
    sellerId: chat.sellerId,
    buyerId: chat.buyerId,
    sellerName: chat.seller?.fullName || 'Seller',
    buyerName: chat.buyer?.fullName || 'Buyer',
    productTitle: chat.product ? productTitle(chat.product) : 'Listing',
    productImage: chat.product ? productImages(chat.product)[0] || '' : '',
    productPrice: chat.product?.price != null ? String(chat.product.price) : '',
    lastMessage: last?.message || 'New chat',
    updatedAt: timestampToMillis(chat.updatedAt || last?.timestamp),
    dealStatus: 'active',
    hasMessages: messages.length > 0,
  }
}

export function mapRestMessage(message: RestMessage, index: number): UiMessage {
  const parsed = parseRestText(message.message || '')
  return {
    id: `${message.senderId}-${message.timestamp || index}`,
    senderId: message.senderId,
    text: parsed.text,
    createdAt: timestampToMillis(message.timestamp),
    messageType: parsed.messageType,
    priceData: parsed.priceData,
    imageUrl: message.files?.[0]?.fileUrl,
  }
}

// Subscribe once the chat transport is known; returns an unsubscribe usable immediately.
function afterTransport(start: () => Unsubscribe): Unsubscribe {
  let stopped = false
  let stop: Unsubscribe | null = null
  void whenChatTransportReady().then(() => {
    if (!stopped) stop = start()
  })
  return () => {
    stopped = true
    stop?.()
  }
}

export function watchInbox(userId: string, onChange: (chats: UiChat[]) => void): Unsubscribe {
  return afterTransport(() => startInbox(userId, onChange))
}

function startInbox(userId: string, onChange: (chats: UiChat[]) => void): Unsubscribe {
  if (getChatTransport() !== 'firestore') {
    void loadRestInbox(userId).then(onChange)
    const timer = window.setInterval(() => {
      void loadRestInbox(userId).then(onChange)
    }, 5000)
    return () => window.clearInterval(timer)
  }

  // Same query as the mobile app. Firestore rules only allow chat queries
  // scoped by participants, so buyerId/sellerId filters are rejected.
  let fallback: (() => void) | null = null
  const stop = onSnapshot(
    query(
      collection(firestore, 'chats'),
      where('participants', 'array-contains', userId),
      where('isArchived', '==', false),
      where('hasMessages', '==', true),
    ),
    (snapshot) => {
      const chats = snapshot.docs.map((item) => mapFirestoreChat(item.id, item.data()))
      onChange(chats.sort((a, b) => b.updatedAt - a.updatedAt))
    },
    (error) => {
      console.error('[chat] inbox listener failed, using REST', error)
      void loadRestInbox(userId).then(onChange)
      const timer = window.setInterval(() => void loadRestInbox(userId).then(onChange), 5000)
      fallback = () => window.clearInterval(timer)
    },
  )
  return () => {
    stop()
    fallback?.()
  }
}

async function loadRestInbox(userId: string) {
  const [buying, selling] = await Promise.all([
    api<{ chats: RestChat[] }>('/chats/get-chats-by-buyer', { query: { buyerId: userId } }).catch(() => ({ chats: [] })),
    api<{ chats: RestChat[] }>('/chats/get-chats-by-seller', { query: { sellerId: userId } }).catch(() => ({ chats: [] })),
  ])
  return [...buying.chats, ...selling.chats].map(mapRestChat).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function watchThread(chatId: string, userId: string, onChange: (messages: UiMessage[], chat: UiChat | null) => void): Unsubscribe {
  return afterTransport(() => startThread(chatId, userId, onChange))
}

function startThread(chatId: string, userId: string, onChange: (messages: UiMessage[], chat: UiChat | null) => void): Unsubscribe {
  if (getChatTransport() !== 'firestore') {
    const pull = async () => {
      const loaded = await loadRestThread(chatId, userId)
      onChange(loaded.messages, loaded.chat)
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 4000)
    return () => window.clearInterval(timer)
  }

  let chat: UiChat | null = null
  let messages: UiMessage[] = []
  const emit = () => onChange(messages, chat)
  const stopChat = onSnapshot(
    doc(firestore, 'chats', chatId),
    (snapshot) => {
      chat = snapshot.exists() ? mapFirestoreChat(snapshot.id, snapshot.data()) : null
      emit()
    },
    (error) => console.error('[chat] thread listener failed', error),
  )
  const stopMessages = onSnapshot(
    query(collection(firestore, 'messages', chatId, 'messages'), orderBy('timestamp', 'asc')),
    (snapshot) => {
      messages = snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          senderId: String(data.senderId || ''),
          receiverId: data.receiverId ? String(data.receiverId) : undefined,
          text: String(data.message || ''),
          createdAt: timestampToMillis(data.timestamp),
          messageType: String(data.messageType || 'text'),
          priceData: data.priceData as OfferData | undefined,
          productData: data.productData as Record<string, string> | undefined,
          imageUrl: data.attachmentData?.url ? String(data.attachmentData.url) : undefined,
        }
      })
      emit()
      // Mark incoming messages read, as the mobile app does when a chat is open.
      snapshot.docs
        .filter((item) => item.data().receiverId === userId && item.data().isRead === false)
        .forEach((item) => void updateDoc(item.ref, { isRead: true }).catch(() => undefined))
    },
    (error) => console.error('[chat] messages listener failed', error),
  )
  return () => {
    stopChat()
    stopMessages()
  }
}

async function loadRestThread(chatId: string, userId: string) {
  const [buying, selling] = await Promise.all([
    api<{ chats: RestChat[] }>('/chats/get-chats-by-buyer', { query: { buyerId: userId } }).catch(() => ({ chats: [] })),
    api<{ chats: RestChat[] }>('/chats/get-chats-by-seller', { query: { sellerId: userId } }).catch(() => ({ chats: [] })),
  ])
  const match = [...buying.chats, ...selling.chats].find((chat) => chat.id === chatId)
  if (!match) return { chat: null, messages: [] as UiMessage[] }
  return { chat: mapRestChat(match), messages: (match.messages || []).map(mapRestMessage) }
}

export async function openProductChat(input: {
  product: Product
  buyerId: string
  buyerName: string
}) {
  await whenChatTransportReady()
  const sellerId = input.product.seller?.id || input.product.sellerId || ''
  const sellerName = input.product.seller?.fullName || 'Seller'
  const image = productImages(input.product)[0] || ''
  // The mobile app stores the price as display text, e.g. "₹2000".
  const price = input.product.price != null ? `₹${input.product.price}` : ''
  const title = productTitle(input.product)

  if (getChatTransport() === 'firestore') {
    const chatId = `${input.product.id}_${sellerId}_${input.buyerId}`
    const ref = doc(firestore, 'chats', chatId)
    // Rules deny reads of a chat doc that doesn't exist yet, so a denied read
    // means there is no chat to reuse and we create it.
    const exists = await getDoc(ref)
      .then((snapshot) => snapshot.exists())
      .catch((error: { code?: string }) => {
        if (error.code === 'permission-denied') return false
        throw error
      })
    if (!exists) {
      await setDoc(ref, {
        chatId,
        productId: input.product.id,
        sellerId,
        buyerId: input.buyerId,
        sellerName,
        buyerName: input.buyerName,
        productTitle: title,
        productImage: image,
        productPrice: price,
        lastMessage: 'Product shared',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        participants: [sellerId, input.buyerId],
        dealStatus: 'active',
        isArchived: false,
        hasMessages: false,
      })
      const messageId = String(Date.now())
      await setDoc(doc(firestore, 'messages', chatId, 'messages', messageId), {
        messageId,
        senderId: input.buyerId,
        receiverId: sellerId,
        message: 'Product shared',
        timestamp: serverTimestamp(),
        messageType: 'product_card',
        isRead: false,
        productData: { productId: input.product.id, title, image, price },
      })
    }
    return chatId
  }

  const existing = await api<{ chats: RestChat[] }>('/chats/get-chats-by-buyer', { query: { buyerId: input.buyerId } })
  const match = existing.chats.find((chat) => chat.product?.id === input.product.id && chat.sellerId === sellerId)
  if (match) return match.id
  const created = await api<{ chatId: string }>('/chats/createchat', {
    method: 'POST',
    body: { productId: input.product.id, buyerId: input.buyerId, sellerId, senderId: input.buyerId },
  })
  return created.chatId
}

async function notifyBackend(chat: UiChat, senderId: string, messageText: string) {
  try {
    const listed = await api<{ chats: RestChat[] }>(
      senderId === chat.buyerId ? '/chats/get-chats-by-buyer' : '/chats/get-chats-by-seller',
      { query: senderId === chat.buyerId ? { buyerId: senderId } : { sellerId: senderId } },
    )
    let backendId = listed.chats.find((item) => item.product?.id === chat.productId)?.id
    if (!backendId) {
      const created = await api<{ chatId: string }>('/chats/createchat', {
        method: 'POST',
        body: { productId: chat.productId, buyerId: chat.buyerId, sellerId: chat.sellerId, senderId },
      })
      backendId = created.chatId
    }
    const form = new FormData()
    form.set('chatId', backendId)
    form.set('senderId', senderId)
    form.set('messageText', messageText)
    await api('/chats/add-messages', { method: 'POST', form })
  } catch {
    /* push is best-effort, the Firestore message is already saved */
  }
}

export async function sendText(chat: UiChat, senderId: string, text: string) {
  await whenChatTransportReady()
  const receiverId = senderId === chat.buyerId ? chat.sellerId : chat.buyerId
  if (getChatTransport() === 'firestore') {
    const messageId = String(Date.now())
    await setDoc(doc(firestore, 'messages', chat.id, 'messages', messageId), {
      messageId,
      senderId,
      receiverId,
      message: text,
      timestamp: serverTimestamp(),
      messageType: 'text',
      isRead: false,
    })
    await updateDoc(doc(firestore, 'chats', chat.id), {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      hasMessages: true,
    })
    void notifyBackend(chat, senderId, text)
    return
  }
  const form = new FormData()
  form.set('chatId', chat.id)
  form.set('senderId', senderId)
  form.set('messageText', text)
  await api('/chats/add-messages', { method: 'POST', form })
}

export async function sendQuote(chat: UiChat, senderId: string, senderName: string, price: number) {
  await whenChatTransportReady()
  const receiverId = senderId === chat.buyerId ? chat.sellerId : chat.buyerId
  if (getChatTransport() === 'firestore') {
    // Offer number counts every quote in the chat, as in the mobile app.
    const quotes = await getDocs(
      query(collection(firestore, 'messages', chat.id, 'messages'), where('messageType', '==', 'price_quote')),
    )
    const offerNumber = quotes.size + 1
    const text = `₹${Math.round(price)} offer ${offerNumber} by ${senderName}`
    const messageId = String(Date.now())
    await setDoc(doc(firestore, 'messages', chat.id, 'messages', messageId), {
      messageId,
      senderId,
      receiverId,
      message: text,
      timestamp: serverTimestamp(),
      messageType: 'price_quote',
      isRead: false,
      priceData: { price, isConfirmed: false, offerNumber, quotedBy: senderId },
    })
    await updateDoc(doc(firestore, 'chats', chat.id), {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      hasMessages: true,
    })
    void notifyBackend(chat, senderId, text)
    return
  }
  const text = `₹${Math.round(price)} offer by ${senderName}`
  const form = new FormData()
  form.set('chatId', chat.id)
  form.set('senderId', senderId)
  form.set(
    'messageText',
    JSON.stringify({ kind: 'price_quote', text, price, offerNumber: 1, quotedBy: senderId, isConfirmed: false }),
  )
  await api('/chats/add-messages', { method: 'POST', form })
}

// Either party can confirm the other's quote, mirroring the mobile app.
export async function acceptOffer(chat: UiChat, senderId: string, offer: OfferData, messageId: string) {
  await whenChatTransportReady()
  const locked = await api<{ order?: { orderId?: string }; orderId?: string }>('/product/deal-lock', {
    method: 'POST',
    body: { productId: chat.productId, buyerId: chat.buyerId, finalPrice: offer.price },
  })
  const orderId = locked.orderId || locked.order?.orderId || ''
  if (getChatTransport() === 'firestore') {
    const receiverId = senderId === chat.buyerId ? chat.sellerId : chat.buyerId
    const amount = Math.round(offer.price)
    const dealId = String(Date.now())
    await setDoc(doc(firestore, 'messages', chat.id, 'messages', dealId), {
      messageId: dealId,
      senderId,
      receiverId,
      message: `Deal has been locked for ₹${amount}`,
      timestamp: serverTimestamp(),
      messageType: 'deal_locked',
      isRead: false,
      priceData: { price: offer.price, isConfirmed: true, confirmedBy: senderId },
    })
    await updateDoc(doc(firestore, 'chats', chat.id), {
      dealStatus: 'confirmed',
      finalPrice: offer.price,
      orderId,
      lastMessage: `Deal confirmed at ₹${amount}`,
      lastMessageTime: serverTimestamp(),
      hasMessages: true,
    })
    await updateDoc(doc(firestore, 'messages', chat.id, 'messages', messageId), {
      'priceData.isConfirmed': true,
    })
  }
  return orderId
}

export async function cancelDeal(chat: UiChat, userId: string) {
  await whenChatTransportReady()
  if (!chat.orderId) throw new Error('This deal has no order to cancel')
  await api('/product/cancel-deal', { method: 'POST', body: { orderId: chat.orderId } })
  if (getChatTransport() !== 'firestore') return
  const bySeller = userId === chat.sellerId
  const who = bySeller ? 'seller' : 'buyer'
  await updateDoc(doc(firestore, 'chats', chat.id), {
    dealStatus: 'active',
    finalPrice: null,
    orderId: null,
    lastMessage: `Deal cancelled by ${who}. Back to negotiation.`,
    lastMessageTime: serverTimestamp(),
  })
  const messageId = `${Date.now()}_cancel`
  await setDoc(doc(firestore, 'messages', chat.id, 'messages', messageId), {
    messageId,
    senderId: 'system',
    receiverId: bySeller ? chat.buyerId : chat.sellerId,
    message: `Deal has been cancelled by ${who}. You can continue negotiating.`,
    timestamp: serverTimestamp(),
    messageType: 'system',
    isRead: false,
  })
}

export async function markSold(orderId: string) {
  await api('/product/mark-sold', {
    method: 'POST',
    body: { orderId, soldInJunction: true },
  })
}
