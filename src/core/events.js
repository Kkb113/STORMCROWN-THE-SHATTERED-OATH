/** Scoped event subscriptions; all listeners are cleared on scene disposal. */
export class Events {
  #listeners = new Map();
  on(type, fn) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(fn);
    return () => this.#listeners.get(type)?.delete(fn);
  }
  once(type, fn) { const off = this.on(type, value => { off(); fn(value); }); return off; }
  emit(type, detail) { for (const fn of [...(this.#listeners.get(type) ?? [])]) fn(detail); }
  clear() { this.#listeners.clear(); }
}
