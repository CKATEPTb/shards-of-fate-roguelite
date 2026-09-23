import type { AuraVisualDefinition } from './auras';
import { REWARD_RARITIES } from './rewards';

/** Learnable skills share the same rarity ladder as equipment rewards. */
export const SKILL_RARITIES = REWARD_RARITIES;
export type SkillRarity = typeof SKILL_RARITIES[number];

export const SKILL_ICON_FRAMES = ['slash', 'burst', 'seal', 'rays', 'orbit', 'ward', 'weave', 'arrows'] as const;

/** Authored illustration data, independent of the aura a skill may apply. */
export interface SkillIconDefinition {
  family: AuraVisualDefinition['family'];
  frame: typeof SKILL_ICON_FRAMES[number];
  motif: AuraVisualDefinition['motif'];
  accent?: AuraVisualDefinition['motif'];
  colors: [string, string, string];
  variant: number;
}
