import type { GridPoint, RngState, Terrain, WorldChunk, WorldTile } from '@shards/shared';
import { drawRandom } from '../random';
import { neighbors, tileIndex } from './grid';
import { terrainMovementCost } from './movement-speed';
type CarvingMask = (point: GridPoint) => boolean;

export function makeTile(terrain: Terrain): WorldTile {
  return { terrain, walkable: terrain === 'grass' || terrain === 'snow' || terrain === 'path' || terrain === 'bush',
    movementCost: terrainMovementCost(terrain) };
}

export function paint(chunk: WorldChunk, point: GridPoint, terrain: Terrain): void {
  chunk.tiles[tileIndex(point, chunk.size)] = makeTile(terrain);
}

function canCarve(chunk: WorldChunk, point: GridPoint, blocked: CarvingMask): boolean {
  return point.x > 0 && point.y > 0 && point.x < chunk.size - 1 && point.y < chunk.size - 1 && !blocked(point);
}

function straightPath(from: GridPoint, to: GridPoint): GridPoint[] {
  const result = [{ ...from }]; const cursor = { ...from };
  while (cursor.x !== to.x || cursor.y !== to.y) {
    cursor.x += Math.sign(to.x - cursor.x); cursor.y += Math.sign(to.y - cursor.y);
    result.push({ ...cursor });
  }
  return result;
}

/** A seeded spanning maze with extra loops and varied rooms replaces the four center spokes. */
export function carveMaze(chunk: WorldChunk, blocked: CarvingMask, rng: RngState, ground: Terrain): void {
  const random = () => drawRandom(rng, 'WORLD');
  const anchors: GridPoint[] = [];
  for (let y = 3; y < chunk.size - 1; y += 4) for (let x = 3; x < chunk.size - 1; x += 4) {
    if (canCarve(chunk, { x, y }, blocked)) anchors.push({ x, y });
  }
  const links = anchors.map(from => anchors.flatMap((to, index) => {
    if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 4 || (from.x !== to.x && from.y !== to.y)) return [];
    return straightPath(from, to).every(point => canCarve(chunk, point, blocked)) ? [index] : [];
  }));
  const first = anchors.findIndex(point => point.x === 15 && point.y === 15);
  const visited = new Set([first]); const stack = [first];
  const carveLink = (from: GridPoint, to: GridPoint) => {
    const width = random() < 0.72 ? 2 : 1;
    for (const point of straightPath(from, to)) {
      paint(chunk, point, 'path');
      const beside = { x: point.x + (from.x === to.x ? 1 : 0), y: point.y + (from.y === to.y ? 1 : 0) };
      if (width > 1 && canCarve(chunk, beside, blocked)) paint(chunk, beside, 'path');
    }
  };
  paint(chunk, anchors[first], 'path');
  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = links[current].filter(index => !visited.has(index));
    if (!options.length) { stack.pop(); continue; }
    const next = options[Math.floor(random() * options.length)];
    carveLink(anchors[current], anchors[next]); visited.add(next); stack.push(next);
  }
  for (const index of visited) {
    for (const other of links[index]) if (other > index && visited.has(other) && random() < 0.16) carveLink(anchors[index], anchors[other]);
    if (random() > 0.5) continue;
    const radius = random() < 0.3 ? 2 : 1; const center = anchors[index];
    for (let y = center.y - radius; y <= center.y + radius; y++) for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (canCarve(chunk, { x, y }, blocked)) paint(chunk, { x, y }, ground);
    }
  }
}

/** Join a room or gate to the existing maze through the shortest legal terrain corridor. */
export function connectToMaze(chunk: WorldChunk, target: GridPoint, blocked: CarvingMask, rng: RngState): void {
  if (!canCarve(chunk, target, blocked)) throw new Error('Main corridor intersects reserved terrain');
  const previous = new Int32Array(chunk.tiles.length).fill(-1); const queue = [target];
  const first = tileIndex(target, chunk.size); previous[first] = first;
  const offset = Math.floor(drawRandom(rng, 'WORLD') * 4);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const point = queue[cursor]; const index = tileIndex(point, chunk.size);
    if (chunk.tiles[index].walkable) {
      for (let next = index; ; next = previous[next]) {
        paint(chunk, { x: next % chunk.size, y: Math.floor(next / chunk.size) }, 'path');
        if (next === first) return;
      }
    }
    const candidates = neighbors(point, chunk.size);
    for (let i = 0; i < candidates.length; i++) {
      const next = candidates[(i + offset) % candidates.length]; const nextIndex = tileIndex(next, chunk.size);
      if (previous[nextIndex] === -1 && canCarve(chunk, next, blocked)) { previous[nextIndex] = index; queue.push(next); }
    }
  }
  throw new Error('No safe maze connector');
}
