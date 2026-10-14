import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { acceptOffer, cancelDeal, chatPrice, markSold, sendQuote, sendText, watchInbox, watchThread, type UiChat, type UiMessage } from '../chat/chatService'
import { formatPrice } from '../lib/format'

export function ChatsPage() {
  const { chatId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'buying' | 'selling'>('buying')
  const [chats, setChats] = useState<UiChat[]>([])
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [active, setActive] = useState<UiChat | null>(null)
  const [draft, setDraft] = useState('')
  const [quote, setQuote] = useState('')
  const [confirm, setConfirm] = useState<UiMessage | null>(null)
  const [dealPrice, setDealPrice] = useState<number | null>(null)
  const [dealOrderId, setDealOrderId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    return watchInbox(user.id, setChats)
  }, [user])

  useEffect(() => {
    if (!user || !chatId) {
      setMessages([])
      setActive(null)
      return
    }
    return watchThread(decodeURIComponent(chatId), user.id, (nextMessages, nextChat) => {
      setMessages(nextMessages)
      setActive(nextChat)
    })
  }, [chatId, user])

  const visible = useMemo(
    () => chats.filter((chat) => (tab === 'buying' ? chat.buyerId === user?.id : chat.sellerId === user?.id)),
    [chats, tab, user?.id],
  )
  const selected = active || visible.find((chat) => chat.id === decodeURIComponent(chatId || '')) || null
  const iAmSeller = selected?.sellerId === user?.id

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!user || !selected || !draft.trim()) return
    await sendText(selected, user.id, draft.trim())
    setDraft('')
  }

  const dealActive = !selected || selected.dealStatus === 'active'

  async function quotePrice(event: FormEvent) {
    event.preventDefault()
    if (!user || !selected) return
    const price = Number(quote.replace(/[^\d.]/g, ''))
    if (!price || price <= 0) {
      setError('Enter a valid price')
      return
    }
    setError('')
    try {
      await sendQuote(selected, user.id, user.fullName || 'User', price)
      setQuote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the quote')
    }
  }

  async function confirmOffer() {
    if (!user || !selected || !confirm?.priceData) return
    setError('')
    setBusy(true)
    try {
      const orderId = await acceptOffer(selected, user.id, confirm.priceData, confirm.id)
      setDealOrderId(orderId)
      setDealPrice(confirm.priceData.price)
      setConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock the deal')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!user || !selected) return
    setError('')
    setBusy(true)
    try {
      await cancelDeal(selected, user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the deal')
    } finally {
      setBusy(false)
    }
  }

  async function sold(orderId: string) {
    if (!selected) return
    setError('')
    try {
      await markSold(orderId)
      navigate(`/my-listings/${selected.productId}/sold`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark as sold')
    }
  }

  return (
    <AppShell>
      <div className="chat-shell">
        <aside className="chat-list">
          <div className="chat-tabbar">
            <button className={tab === 'buying' ? 'btn btn-dark' : 'btn btn-ghost'} type="button" onClick={() => setTab('buying')}>Buying</button>
            <button className={tab === 'selling' ? 'btn btn-dark' : 'btn btn-ghost'} type="button" onClick={() => setTab('selling')}>Selling</button>
          </div>
          {visible.length === 0 ? <EmptyState image="chats.png">No {tab} chats yet.</EmptyState> : visible.map((chat) => (
            <Link key={chat.id} className={chat.id === selected?.id ? 'chat-row active' : 'chat-row'} to={`/chats/${encodeURIComponent(chat.id)}`}>
              <span className="avatar">{chat.productImage ? <img src={chat.productImage} alt="" /> : chat.productTitle.slice(0, 1)}</span>
              <span className="grow">
                <strong>{tab === 'buying' ? chat.sellerName : chat.buyerName}</strong>
                <div className="muted">{chat.productTitle}</div>
                <div className="muted">{chat.lastMessage}</div>
              </span>
            </Link>
          ))}
        </aside>
        <section className="thread">
          {selected ? (
            <>
              <div className="thread-head">
                <div className="grow">
                  <strong>{iAmSeller ? selected.buyerName : selected.sellerName}</strong>
                  <div className="muted">{selected.productTitle} · {formatPrice(selected.finalPrice ?? chatPrice(selected))}</div>
                </div>
                <Link to={`/listing/${selected.productId}`}>View listing</Link>
              </div>
              <div className="bubbles">
                {messages.map((message) => {
                  if (message.messageType === 'price_quote' && message.priceData) {
                    const mine = message.senderId === user?.id
                    const author = message.priceData.quotedBy === selected.sellerId ? selected.sellerName : selected.buyerName
                    return (
                      <div key={message.id} className="offer-card">
                        <strong>{mine ? 'You quoted' : `${author} quoted`} {formatPrice(message.priceData.price)}</strong>
                        <span className="muted">Offer {message.priceData.offerNumber || 1} · {message.priceData.isConfirmed ? 'Accepted' : 'Waiting for confirmation'}</span>
                        {!mine && !message.priceData.isConfirmed && selected.dealStatus === 'active' ? (
                          <button className="btn btn-dark" type="button" onClick={() => setConfirm(message)}>Confirm price</button>
                        ) : null}
                      </div>
                    )
                  }
                  if (message.messageType === 'deal_locked') {
                    return <div key={message.id} className="offer-card"><strong>{message.text || 'Deal locked'}</strong><span className="muted">Meet for pickup and complete the sale in person.</span></div>
                  }
                  if (message.messageType === 'system' || message.senderId === 'system') {
                    return <div key={message.id} className="muted" style={{ alignSelf: 'center', fontSize: 13 }}>{message.text}</div>
                  }
                  if (message.messageType === 'product_card') {
                    return <div key={message.id} className="offer-card"><strong>{message.productData?.title || selected.productTitle}</strong><span className="muted">Listing shared</span></div>
                  }
                  return (
                    <div key={message.id} className={message.senderId === user?.id ? 'bubble mine' : 'bubble'}>
                      {message.imageUrl ? <img src={message.imageUrl} alt="" /> : message.text}
                    </div>
                  )
                })}
              </div>
              {error ? <div className="error" style={{ margin: '0 16px' }}>{error}</div> : null}
              {selected.dealStatus === 'confirmed' ? (
                <div className="composer" style={{ alignItems: 'center' }}>
                  <span className="grow"><strong>Deal locked</strong>{selected.finalPrice != null ? ` at ${formatPrice(selected.finalPrice)}` : ''}</span>
                  {iAmSeller && selected.orderId ? <button className="btn btn-dark" type="button" onClick={() => void sold(selected.orderId || '')}>Mark as sold</button> : null}
                  {selected.orderId ? <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void cancel()}>Cancel deal</button> : null}
                </div>
              ) : null}
              {dealActive ? (
                <form className="composer" onSubmit={quotePrice}>
                  <input className="field" value={quote} onChange={(event) => setQuote(event.target.value)} placeholder="Quote a price (₹)" inputMode="numeric" />
                  <button className="btn btn-dark" type="submit">Send quote</button>
                </form>
              ) : null}
              <form className="composer" onSubmit={submit}>
                <input className="field grow" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" />
                <button className="btn btn-dark" type="submit">Send</button>
              </form>
            </>
          ) : (
            <div className="center-state">
              <div>
                <img className="illo" src="/assets/chats.png" alt="" style={{ width: 96 }} />
                <h2>Pick a conversation</h2>
                <p className="muted">Or open a listing and start a chat with the seller.</p>
                <button className="btn btn-dark" type="button" onClick={() => navigate('/search')}>Browse listings</button>
              </div>
            </div>
          )}
        </section>
      </div>
      {confirm?.priceData ? (
        <Modal title="Confirm price" onClose={() => setConfirm(null)}>
          <p>Lock this listing at {formatPrice(confirm.priceData.price)}? The seller will be notified and the item leaves the public feed.</p>
          <button className="btn btn-dark" type="button" disabled={busy} onClick={() => void confirmOffer()}>{busy ? 'Locking…' : 'Confirm and lock deal'}</button>
        </Modal>
      ) : null}
      {dealPrice != null ? (
        <Modal title="Deal locked" onClose={() => setDealPrice(null)}>
          <p>Pickup is arranged directly with the other student. Agreed price: {formatPrice(dealPrice)}.</p>
          {dealOrderId && iAmSeller ? (
            <button className="btn btn-dark" type="button" onClick={() => void sold(dealOrderId)}>Mark as sold</button>
          ) : null}
        </Modal>
      ) : null}
    </AppShell>
  )
}
