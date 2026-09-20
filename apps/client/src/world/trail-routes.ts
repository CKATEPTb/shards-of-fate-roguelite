import { chunkRegions } from '@shards/game-core';
import type { ChunkExit, Direction, GridPoint, WorldChunk } from '@shards/shared';

export interface TrailCell extends GridPoint {
  directions: Direction[];
  naturalSpur: boolean;
}
export interface TrailEdge { from: GridPoint; to: GridPoint }
export interface TrailPlan { cells: TrailCell[]; edges: TrailEdge[] }

const directions: Array<{ name: Direction; dx: number; dy: number }> = [
  { name: 'north', dx: 0, dy: -1 }, { name: 'east', dx: 1, dy: 0 },
  { name: 'south', dx: 0, dy: 1 }, { name: 'west', dx: -1, dy: 0 },
];
const pointAt = (index: number, size: number): GridPoint => ({ x: index % size, y: Math.floor(index / size) });

function neighbours(chunk: WorldChunk, index: number): number[] {
  const { x, y } = pointAt(index, chunk.size);
  return directions.flatMap(({ dx, dy }) => {
    const nx = x + dx; const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= chunk.size || ny >= chunk.size) return [];
    const next = ny * chunk.size + nx;
    return chunk.tiles[next].walkable ? [next] : [];
  });
}

function unwind(previous: Int32Array, end: number): number[] {
  const route: number[] = [];
  for (let index = end; index !== -1; index = previous[index]) route.push(index);
  return route;
}

/** Multi-source shortest route from the existing tree to its nearest unjoined gate. */
function nearestGate(chunk: WorldChunk, tree: Set<number>, targets: Set<number>): number[] {
  const cost = new Int32Array(chunk.tiles.length).fill(0x7fffffff);
  const previous = new Int32Array(chunk.tiles.length).fill(-1);
  // Small integer weights allow a bucket queue without rescanning the whole map.
  const buckets: number[][] = [[...tree].sort((a, b) => a - b)];
  for (const index of tree) cost[index] = 0;
  for (let distance = 0; distance < buckets.length; distance++) {
    for (const index of buckets[distance] ?? []) {
      if (cost[index] !== distance) continue;
      if (targets.has(index)) return unwind(previous, index);
      for (const next of neighbours(chunk, index)) {
        const nextCost = distance + (chunk.tiles[next].terrain === 'path' ? 10 : 14);
        if (nextCost >= cost[next]) continue;
        cost[next] = nextCost;
        previous[next] = index;
        (buckets[nextCost] ??= []).push(next);
      }
    }
  }
  return [];
}

/** A single-entry pocket gets a short worn entrance, never a road to a fake exit. */
function entranceSpur(chunk: WorldChunk, gate: ChunkExit): number[] {
  const start = gate.position.y * chunk.size + gate.position.x;
  const previous = new Int32Array(chunk.tiles.length).fill(-1);
  const steps = new Int8Array(chunk.tiles.length).fill(-1);
  const queue = [start];
  steps[start] = 0;
  const outward = directions.find(direction => direction.name === gate.direction)!;
  let end = start;
  let bestScore = 0;
  for (let read = 0; read < queue.length; read++) {
    const index = queue[read];
    if (steps[index] >= 3) continue;
    for (const next of neighbours(chunk, index)) {
      if (steps[next] !== -1) continue;
      steps[next] = steps[index] + 1;
      previous[next] = index;
      queue.push(next);
      const point = pointAt(next, chunk.size);
      const inward = -(point.x - gate.position.x) * outward.dx - (point.y - gate.position.y) * outward.dy;
      const score = steps[next] * 100 + inward * 5 + (chunk.tiles[next].terrain === 'path' ? 1 : 0);
      if (score > bestScore) { bestScore = score; end = next; }
    }
  }
  return unwind(previous, end);
}

/** Visual trails only: physical terrain, regions and saved movement data remain untouched. */
export function planTrails(chunk: WorldChunk): TrailPlan {
  const regions = chunkRegions(chunk);
  const groups = new Map<number, ChunkExit[]>();
  for (const gate of chunk.exits) {
    const index = gate.position.y * chunk.size + gate.position.x;
    const region = regions.labels[index];
    if (region === undefined || region < 0) continue;
    const group = groups.get(region) ?? [];
    group.push(gate);
    groups.set(region, group);
  }
  const cells = new Map<number, TrailCell>();
  const edges = new Map<string, TrailEdge>();
  const ensure = (index: number, naturalSpur: boolean): TrailCell => {
    let cell = cells.get(index);
    if (!cell) {
      cell = { ...pointAt(index, chunk.size), directions: [], naturalSpur };
      cells.set(index, cell);
    }
    return cell;
  };
  const addRoute = (route: number[], naturalSpur: boolean) => {
    for (const index of route) ensure(index, naturalSpur);
    for (let step = 1; step < route.length; step++) {
      const from = ensure(route[step - 1], naturalSpur);
      const to = ensure(route[step], naturalSpur);
      const direction = directions.findIndex(({ dx, dy }) => to.x - from.x === dx && to.y - from.y === dy);
      const forward = directions[direction].name;
      const backward = directions[(direction + 2) % 4].name;
      if (!from.directions.includes(forward)) from.directions.push(forward);
      if (!to.directions.includes(backward)) to.directions.push(backward);
      const key = [route[step - 1], route[step]].sort((a, b) => a - b).join(':');
      edges.set(key, { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } });
    }
  };

  for (const gates of groups.values()) {
    const terminals = [...new Set(gates.map(gate => gate.position.y * chunk.size + gate.position.x))].sort((a, b) => a - b);
    if (terminals.length === 1) addRoute(entranceSpur(chunk, gates[0]), true);
    else {
      const tree = new Set([terminals[0]]);
      const remaining = new Set(terminals.slice(1));
      while (remaining.size) {
        const route = nearestGate(chunk, tree, remaining);
        if (!route.length) break;
        addRoute(route, false);
        for (const index of route) { tree.add(index); remaining.delete(index); }
      }
    }
    for (const gate of gates) {
      const cell = ensure(gate.position.y * chunk.size + gate.position.x, terminals.length === 1);
      if (!cell.directions.includes(gate.direction)) cell.directions.push(gate.direction);
    }
  }
  return { cells: [...cells.entries()].sort(([left], [right]) => left - right).map(([, cell]) => cell), edges: [...edges.values()] };
}
