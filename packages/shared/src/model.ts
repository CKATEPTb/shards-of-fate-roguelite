import type { BodyPart, HeroAnatomy, HeroBody } from './anatomy';
import type { DifficultyId, DifficultyProfile } from './difficulty';

export const SCHEMA_VERSION = 1 as const;
export const RNG_STREAMS = ['WORLD', 'COMBAT', 'LOOT', 'ENCOUNTER', 'EVENT'] as const;
export type RngStream = typeof RNG_STREAMS[number];
export interface RngState { seed: string; streams: Record<RngStream, { state: number; counter: number }> }
export type Team = 'heroes' | 'enemies';
export type Role = 'tank' | 'healer' | 'damage';
export type TargetSelector = 'self' | 'enemy' | 'lowestHealthEnemy' | 'lowestHealthAlly' | 'allAllies' | 'allEnemies' | 'eventTarget';
export interface Stats { maxHp: number; power: number; armor: number; initiative: number; crit: number; evasion: number; healing: number }
export interface Modifiers {
  damageMultiplier?: number; damageReduction?: number; partyDamageReduction?: number; taunt?: boolean;
  vampirism?: number; healingShare?: number; preserveHotChance?: number; preserveShieldChance?: number;
  guaranteedCrit?: boolean; evasionBonus?: number; repeatChance?: number;
}
export interface ActionDefinition {
  type: 'damage' | 'heal' | 'shield' | 'status';
  dice?: string;
  scaling?: 'power' | 'healing';
  factor?: number;
  statusId?: string;
  duration?: number;
  target?: TargetSelector;
  scaleWithRemainingDuration?: boolean;
}
export interface SkillDefinition {
  schemaVersion: 1; id: string; name: string; description: string;
  cooldown: number; priority: number; target: TargetSelector;
  condition: 'always' | 'allyWounded' | 'selfWounded' | 'hasOtherAlly';
  actions: ActionDefinition[]; tags: string[];
}
export type CombatEventType = 'COMBAT_STARTED' | 'ROUND_STARTED' | 'TURN_STARTED' | 'SKILL_USED' | 'ATTACK_STARTED' | 'DICE_ROLLED' | 'HIT' | 'MISS' | 'CRIT' | 'DAMAGE' | 'HEALED' | 'OVERHEALED' | 'SHIELD_CREATED' | 'SHIELD_BROKEN' | 'STATUS_APPLIED' | 'STATUS_EXPIRED' | 'ENTITY_DIED' | 'TURN_ENDED' | 'COMBAT_ENDED';
export interface EffectDefinition {
  schemaVersion: 1; id: string; name: string; description: string;
  trigger: CombatEventType;
  conditions: ('sourceIsOwner' | 'targetIsOwner' | 'targetIsAlly' | 'ownerAlive')[];
  target: TargetSelector; actions: ActionDefinition[]; priority: number;
  internalCooldown: number; tags: string[];
}
export interface StatusDefinition {
  schemaVersion: 1; id: string; name: string; description: string; color: string;
  trigger?: 'TURN_STARTED' | 'TURN_ENDED'; actions: ActionDefinition[];
  modifiers: Modifiers; tags: string[];
}
export interface UnitDefinition {
  schemaVersion: 1; id: string; name: string; title: string; description: string;
  role: Role; color: string; sprite: string; stats: Stats;
  /** Exploration speed as a percentage of the standard walking pace; defaults to 100. */
  movementSpeed?: number;
  anatomy?: HeroAnatomy;
  passive?: { name: string; description: string };
  basicAttack: ActionDefinition; skillIds: string[]; effectIds: string[];
  modifiers: Modifiers; tags: string[];
}
export interface EnemyDefinition extends UnitDefinition { rank: 'NORMAL' | 'SWARM' | 'VETERAN' | 'ELITE'; encounterCost: number }
export interface EncounterDefinition { schemaVersion: 1; id: string; name: string; description: string; biome: string; difficulty: string; enemyIds: string[] }
export interface GameContent {
  schemaVersion: 1; characters: UnitDefinition[]; enemies: EnemyDefinition[];
  difficulties?: Record<DifficultyId, DifficultyProfile>;
  skills: SkillDefinition[]; effects: EffectDefinition[]; statuses: StatusDefinition[];
  encounters: EncounterDefinition[];
  balance: { maxRounds: number; maxTriggerDepth: number; maxEventsPerStep: number; maxDamageReduction: number; armorFactor: number; critMultiplier: number; healThreshold: number; partyScaling: Record<number, { hp: number; damage: number }> };
}
export interface ActiveStatus { id: string; sourceId: string; remaining: number; appliedTurn: number }
export interface ShieldLayer { sourceId: string; capacity: number; remaining: number; appliedTurn: number }
export interface Combatant { id: string; definitionId: string; name: string; team: Team; stats: Stats; hp: number; body?: HeroBody; shield: number; shieldLayers?: ShieldLayer[]; cooldowns: Record<string, number>; effectCooldowns: Record<string, number>; statuses: ActiveStatus[]; turnsTaken: number }
export interface CombatEvent { sequence: number; turn: number; round: number; type: CombatEventType; actorId?: string; targetId?: string; skillId?: string; statusId?: string; bodyPart?: BodyPart; amount?: number; rolls?: number[]; sides?: number; modifier?: number; message: string }
export interface CombatState {
  schemaVersion: 1; contentHash: string; seed: string; encounterId: string; characterIds: string[];
  readonly difficultyId?: DifficultyId;
  /** Exact ordered roster for roaming encounters; omitted for static encounters. */
  enemyIds?: string[];
  status: 'ready' | 'running' | 'victory' | 'defeat' | 'draw';
  round: number; turn: number; turnOrder: string[]; turnIndex: number;
  units: Combatant[]; rng: RngState; events: CombatEvent[]; nextSequence: number;
}
export interface CombatOptions { seed: string; characterIds: string[]; encounterId: string; enemyIds?: string[]; heroBodies?: Record<string, HeroBody>; difficultyId?: DifficultyId }
export interface DiceResult { expression: string; rolls: number[]; sides: number; modifier: number; total: number }
