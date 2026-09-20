import type { Season, WorldGraph } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';

export const GENERATOR_VERSION = 3;
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const MIN_SEASON_RINGS = 10;
export const MAX_SEASON_RINGS = 15;
export const MAX_WORLD_RADIUS = MAX_SEASON_RINGS * SEASONS.length;
export const MAX_WORLD_NODES = (MAX_WORLD_RADIUS * 2 + 1) ** 2;

export function worldProfile(seed: string): Pick<WorldGraph, 'seasonRings' | 'radius'> {
  const rng = createRng(`profile-v3:${hashString(seed)}`);
  const seasonRings = Object.fromEntries(SEASONS.map(season => [season,
    MIN_SEASON_RINGS + Math.floor(drawRandom(rng, 'WORLD') * (MAX_SEASON_RINGS - MIN_SEASON_RINGS + 1)),
  ])) as Record<Season, number>;
  return { seasonRings, radius: SEASONS.reduce((sum, season) => sum + seasonRings[season], 0) };
}

export function seasonBoundaries(profile: Pick<WorldGraph, 'seasonRings'>): number[] {
  let radius = 0;
  return SEASONS.map(season => radius += profile.seasonRings[season]);
}
