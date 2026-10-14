export type ChatTransport = 'firestore' | 'rest' | 'unknown'

let transport: ChatTransport = 'unknown'
let resolveReady: (value: ChatTransport) => void = () => undefined
let ready = new Promise<ChatTransport>((resolve) => { resolveReady = resolve })

export function prepareChatTransport(next: Exclude<ChatTransport, 'unknown'>) {
  transport = next
  resolveReady(next)
}

export function getChatTransport() {
  return transport
}

// Firebase sign-in runs in the background after boot/login; chat code waits
// on this so it never picks REST just because sign-in hasn't finished yet.
export function whenChatTransportReady() {
  return ready
}

export function resetChatTransport() {
  transport = 'unknown'
  ready = new Promise<ChatTransport>((resolve) => { resolveReady = resolve })
}
