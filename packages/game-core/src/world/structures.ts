import type { GridPoint, RngState, WorldPoi, WorldStructure } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';
import { insidePocketMask, type DetachedPocket } from './pockets';
import { worldDie } from './generation-dice';

export function withinStructure(point: GridPoint, structure: WorldStructure, margin = 0): boolean {
  return point.x >= structure.origin.x - margin && point.y >= structure.origin.y - margin
    && point.x < structure.origin.x + structure.width + margin && point.y < structure.origin.y + structure.height + margin;
}

function structureAt(nodeId: string, kind: WorldStructure['kind'], origin: GridPoint, variant: number, ordinal: number): WorldStructure {
  const width = kind === 'well' ? 2 : kind === 'house' ? 4 : 5;
  const height = kind === 'well' ? 2 : kind === 'house' ? 3 : 4;
  const door = kind === 'house' ? 1 + variant % 2 : kind === 'ruin' ? 2 : 0;
  const blockedCells: GridPoint[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const perimeter = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const doorway = y === height - 1 && (x === door || kind === 'ruin' && x === door + 1);
    const ruined = kind === 'ruin' && (y === 0 && x === 3 || x === width - 1 && y === 1 + variant % 2);
    if (kind === 'well' || perimeter && !doorway && !ruined) blockedCells.push({ x: origin.x + x, y: origin.y + y });
  }
  return { id: `${nodeId}:structure:${ordinal}`, kind, origin, width, height, blockedCells,
    approach: { x: origin.x + door, y: origin.y + height }, variant };
}

function settlementHouseCount(rng: RngState, structureVersion: 1 | 2 | 3): number {
  if (structureVersion === 1) return 2;
  if (structureVersion === 3) {
    const roll = worldDie(createRng(`house-count-v3:${hashString(rng.seed)}`), 20);
    return roll <= 12 ? 1 : roll <= 19 ? 2 : 3;
  }
  // Count selection must not shift the variants or placement of existing houses.
  const countRng = createRng(`house-count-v2:${hashString(rng.seed)}`);
  const roll = drawRandom(countRng, 'WORLD');
  return roll < 0.6 ? 1 : roll < 0.95 ? 2 : 3;
}

/** Footprints are shared with the renderer. Placement is decided before any corridor is carved. */
export function planStructures(nodeId: string, start: boolean, rng: RngState, pocket: DetachedPocket | null, pois: WorldPoi[], structureVersion: 1 | 2 | 3 = 1): WorldStructure[] {
  const random = () => drawRandom(rng, 'WORLD');
  const structures: WorldStructure[] = [];
  const protectedPoints = [{ x: 17, y: 17 }, ...pois.map(poi => poi.position)];
  const safe = (candidate: WorldStructure) => {
    for (let y = candidate.origin.y - 1; y <= candidate.origin.y + candidate.height; y++) for (let x = candidate.origin.x - 1; x <= candidate.origin.x + candidate.width; x++) {
      const point = { x, y };
      if (insidePocketMask(point, pocket) || protectedPoints.some(protectedPoint => Math.abs(x - protectedPoint.x) <= 2 && Math.abs(y - protectedPoint.y) <= 2)
        || structures.some(other => withinStructure(point, other, 1))) return false;
    }
    return true;
  };
  const add = (kind: WorldStructure['kind'], origins: GridPoint[]) => {
    const variant = structureVersion === 3 ? worldDie(rng, 4) - 1 : Math.floor(random() * 4);
    const choices = start ? origins : origins.map((point, index) => origins[(index + variant) % origins.length]);
    for (const origin of choices) {
      const candidate = structureAt(nodeId, kind, { ...origin }, variant, structures.length);
      if (safe(candidate)) { structures.push(candidate); return; }
    }
  };
  const slots = [{ x: 7, y: 7 }, { x: 23, y: 7 }, { x: 7, y: 23 }, { x: 23, y: 23 }];
  const roll = start ? 0 : structureVersion === 3 ? (worldDie(rng, 100) - 1) / 100 : random();
  if (roll < 0.24) {
    const houseCount = settlementHouseCount(rng, structureVersion);
    for (let index = 0; index < houseCount; index++) add('house', index % 2 === 0 ? slots : slots.slice().reverse());
    add('well', [{ x: 22, y: 24 }, { x: 12, y: 22 }, { x: 22, y: 11 }]);
  }
  else if (roll < 0.5) add('ruin', slots);
  else if (roll < 0.76) add('well', [{ x: 22, y: 24 }, { x: 12, y: 22 }, { x: 22, y: 11 }, { x: 8, y: 18 }]);
  return structures;
}
