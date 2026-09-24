import type { HeroBody } from './anatomy';

/** The exploration simulation uses tile coordinates; rendering owns only interpolation. */
export interface GridPoint { x: number; y: number }
export type Direction = 'north' | 'east' | 'south' | 'west';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const NPC_KINDS = ['merchant', 'blacksmith', 'scribe'] as const;
export type NpcKind = typeof NPC_KINDS[number];
export type Terrain = 'grass' | 'path' | 'water' | 'rock' | 'tree' | 'snow' | 'wall' | 'bush';
export interface WorldTile { terrain: Terrain; walkable: boolean; movementCost: number }
export interface WorldNode extends GridPoint {
  id: string;
  season: Season;
  exits: Partial<Record<Direction, string>>;
}
export interface WorldGraph {
  version: 1;
  generatorVersion: 3;
  /** Missing in older worlds, whose original two-house layouts must stay stable. */
  structureVersion?: 1 | 2 | 3;
  /** Each season occupies 7–10 complete radial rings of chunks. */
  seasonRings: Record<Season, number>;
  radius: number;
  seed: string;
  startId: string;
  /** Legacy winter landmark; retained so older seeds keep their original geometry. */
  altarNodeId: string;
  /** One early-summoning altar per season; derived independently of terrain streams. */
  seasonalAltarNodeIds?: Record<Season, string>;
  nodes: WorldNode[];
}
export interface ChunkExit {
  /** Unique endpoint identity. The peer is looked up by returnGateId, never direction alone. */
  id: string;
  returnGateId: string;
  direction: Direction;
  targetNodeId: string;
  position: GridPoint;
}
export interface WorldPoi {
  id: string;
  kind: 'campfire' | 'encounter' | 'altar' | 'portal' | 'chest' | 'well' | 'stairs-down' | 'stairs-up' | 'npc';
  position: GridPoint;
  encounterId?: string;
  /** Only seasonal summoning altars carry a boss season. */
  bossSeason?: Season;
  /** Explicit interaction only; walking over a portal or staircase never changes chunks. */
  destination?: { chunkId: string; poiId: string };
  structureId?: string;
  /** A repeatable service at the exterior approach of its own building. */
  npcKind?: NpcKind;
}
export interface WorldStructure {
  id: string;
  kind: 'house' | 'ruin' | 'well';
  /** Dedicated service houses have no random chest or basement. */
  npcKind?: NpcKind;
  origin: GridPoint;
  width: number;
  height: number;
  /** Absolute tile coordinates of physical walls; roof overhang is visual only. */
  blockedCells: GridPoint[];
  approach: GridPoint;
  variant: number;
}
export interface WorldChunk {
  id: string;
  /** Older surface chunks omit these fields. Underground chunks never become graph nodes. */
  layer?: 'surface' | 'basement';
  surfaceNodeId?: string;
  size: number;
  season: Season;
  tiles: WorldTile[];
  spawn: GridPoint;
  exits: ChunkExit[];
  pois: WorldPoi[];
  structures: WorldStructure[];
}
export interface MovementState {
  /** A percentage of the standard exploration pace, independent of combat initiative. */
  baseSpeed: number;
  /** Additive equipment and effect bonuses, applied to the actor's base pace. */
  bonusPercent: number;
  /** The portion of bonusPercent supplied by boots; absent in older saves. */
  bootsBonusPercent?: number;
  /** Time already spent preparing the next logical tile step. */
  elapsedMs: number;
}
export interface WorldActor {
  id: string; position: GridPoint; path: GridPoint[]; movement?: MovementState; body?: HeroBody;
  /** A fallen co-op hero can be raised until this room tick. Starts after their battle ends. */
  reviveUntilTick?: number;
}
export interface ExplorationState {
  version: 1;
  graph: WorldGraph;
  chunk: WorldChunk;
  currentChunkId: string;
  actors: WorldActor[];
  visited: string[];
  tick: number;
  transitions: number;
}
export interface MapValidation { valid: boolean; errors: string[] }
