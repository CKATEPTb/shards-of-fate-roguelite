import type { GridPoint, WorldActor } from './world';

export type RoamingCategory = 'normal' | 'epic' | 'miniboss';

/** A persistent member of a wandering group, using the same clock as a hero. */
export interface RoamingMob extends WorldActor { definitionId: string }

export interface RoamingGroup {
  id: string;
  category: RoamingCategory;
  /** Keen hunters notice heroes earlier; every group can pursue after a close approach. */
  chases: boolean;
  members: RoamingMob[];
  home: GridPoint;
  mode: 'patrol' | 'chase';
  targetActorId: string | null;
  /** Independent deterministic decision counter; never consumes combat RNG. */
  decision: number;
  pauseMs: number;
}

/** The one-time union of complete groups committed to a battle. */
export interface RoamingEncounter {
  groupIds: string[];
  mobId: string;
  actorId: string;
  enemyIds: string[];
  /** New encounters start at contact; absent only on legacy five-tile battle saves. */
  triggerRadius?: 1;
  /** New encounters also include every pack already pursuing the party in this chunk. */
  includePursuers?: true;
}
