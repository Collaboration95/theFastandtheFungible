// The verifier's `ws` import, mapped onto the browser WebSocket (event names as used by sdk/anchor.ts).
type Handler = (...args: unknown[]) => void
export default class BrowserSocket {
  private socket: WebSocket
  constructor(url: string) { this.socket = new WebSocket(url) }
  on(event: 'open' | 'message' | 'error' | 'close', handler: Handler) {
    this.socket.addEventListener(event, value => handler(event === 'message' ? (value as MessageEvent).data : value))
    return this
  }
  send(data: string) { this.socket.send(data) }
  terminate() { this.socket.close() }
  close() { this.socket.close() }
}
