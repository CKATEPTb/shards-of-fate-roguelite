import type { DifficultyId } from './difficulty';
import type { CombatChoice, CombatState } from './model';
import type { RoamingGroup } from './roaming';
import type { GridPoint, WorldActor } from './world';
import type { EquipmentSlot } from './anatomy';
import type { AdventureProgress, HeroLoadout, InventoryTarget, RewardResolution } from './adventure';
import type { SeasonBossProgress } from './bosses';
import type { NpcSkillSlot } from './npc';

/** Visual light size; combat recruitment uses walkable path length separately. */
export const HERO_LIGHT_RADIUS_TILES = 10;
export const WORLD_TILE_PIXELS = 32;

export interface CoopActor extends WorldActor {
  chunkId: string;
  visited: string[];
  transitions: number;
}

export interface CoopBattle {
  loadouts?: Record<string, HeroLoadout>;
  id: string;
  chunkId: string;
  actorIds: string[];
  /** Original party determines enemy scaling after late reinforcements arrive. */
  initialActorIds?: string[];
  /** Ordered exactly like combat.enemyIds, including repeated enemy definitions. */
  mobIds: string[];
  initiatorActorId: string;
  initiatorMobId: string;
  combat: CombatState;
  /** Duration of the last transition's complete presentation, including initiative dice. */
  presentationMs?: number;
  presentationUntilTick?: number;
  /** Absolute room tick; a pending hero decision keeps this deadline across reconnects. */
  choiceDeadlineTick?: number;
  elapsedMs: number;
}

/** Geometry is derived from seed; only persistent simulation changes live here. */
export interface CoopState {
  bosses?: SeasonBossProgress;
  worldVersion?: 1 | 2 | 3;
  progression?: AdventureProgress;
  version: 1;
  /** Exact simulation content; absent only in old room checkpoints. */
  readonly contentHash?: string;
  readonly seed: string;
  readonly difficultyId: DifficultyId;
  readonly characterIds: readonly string[];
  tick: number;
  /** Diagnostic total only; outcomes use the owning entity's counter. */
  diceIndex: number;
  /** Persistent hero counters only. Enemy counters belong to their current combat. Absent in legacy saves. */
  diceCounters?: Record<string, number>;
  actors: CoopActor[];
  groups: Record<string, RoamingGroup[]>;
  battles: CoopBattle[];
  killedEnemyIds: string[];
  interactedStructureIds: string[];
  removedRewardIds: string[];
  completed: boolean;
  failed: boolean;
}

export type CoopCommand =
  | { type: 'revive'; chunkId: string; targetActorId: string; expectedReviveUntilTick: number }
  | { type: 'npc-buy'; chunkId: string; poiId: string; offerId: string }
  | { type: 'npc-upgrade-equipment'; chunkId: string; poiId: string; slot: EquipmentSlot; expectedItemId: string }
  | { type: 'npc-upgrade-skill'; chunkId: string; poiId: string; slot: NpcSkillSlot; expectedId: string; expectedRarity: import('./rewards').RewardRarity }
  | { type: 'interact'; chunkId: string; poiId: string }
  | { type: 'equip'; selections: { rewardId: string; slot: EquipmentSlot }[] }
  | { type: 'learn'; rewardId: string; slot: 0 | 1 }
  | { type: 'discard-reward'; rewardId: string }
  | { type: 'collect-reward'; rewardId: string }
  | { type: 'collect-rewards'; rewardIds: string[] }
  | { type: 'equip-inventory'; inventoryId: string; slot: InventoryTarget }
  | { type: 'set-auto-equipment'; enabled: boolean }
  | ({ type: 'resolve-rewards' } & RewardResolution)
  | { type: 'move'; chunkId: string; x: number; y: number; from?: GridPoint; fromElapsedMs?: number }
  | { type: 'rest'; chunkId: string; poiId: string }
  | { type: 'battle'; battleId: string; action: 'continue' }
  | { type: 'battle'; battleId: string; action: 'choose'; choice: CombatChoice; expectedTurn?: number };

export interface CoopDiceAdvance { ownerId: string; index: number; nextIndex: number }

export type CoopEvent =
  | { type: 'revive'; actorId: string; chunkId: string; targetActorId: string; expectedReviveUntilTick: number }
  | { type: 'npc-service'; actorId: string; command: Extract<CoopCommand, { type: 'npc-buy' | 'npc-upgrade-equipment' | 'npc-upgrade-skill' }> }
  | { type: 'boss-summon' }
  | { type: 'interact'; actorId: string; chunkId: string; poiId: string }
  | { type: 'loadout'; actorId: string; command: Extract<CoopCommand, { type: 'equip' | 'learn' | 'discard-reward' | 'resolve-rewards' | 'collect-reward' | 'collect-rewards' | 'equip-inventory' | 'set-auto-equipment' }> }
  | { type: 'campfire-lit'; poiId: string; tick: number }
  | { type: 'motion'; entity: 'actor' | 'mob'; id: string; chunkId: string; groupId?: string; from: GridPoint; to: GridPoint | null; elapsedMs: number }
  | { type: 'group'; chunkId: string; groupId: string; mode: RoamingGroup['mode']; targetActorId: string | null; decision: number; pauseMs: number }
  | { type: 'chunk-enter'; actorId: string; fromChunkId: string; chunkId: string; position: GridPoint }
  | { type: 'battle-start'; battleId: string; chunkId: string; actorIds: string[]; mobIds: string[]; enemyIds: string[]; initiatorActorId: string; initiatorMobId: string; diceIndex: number }
  | { type: 'battle-join'; battleId: string; actorIds: string[] }
  | { type: 'battle-step'; battleId: string; diceIndex: number; nextDiceIndex: number; elapsedMs: number; dice?: CoopDiceAdvance[] }
  | { type: 'battle-action'; battleId: string; choice: CombatChoice; diceIndex: number; nextDiceIndex: number; elapsedMs: number; dice?: CoopDiceAdvance[] }
  | { type: 'battle-timeout'; battleId: string; actorId: string; turn: number; diceIndex: number; nextDiceIndex: number; elapsedMs: number; dice?: CoopDiceAdvance[] }
  | { type: 'battle-end'; battleId: string }
  | { type: 'rest'; actorId: string; chunkId: string; poiId: string }
  | { type: 'structure'; actorId: string; chunkId: string; structureId: string; completed?: boolean }
  | { type: 'reward'; rewardId: string; outcome: 'taken' | 'skipped' };

/** Events are discontinuities, never per-tick snapshots of actors or groups. */
export interface CoopInputAcknowledgement { memberId: string; inputId: number; accepted: boolean; reason?: string }
export interface CoopFrame { tick: number; diceIndex: number; events: CoopEvent[]; acknowledgements?: CoopInputAcknowledgement[] }
export interface CoopResult { state: CoopState; events: CoopEvent[]; accepted?: boolean; reason?: string }

export interface CoopEncounterPreview {
  actorIds: string[];
  mobIds: string[];
  enemyIds: string[];
  groupIds: string[];
  actorId: string;
  mobId: string;
}
