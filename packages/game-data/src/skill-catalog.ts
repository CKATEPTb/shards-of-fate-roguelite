import type { SkillDefinition, SkillRarity } from '@shards/shared';
import { lifeSkills } from './skill-catalog-life';
import { elementalSkills } from './skill-catalog-elements';
import { mysticSkills } from './skill-catalog-mystic';
import { lifeExpansionSkills } from './skill-catalog-life-expansion';
import { elementalExpansionSkills } from './skill-catalog-elements-expansion';
import { legendarySupportSkills } from './skill-catalog-legends-support';
import { legendaryOffenseSkills } from './skill-catalog-legends-offense';
import { lifeProportionalSkills } from './skill-catalog-life-proportional';
import { elementalProportionalSkills } from './skill-catalog-elements-proportional';
import { mysticProportionalSkills } from './skill-catalog-mystic-proportional';

/** 400 learnable definitions across 15 schools: 160 common, 120 rare, 80 epic, 40 legendary. */
export const additionalSkills: SkillDefinition[] = [
  ...lifeSkills, ...elementalSkills, ...mysticSkills, ...lifeExpansionSkills, ...elementalExpansionSkills,
  ...legendarySupportSkills, ...legendaryOffenseSkills,
  ...lifeProportionalSkills, ...elementalProportionalSkills, ...mysticProportionalSkills,
];

/** Stable content order; selecting a reward from these pools belongs to the seeded loot system. */
export const skillPoolsByRarity: Record<SkillRarity, SkillDefinition[]> = {
  common: additionalSkills.filter(skill => skill.rarity === 'common'),
  rare: additionalSkills.filter(skill => skill.rarity === 'rare'),
  epic: additionalSkills.filter(skill => skill.rarity === 'epic'),
  legendary: additionalSkills.filter(skill => skill.rarity === 'legendary'),
};
