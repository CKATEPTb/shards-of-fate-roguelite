import type { Season } from './world';

export const SEASON_BOSS_ORDER = ['spring', 'summer', 'autumn', 'winter'] as const;
export const SEASON_BOSS_INTERVAL_MS = 20 * 60 * 1000;

export interface SeasonBossSpawn {
  season: Season;
  enemyId: string;
  mobId: string;
  chunkId: string;
  actorId: string;
  summonedAtTick: number;
  trigger: 'timer' | 'altar';
}

/** Active-game ticks pause when the host leaves. Each seasonal summon happens once. */
export interface SeasonBossProgress {
  nextAtTick: number | null;
  spawned: SeasonBossSpawn[];
}
