import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { ChunkExit, Direction, GridPoint, WorldChunk } from '@shards/shared';
import { chunkRegions, generateChunk, generateWorld } from '@shards/game-core';
import { planTrails, type TrailPlan } from '../apps/client/src/world/trail-routes';
import { TRAIL_FEATHER, TRAIL_WIDTH, trailCoverage, trailDistance } from '../apps/client/src/world/trail-geometry';
import { drawPaths } from '../apps/client/src/world/terrain-paths';
import { palettes } from '../apps/client/src/world/palette';
import { TILE_SIZE } from '../apps/client/src/world/projection';

const gate = (id: string, direction: Direction, x: number, y: number): ChunkExit => ({ id, direction, position: { x, y }, returnGateId: `${id}:return`, targetNodeId: id });
const key = (point: GridPoint) => `${point.x},${point.y}`;
function fixture(size = 9): WorldChunk {
  return { id: '0,0', size, season: 'spring', spawn: { x: 4, y: 4 }, pois: [], structures: [], exits: [],
    tiles: Array.from({ length: size * size }, () => ({ terrain: 'path', walkable: true, movementCost: 1 })) };
}
function neighbours(plan: TrailPlan): Map<string, Set<string>> {
  const result = new Map(plan.cells.map(cell => [key(cell), new Set<string>()]));
  for (const edge of plan.edges) {
    result.get(key(edge.from))!.add(key(edge.to));
    result.get(key(edge.to))!.add(key(edge.from));
  }
  return result;
}
function reachable(plan: TrailPlan, start: GridPoint): Set<string> {
  const links = neighbours(plan);
  const reached = new Set([key(start)]);
  const queue = [key(start)];
  for (let read = 0; read < queue.length; read++) for (const next of links.get(queue[read]) ?? []) {
    if (!reached.has(next)) { reached.add(next); queue.push(next); }
  }
  return reached;
}
function expectWalkableEdges(chunk: WorldChunk, plan: TrailPlan) {
  for (const cell of plan.cells) expect(chunk.tiles[cell.y * chunk.size + cell.x].walkable).toBe(true);
  for (const { from, to } of plan.edges) {
    expect(Math.abs(from.x - to.x) + Math.abs(from.y - to.y)).toBe(1);
    expect(chunk.tiles[from.y * chunk.size + from.x].walkable).toBe(true);
    expect(chunk.tiles[to.y * chunk.size + to.x].walkable).toBe(true);
  }
}

