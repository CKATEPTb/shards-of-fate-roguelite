import type { CombatState } from './model';
import type { ExplorationState } from './world';
import type { RoamingEncounter, RoamingGroup } from './roaming';
import type { DifficultyId } from './difficulty';
import type { AdventureProgress } from './adventure';
import type { CoopState } from './coop';
import type { GameContent } from './model';
import type { SeasonBossProgress } from './bosses';

export interface RoamingState {
  version: 1;
  chunks: Record<string, RoamingGroup[]>;
  battleSerial: number;
  active: RoamingEncounter | null;
}

export interface ExpeditionState {
  bosses?: SeasonBossProgress;
  /** Solo uses exactly the room simulation. Network projections omit this reference. */
  cooperative?: CoopState;
  progression?: AdventureProgress;
  /** Derived render definitions; never serialized as world state. */
  content?: GameContent;
  version: 1;
  readonly difficultyId?: DifficultyId;
  world: ExplorationState;
  clearedPoiIds: string[];
  activePoiId: string | null;
  combat: CombatState | null;
  completed: boolean;
  /** Per-hero dice progress; enemies retain counters only in an active battle. */
  diceCounters?: Record<string, number>;
  /** A lost expedition never silently heals or resurrects its party. */
  failed?: boolean;
  /** Absent only in legacy saves and their unfinished static battles. */
  roaming?: RoamingState;
}
