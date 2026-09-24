import type { RewardRarity } from './rewards';

export type NpcSkillSlot = 'class' | 'active' | 'passive' | 'skill0' | 'skill1';
export interface NpcOffer {
  id: string;
  kind: 'set' | 'skill';
  definitionId: string;
  rarity: RewardRarity;
  price: number;
}

/** Prices are shared by the preview and the authoritative transaction. */
export const NPC_SET_PRICES: Record<RewardRarity, number> = { common: 180, rare: 500, epic: 1200, legendary: 3000 };
export const NPC_SKILL_PRICES: Record<RewardRarity, number> = { common: 40, rare: 120, epic: 320, legendary: 800 };
export const NPC_EQUIPMENT_UPGRADE_PRICES: Record<RewardRarity, number> = { common: 0, rare: 80, epic: 220, legendary: 600 };
export const NPC_SKILL_UPGRADE_PRICES: Record<RewardRarity, number> = { common: 0, rare: 120, epic: 320, legendary: 800 };
