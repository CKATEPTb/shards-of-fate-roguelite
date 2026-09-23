import type { ExplorationState, GridPoint, WorldChunk } from '@shards/shared';
import { fireRemaining, type CampfireTimes } from '../world/poiInteraction';

/** A frozen view of the place where the encounter began, independent of later movement. */
export interface BattleEnvironment {
  seed: string;
  chunk: WorldChunk;
  focus: GridPoint;
  /** A frozen lighting snapshot; omitted by legacy previews where every fire is lit. */
  litCampfireIds?: string[];
}

export function makeBattleEnvironment(world: ExplorationState, focus: GridPoint, campfires?: CampfireTimes): BattleEnvironment {
  return {
    seed: world.graph.seed,
    chunk: structuredClone(world.chunk),
    focus: { x: Math.round(focus.x), y: Math.round(focus.y) },
    ...(campfires ? { litCampfireIds: world.chunk.pois.filter(poi => poi.kind === 'campfire'
      && fireRemaining(poi.id, world.tick, campfires) > 0).map(poi => poi.id) } : {}),
  };
}

/** This stream only paints scenery; it never touches entity dice or the world generator. */
export function landscapeRandom(seed: string): () => number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
