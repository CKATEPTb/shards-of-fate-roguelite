import type { GridPoint, WorldActor, WorldChunk } from '@shards/shared';
import { isWalkable, neighbors, pointAt, tileIndex } from '../world/grid';

/** The safest reachable interior tile, with stable tie-breaking and no random draws. */
export function retreatPosition(chunk: WorldChunk, actor: WorldActor, participants: readonly GridPoint[], occupied: readonly GridPoint[] = []): GridPoint {
  const gates = new Set(chunk.exits.map(exit => tileIndex(exit.position, chunk.size)));
  const blocked = new Set(occupied.map(point => tileIndex(point, chunk.size)));
  function distances(starts: readonly GridPoint[]): Int32Array {
    const result = new Int32Array(chunk.tiles.length).fill(-1);
    const queue: number[] = [];
    for (const point of starts) if (isWalkable(chunk, point)) {
      const index = tileIndex(point, chunk.size);
      if (result[index] < 0) { result[index] = 0; queue.push(index); }
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      for (const next of neighbors(pointAt(index, chunk.size), chunk.size)) {
        const target = tileIndex(next, chunk.size);
        if (result[target] >= 0 || !chunk.tiles[target].walkable || gates.has(target)) continue;
        result[target] = result[index] + 1;
        queue.push(target);
      }
    }
    return result;
  }
  const accessible = distances([actor.position]);
  const threat = distances(participants);
  let best = tileIndex(actor.position, chunk.size);
  let safety = threat[best];
  for (let index = 0; index < accessible.length; index++) {
    if (accessible[index] < 0 || gates.has(index) || blocked.has(index)) continue;
    const score = threat[index] < 0 ? chunk.tiles.length : threat[index];
    const previous = safety < 0 ? chunk.tiles.length : safety;
    if (score > previous || score === previous && accessible[index] < accessible[best]) { best = index; safety = threat[index]; }
  }
  return pointAt(best, chunk.size);
}
