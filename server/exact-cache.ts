/** Bounded LRU of immutable strings/primitives. No caller-owned objects are retained. */
export class ExactCache<T extends string | boolean> {
  private readonly entries = new Map<string, T>()
  private bytes = 0
  constructor(private readonly capacity = 512, private readonly maxBytes = 8 * 1024 * 1024) {}
  get(key: string): T | undefined {
    const value = this.entries.get(key)
    if (value !== undefined) { this.entries.delete(key); this.entries.set(key, value) }
    return value
  }
  set(key: string, value: T): void {
    const size = (key.length + (typeof value === 'string' ? value.length : 1)) * 2
    if (size > this.maxBytes) return
    const old = this.entries.get(key)
    if (old !== undefined) { this.bytes -= (key.length + (typeof old === 'string' ? old.length : 1)) * 2; this.entries.delete(key) }
    this.entries.set(key, value); this.bytes += size
    while (this.entries.size > this.capacity || this.bytes > this.maxBytes) {
      const first = this.entries.keys().next().value!
      const oldValue = this.entries.get(first)!
      this.bytes -= (first.length + (typeof oldValue === 'string' ? oldValue.length : 1)) * 2
      this.entries.delete(first)
    }
  }
}
