interface Entry { index: number; priority: number }

/** A stable min-heap bounds the cost of repeated tile clicks without scanning the frontier. */
export class PathHeap {
  private entries: Entry[] = [];
  get size(): number { return this.entries.length; }
  push(entry: Entry): void {
    let cursor = this.entries.length;
    this.entries.push(entry);
    while (cursor > 0) {
      const parent = (cursor - 1) >> 1;
      if (!this.before(entry, this.entries[parent])) break;
      this.entries[cursor] = this.entries[parent]; cursor = parent;
    }
    this.entries[cursor] = entry;
  }
  pop(): Entry {
    const first = this.entries[0];
    const last = this.entries.pop()!;
    if (this.entries.length) {
      let cursor = 0;
      while (cursor * 2 + 1 < this.entries.length) {
        let child = cursor * 2 + 1;
        if (child + 1 < this.entries.length && this.before(this.entries[child + 1], this.entries[child])) child++;
        if (!this.before(this.entries[child], last)) break;
        this.entries[cursor] = this.entries[child]; cursor = child;
      }
      this.entries[cursor] = last;
    }
    return first;
  }
  private before(left: Entry, right: Entry): boolean { return left.priority < right.priority || (left.priority === right.priority && left.index < right.index); }
}
