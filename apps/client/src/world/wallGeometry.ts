import type { WorldStructure } from '@shards/shared';

/** The roof and masonry share the same height above their physical footprint. */
export function wallElevation(kind: WorldStructure['kind']): number {
  return kind === 'ruin' ? 15 : 21;
}

export interface WallRun {
  row: number;
  start: number;
  length: number;
  north: boolean[];
  south: boolean[];
}

/** Connected cells share a top surface; only the outer contour receives a vertical face. */
export function connectedWallRuns(structure: WorldStructure): WallRun[] {
  const cells = new Set(structure.blockedCells.map(cell => `${cell.x - structure.origin.x},${cell.y - structure.origin.y}`));
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const runs: WallRun[] = [];
  for (let row = 0; row < structure.height; row++) {
    for (let x = 0; x < structure.width;) {
      if (!has(x, row)) { x++; continue; }
      const start = x;
      while (x < structure.width && has(x, row)) x++;
      const length = x - start;
      runs.push({ row, start, length,
        north: Array.from({ length }, (_, index) => !has(start + index, row - 1)),
        south: Array.from({ length }, (_, index) => !has(start + index, row + 1)),
      });
    }
  }
  return runs;
}

export function exposedIntervals(edges: boolean[]): Array<{ start: number; length: number }> {
  const intervals: Array<{ start: number; length: number }> = [];
  for (let index = 0; index < edges.length;) {
    if (!edges[index]) { index++; continue; }
    const start = index;
    while (index < edges.length && edges[index]) index++;
    intervals.push({ start, length: index - start });
  }
  return intervals;
}
