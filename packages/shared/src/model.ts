import type { BodyPart, HeroAnatomy, HeroBody } from './anatomy';
import type { DifficultyId, DifficultyProfile } from './difficulty';
import type { AttackHand, AttackSlot } from './weapons';
import type { AuraVisualDefinition, ProjectileKind } from './auras';
import type { SkillIconDefinition, SkillRarity } from './skills';
import type { AdventureCatalog } from './adventure';

export const SCHEMA_VERSION = 1 as const;
export const RNG_STREAMS = ['WORLD', 'COMBAT', 'LOOT', 'ENCOUNTER', 'EVENT'] as const;
export type RngStream = typeof RNG_STREAMS[number];
export interface RngState {
  seed: string;
  streams: Record<RngStream, { state: number; counter: number }>;
  /** Indexed sequence position, or aggregate diagnostic count when entityDice is present. Legacy saves omit it. */
  diceIndex?: number;
  /** Stable entity identity for one scoped sequence; its own diceIndex selects each result. */
  diceOwner?: string;
  /** Combat-local IDs resolve to persistent entity identities with independent counters. */
  entityDice?: { owners: Record<string, string>; counters: Record<string, number> };
}
export type Team = 'heroes' | 'enemies';
export type Role = 'tank' | 'healer' | 'damage';
export const TARGET_SELECTORS = ['self', 'enemy', 'ally', 'lowestHealthEnemy', 'lowestHealthAlly', 'allAllies', 'allEnemies', 'eventTarget', 'any', 'randomEnemy', 'randomAlly', 'randomUnit'] as const;
export type TargetSelector = typeof TARGET_SELECTORS[number];
/** Ratings use independent d20 checks. Armor belongs to a struck part; bodyless enemies use armor here. */
export interface Stats {
  maxHp: number; power: number; armor: number; initiative: number; crit: number; evasion: number;
  agility?: number; accuracy?: number; resilience?: number; luck?: number;
  /** @deprecated Legacy input only. Current actions use power for damage, healing and shields. */
  healing?: number;
}
export interface DiceCheck { dice: string; atLeast: number }
export interface Modifiers {
  damageBonus?: number; damageReduction?: number; partyDamageReduction?: number; taunt?: boolean;
  vampirismDice?: string; healingShareDice?: string; preserveHot?: DiceCheck; preserveShield?: DiceCheck;
  guaranteedCrit?: boolean; evasionBonus?: number; repeatAttack?: DiceCheck;
  initiativeBonus?: number; agilityBonus?: number;
  accuracyBonus?: number; critBonus?: number; armorBonus?: number; powerBonus?: number; resilienceBonus?: number; luckBonus?: number;
  /** @deprecated Legacy input only; authored auras now use powerBonus. */
  healingBonus?: number;
  damageBonusDice?: string; partyGuardDice?: string; invulnerable?: boolean;
}
export interface ActionDefinition {
  type: 'damage' | 'heal' | 'shield' | 'status';
  dice?: string;
  scaling?: 'power' | 'healing';
  factor?: number;
  statusId?: string;
  /** Null means indefinite; a number counts the bearer's own turns. */
  duration?: number | null;
  target?: TargetSelector;
  /** Apply this action only when the resolved target has this relation to its caster. */
  targetRelation?: 'ally' | 'enemy';
  scaleWithRemainingDuration?: boolean;
  /** Independent hits, with separate accuracy and damage rolls. */
  hits?: number;
  onHitStatusId?: string;
  onHitDuration?: number | null;
  /** Fixed periodic damage from a decaying pool of aura stacks. */
  damagePerStack?: number;
  bypassArmor?: boolean;
}
export interface SkillDefinition {
  schemaVersion: 1; id: string; name: string; description: string;
  cooldown: number; priority: number; target: TargetSelector;
  condition: 'always' | 'allyWounded' | 'selfWounded' | 'hasOtherAlly';
  actions: ActionDefinition[]; tags: string[];
  /** Acquisition tier for learnable skills; innate hero/enemy skills have no rarity. */
  rarity?: SkillRarity;
  icon?: SkillIconDefinition;
  projectile?: ProjectileKind;
}
export type CombatEventType = 'COMBAT_STARTED' | 'ROUND_STARTED' | 'TURN_STARTED' | 'SKILL_USED' | 'ATTACK_STARTED' | 'DICE_ROLLED' | 'HIT' | 'MISS' | 'CRIT' | 'BLOCKED' | 'DAMAGE' | 'HEALED' | 'OVERHEALED' | 'SHIELD_CREATED' | 'SHIELD_UPDATED' | 'SHIELD_BROKEN' | 'STATUS_APPLIED' | 'STATUS_UPDATED' | 'STATUS_EXPIRED' | 'FLEE_SUCCEEDED' | 'FLEE_FAILED' | 'ENTITY_DIED' | 'TURN_ENDED' | 'COMBAT_ENDED';
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
  polarity?: 'positive' | 'negative';
  /** Stacks are independent instances unless this definition explicitly refreshes. */
  stacking?: 'independent' | 'refresh' | 'decay';
  expiresAt?: 'TURN_STARTED' | 'TURN_ENDED';
  /** Suggested length when this aura is authored into a future item or skill. */
  defaultDuration?: number | null;
  visual?: AuraVisualDefinition;
}
export interface UnitDefinition {
  schemaVersion: 1; id: string; name: string; title: string; description: string;
  role: Role; color: string; sprite: string; stats: Stats;
  /** Exploration speed as a percentage of the standard walking pace; defaults to 100. */
  movementSpeed?: number;
  anatomy?: HeroAnatomy;
  passive?: { name: string; description: string; rarity?: SkillRarity };
  basicAttack: ActionDefinition; skillIds: string[]; effectIds: string[];
  modifiers: Modifiers; tags: string[];
}
export interface EnemyDefinition extends UnitDefinition { rank: 'NORMAL' | 'SWARM' | 'VETERAN' | 'ELITE'; encounterCost: number; level?: number }
export interface EncounterDefinition { schemaVersion: 1; id: string; name: string; description: string; biome: string; difficulty: string; enemyIds: string[] }
export interface GameContent {
  equipmentCatalog?: AdventureCatalog;
  schemaVersion: 1; characters: UnitDefinition[]; enemies: EnemyDefinition[];
  difficulties?: Record<DifficultyId, DifficultyProfile>;
  skills: SkillDefinition[]; effects: EffectDefinition[]; statuses: StatusDefinition[];
  encounters: EncounterDefinition[];
  balance: { maxRounds: number; maxTriggerDepth: number; maxEventsPerStep: number; maxDamageReduction: number; armorFactor: number; healThreshold: number; partyScaling: Record<number, { hp: number; damage: number }> };
}
export interface ActiveStatus { id: string; instanceId?: string; sourceId: string; remaining: number | null; appliedTurn: number; stacks?: number }
export interface ShieldLayer { sourceId: string; capacity: number; remaining: number; appliedTurn: number }
export interface Combatant { id: string; definitionId: string; name: string; team: Team; stats: Stats; hp: number; body?: HeroBody; shield: number; shieldLayers?: ShieldLayer[]; cooldowns: Record<string, number>; effectCooldowns: Record<string, number>; statuses: ActiveStatus[]; turnsTaken: number; escaped?: boolean }
export interface CombatEvent { sequence: number; turn: number; round: number; type: CombatEventType; actorId?: string; targetId?: string; skillId?: string; statusId?: string; statusInstanceId?: string; statusRemaining?: number | null; statusStacks?: number; bodyPart?: BodyPart; attackHand?: AttackHand; attackSlot?: AttackSlot; amount?: number; shieldAfter?: number; shieldLayersAfter?: ShieldLayer[]; rolls?: number[]; sides?: number; modifier?: number; rollReason?: string; message: string }
export interface CombatChoice { type: 'attack' | 'skill' | 'flee'; actorId: string; targetId?: string; skillId?: string }
export interface CombatState {
  schemaVersion: 1; contentHash: string; seed: string; encounterId: string; characterIds: string[];
  readonly difficultyId?: DifficultyId;
  /** Exact ordered roster for roaming encounters; omitted for static encounters. */
  enemyIds?: string[];
  status: 'ready' | 'running' | 'victory' | 'defeat' | 'draw' | 'escaped';
  /** A prepared hero turn waits here until its owner submits one action. */
  pendingActorId?: string;
  initiative?: Record<string, number>;
  round: number; turn: number; turnOrder: string[]; turnIndex: number;
  units: Combatant[]; rng: RngState; events: CombatEvent[]; nextSequence: number;
}
export interface CombatOptions { seed: string; characterIds: string[]; encounterId: string; enemyIds?: string[]; heroBodies?: Record<string, HeroBody>; difficultyId?: DifficultyId }
export interface DiceResult { expression: string; rolls: number[]; sides: number; modifier: number; total: number }
