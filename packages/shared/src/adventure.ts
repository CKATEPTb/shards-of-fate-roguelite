import type { EquipmentItemDefinition, EquipmentSetDefinition, EquipmentSlot } from './anatomy';
import type { RewardLuckRoll, RewardRarity } from './rewards';

/** Objects require arrival at their walkable interaction point and a completed route. */
export const ADVENTURE_INTERACTION_STEPS = 0;

export interface AdventureCatalog {
  items: Readonly<Record<string, EquipmentItemDefinition>>;
  sets: Readonly<Record<string, EquipmentSetDefinition>>;
}
export interface HeroLoadout {
  equipment: { itemId: string; slot: EquipmentSlot }[];
  skills: [string | null, string | null];
  /** Missing in older saves: all three innate abilities start at common rarity. */
  nativeSkillRarities?: NativeSkillRarities;
}
export interface NativeSkillRarities { class: RewardRarity; active: RewardRarity; passive: RewardRarity }
export interface AdventureReward {
  id: string;
  kind: 'equipment' | 'skill';
  definitionId: string;
  rarity: RewardRarity;
  source: string;
  luckRolls: RewardLuckRoll[];
}
export type InventoryTarget = EquipmentSlot | 'skill0' | 'skill1';
/** One locally fitted choice; only this captured reward cohort is consumed on confirmation. */
export interface RewardResolution {
  equipment: { rewardId: string; slot: EquipmentSlot }[];
  skills: { rewardId: string; slot: 0 | 1 }[];
  /** Includes both equipped/learned rewards and the declined rewards visible when the choice opened. */
  rewardIds: string[];
}
export interface HeroProgress extends HeroLoadout {
  /** Personal preference; missing in older saves means manual equipment selection. */
  autoEquipment?: boolean;
  coins: number;
  rewards: AdventureReward[];
  /** Collected/returned finds, oldest arrival first. Preserve this order in saves; sort only UI copies. Missing in pre-inventory saves. */
  inventory?: AdventureReward[];
  /** Personal, idempotent sources: a well/chest/battle can pay this hero once. */
  claimedSources: string[];
  /** Fixed merchant offers are purchased once per hero, independently of other players. */
  npcPurchases?: string[];
}
export interface CampfireLifetime { litAtTick: number; expiresAtTick: number }
export interface AdventureProgress {
  heroes: Record<string, HeroProgress>;
  campfires: Record<string, CampfireLifetime>;
}