describe('sparse visual trail networks', () => {
  it('reduces a broad field of carved path tiles to a single continuous exit-to-exit line', () => {
    const chunk = fixture(7);
    chunk.exits = [gate('n', 'north', 3, 0), gate('s', 'south', 3, 6)];
    const plan = planTrails(chunk);
    expect(plan.cells).toHaveLength(7);
    expect(plan.edges).toHaveLength(6);
    expect(plan.cells.every(cell => cell.x === 3)).toBe(true);
    expect(plan.cells[0].directions).toContain('north');
    expect(plan.cells.at(-1)!.directions).toContain('south');
    expect(reachable(plan, chunk.exits[0].position).has(key(chunk.exits[1].position))).toBe(true);
  });

  it('joins all exits into a tree without lattice cycles or non-exit dead ends', () => {
    const chunk = fixture();
    chunk.exits = [gate('n', 'north', 4, 0), gate('e', 'east', 8, 4), gate('s', 'south', 4, 8), gate('w', 'west', 0, 4)];
    const plan = planTrails(chunk);
    const connected = reachable(plan, chunk.exits[0].position);
    for (const exit of chunk.exits) expect(connected.has(key(exit.position))).toBe(true);
    expect(plan.edges.length).toBe(plan.cells.length - 1);
    expect(plan.cells.length).toBeLessThan(chunk.tiles.length / 3);
    const terminals = new Set(chunk.exits.map(exit => key(exit.position)));
    for (const [point, adjacent] of neighbours(plan)) if (adjacent.size === 1) expect(terminals.has(point)).toBe(true);
  });

  it('routes around actual blocked terrain rather than painting through a wall', () => {
    const chunk = fixture();
    for (let y = 0; y < chunk.size; y++) if (y !== 6) chunk.tiles[y * chunk.size + 4] = { terrain: 'wall', walkable: false, movementCost: 1 };
    chunk.exits = [gate('w', 'west', 0, 2), gate('e', 'east', 8, 2)];
    const plan = planTrails(chunk);
    expectWalkableEdges(chunk, plan);
    expect(plan.cells.some(cell => cell.x === 4 && cell.y === 6)).toBe(true);
    expect(reachable(plan, chunk.exits[0].position).has(key(chunk.exits[1].position))).toBe(true);
  });

  it('keeps separated regions separate and leaves a gate-free pocket unpainted', () => {
    const chunk = fixture();
    for (let y = 0; y < chunk.size; y++) for (const x of [3, 5]) chunk.tiles[y * chunk.size + x].walkable = false;
    chunk.exits = [gate('nw', 'north', 1, 0), gate('sw', 'south', 1, 8), gate('ne', 'north', 7, 0), gate('se', 'south', 7, 8)];
    const plan = planTrails(chunk);
    expectWalkableEdges(chunk, plan);
    const west = reachable(plan, { x: 1, y: 0 });
    expect(west.has('1,8')).toBe(true);
    expect(west.has('7,0')).toBe(false);
    expect(reachable(plan, { x: 7, y: 0 }).has('7,8')).toBe(true);
    expect(plan.cells.some(cell => cell.x === 4)).toBe(false);
  });

  it('prefers an existing worn corridor over a similar grass shortcut', () => {
    const chunk = fixture(11);
    for (const tile of chunk.tiles) tile.terrain = 'grass';
    for (let x = 0; x < chunk.size; x++) chunk.tiles[4 * chunk.size + x].terrain = 'path';
    chunk.tiles[5 * chunk.size].terrain = 'path';
    chunk.tiles[5 * chunk.size + 10].terrain = 'path';
    chunk.exits = [gate('w', 'west', 0, 5), gate('e', 'east', 10, 5)];
    const plan = planTrails(chunk);
    expect(plan.cells.some(cell => cell.x === 5 && cell.y === 4)).toBe(true);
    expect(plan.cells.some(cell => cell.x === 5 && cell.y === 5)).toBe(false);
  });

  it('gives a one-exit pocket only a short natural entrance spur', () => {
    const chunk = fixture();
    chunk.exits = [gate('w', 'west', 0, 4)];
    chunk.tiles[4 * chunk.size + 2].walkable = false;
    const plan = planTrails(chunk);
    expectWalkableEdges(chunk, plan);
    expect(plan.edges.length).toBeLessThanOrEqual(3);
    expect(plan.cells.length).toBeLessThanOrEqual(4);
    expect(plan.cells.every(cell => cell.naturalSpur)).toBe(true);
    expect(plan.cells.find(cell => cell.x === 0 && cell.y === 4)?.directions).toContain('west');
    expect(plan.cells.every(cell => cell.x < chunk.size - 1)).toBe(true);
  });

  it('does not turn unused carved path tiles into decoration when a region has no exits', () => {
    expect(planTrails(fixture())).toEqual({ cells: [], edges: [] });
  });

  it('preserves real generated walkability and connects every pair of exits in each region', () => {
    const graph = generateWorld('FIRST-CAMPFIRE');
    for (const id of ['0,0', '1,0', '0,-1', '-1,0']) {
      const chunk = generateChunk(graph, id);
      const before = JSON.stringify(chunk);
      const plan = planTrails(chunk);
      const regions = chunkRegions(chunk);
      expectWalkableEdges(chunk, plan);
      for (const start of chunk.exits) {
        const connected = reachable(plan, start.position);
        const region = regions.labels[start.position.y * chunk.size + start.position.x];
        for (const end of chunk.exits) {
          const sameRegion = regions.labels[end.position.y * chunk.size + end.position.x] === region;
          expect(connected.has(key(end.position))).toBe(sameRegion);
        }
      }
      expect(planTrails(chunk)).toEqual(plan);
      expect(JSON.stringify(chunk)).toBe(before);
    }
  });
});

describe('narrow continuous trail silhouettes', () => {
  it('keeps a 9 px core and a feather no wider than 2 px through bends and junctions', () => {
    expect(TRAIL_WIDTH).toBeGreaterThanOrEqual(8);
    expect(TRAIL_WIDTH).toBeLessThanOrEqual(10);
    expect(TRAIL_FEATHER).toBeLessThanOrEqual(2);
    const horizontal = trailDistance(['east', 'west']);
    expect(trailCoverage(horizontal(16, 16 + TRAIL_WIDTH / 2))).toBe(1);
    expect(trailCoverage(horizontal(16, 16 + TRAIL_WIDTH / 2 + TRAIL_FEATHER))).toBe(0);
    for (const directions of [['north', 'east'], ['north', 'east', 'south', 'west']] as Direction[][]) {
      const distance = trailDistance(directions);
      expect(distance(16, 16)).toBe(0);
      expect(distance(16, 0)).toBe(0);
      expect(distance(32, 16)).toBe(0);
      expect(trailCoverage(distance(2, 2))).toBe(0);
    }
  });

  it('matches adjacent tile masks exactly at their common route edge', () => {
    const left = trailDistance(['north', 'east']);
    const right = trailDistance(['west', 'south']);
    for (let y = 0; y <= TILE_SIZE; y += 0.5) expect(trailCoverage(left(TILE_SIZE, y))).toBe(trailCoverage(right(0, y)));
  });

  it('keeps the painted dirt and cobbles inside the same thin corridor', () => {
    const chunk = fixture(7);
    chunk.exits = [gate('n', 'north', 3, 0), gate('s', 'south', 3, 6)];
    const rectangles: Array<{ x: number; y: number; width: number; height: number }> = [];
    const art = { fillStyle() { return this; }, fillRect(x: number, y: number, width: number, height: number) { rectangles.push({ x, y, width, height }); return this; } } as unknown as Phaser.GameObjects.Graphics;
    drawPaths(art, chunk, palettes.spring);
    expect(rectangles.length).toBeGreaterThan(0);
    const centre = 3.5 * TILE_SIZE;
    const radius = TRAIL_WIDTH / 2 + TRAIL_FEATHER;
    for (const rectangle of rectangles) {
      expect(rectangle.x).toBeGreaterThanOrEqual(centre - radius);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(centre + radius);
    }
  });
});
