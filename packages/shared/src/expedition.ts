import type { CombatState } from './model';
import type { ExplorationState } from './world';
import type { RoamingEncounter, RoamingGroup } from './roaming';
import type { DifficultyId } from './difficulty';

export interface RoamingState {
  version: 1;
  chunks: Record<string, RoamingGroup[]>;
  battleSerial: number;
  active: RoamingEncounter | null;
}

export interface ExpeditionState {
  version: 1;
  readonly difficultyId?: DifficultyId;
  world: ExplorationState;
  clearedPoiIds: string[];
  activePoiId: string | null;
  combat: CombatState | null;
  completed: boolean;
  /** A lost expedition never silently heals or resurrects its party. */
  failed?: boolean;
  /** Absent only in legacy saves and their unfinished static battles. */
  roaming?: RoamingState;
}
