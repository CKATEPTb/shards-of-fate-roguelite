import type { SkillRarity } from '@shards/shared';
import './skillRarity.css';

export const SKILL_RARITY_NAMES: Record<SkillRarity, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};

export const SKILL_RARITY_FILTER_NAMES: Record<SkillRarity, string> = {
  common: 'Обычные', rare: 'Редкие', epic: 'Эпические', legendary: 'Легендарные',
};

/** Keep the name visible: rarity should remain readable without distinguishing colors. */
export function SkillRarityBadge({ rarity }: { rarity?: SkillRarity }) {
  return rarity ? <span className="skill-rarity-badge" data-rarity={rarity}>
    <span aria-hidden="true">◆</span>{SKILL_RARITY_NAMES[rarity]}
  </span> : null;
}
