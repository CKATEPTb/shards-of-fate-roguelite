/** Keep active atlases and a small reuse pool; old injury variants cannot accumulate. */
export class UnitAtlasLifetime {
  private readonly references = new Map<string, number>();
  private readonly unused = new Set<string>();

  constructor(private readonly evict: (key: string) => void, private readonly idleLimit = 8) {}

  retain(key: string) {
    this.references.set(key, (this.references.get(key) ?? 0) + 1);
    this.unused.delete(key);
  }

  release(key: string) {
    const count = this.references.get(key);
    if (count === undefined) return;
    if (count > 1) this.references.set(key, count - 1);
    else {
      this.references.delete(key);
      this.unused.add(key);
      while (this.unused.size > this.idleLimit) {
        const oldest = this.unused.values().next().value!;
        this.unused.delete(oldest);
        this.evict(oldest);
      }
    }
  }
}
