import type { EnemyDefinition, Season, SkillDefinition } from '@shards/shared';
import { springBossCatalog } from './boss-catalog-spring';
import { summerBossCatalog } from './boss-catalog-summer';
import { autumnBossCatalog } from './boss-catalog-autumn';
import { winterBossCatalog } from './boss-catalog-winter';
import { bossSupportSkills } from './boss-catalog-skills';

/** Exactly 50 authored encounters: 13 spring, 13 summer, 12 autumn, 12 winter. */
export const actOneBosses: EnemyDefinition[] = [
  ...springBossCatalog.enemies, ...summerBossCatalog.enemies,
  ...autumnBossCatalog.enemies, ...winterBossCatalog.enemies,
];

/** 50 signature actions plus 16 enemy-only support actions. Existing hero kits remain untouched. */
export const bossSkills: SkillDefinition[] = [
  ...springBossCatalog.skills, ...summerBossCatalog.skills,
  ...autumnBossCatalog.skills, ...winterBossCatalog.skills, ...bossSupportSkills,
];

export const actOneBossPoolsBySeason: Record<Season, EnemyDefinition[]> = {
  spring: springBossCatalog.enemies, summer: summerBossCatalog.enemies,
  autumn: autumnBossCatalog.enemies, winter: winterBossCatalog.enemies,
};

export interface ActOneBossMetadata { season: Season; signatureSkillId: string }

/** Tags also support seeded room generation with externally supplied GameContent. */
export function actOneBossMetadata(enemy: EnemyDefinition): ActOneBossMetadata | undefined {
  if (!enemy.tags.includes('ACT_1') || !enemy.tags.includes('BOSS')) return undefined;
  const season = (['spring', 'summer', 'autumn', 'winter'] as const)
    .find(value => enemy.tags.includes(`SEASON_${value.toUpperCase()}`));
  return season ? { season, signatureSkillId: enemy.skillIds[0] } : undefined;
}
