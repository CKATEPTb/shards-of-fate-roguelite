import type { EnemyDefinition, GameContent, RoamingCategory, Season } from '@shards/shared';

export type EnemyHabitat = 'surface' | 'basement' | 'aquatic';

export function enemyPopulationTier(distance: number): number {
  return distance < 4 ? 1 : distance < 10 ? 2 : distance < 20 ? 3 : distance < 35 ? 4 : 5;
}

/** The production population filter, shared by patrols, wells and catalog audits. */
export function enemyPopulationPool(content: GameContent, season: Season, habitat: EnemyHabitat): EnemyDefinition[] {
  return content.enemies.filter(enemy => enemy.tags.includes('ACT_1') && !enemy.tags.includes('BOSS')
    && enemy.tags.includes(`SEASON_${season.toUpperCase()}`)
    && (enemy.tags.includes('AQUATIC') ? 'aquatic' : enemy.tags.includes('BASEMENT') ? 'basement' : 'surface') === habitat
    && enemy.tags.some(tag => /^TIER_[1-5]$/.test(tag)));
}

export interface PatrolPopulationEntry { enemy: EnemyDefinition; family: string; tier: number; pack: boolean }

/** Exact production branches: leaders stay in their distance band, escorts never exceed it. */
export function patrolEnemyPools(content: GameContent, season: Season, habitat: 'surface' | 'basement', distance: number,
  category: RoamingCategory, populationRoll: number): { leaders: PatrolPopulationEntry[]; escorts: PatrolPopulationEntry[] } {
  const entries = enemyPopulationPool(content, season, habitat).flatMap(enemy => {
    const family = enemy.tags.find(tag => tag.startsWith('FAMILY_'))?.slice(7);
    const tier = Number(enemy.tags.find(tag => /^TIER_[1-5]$/.test(tag))?.slice(5));
    return family && tier ? [{ enemy, family, tier, pack: enemy.tags.includes('PACK') }] : [];
  });
  const baseTier = enemyPopulationTier(distance);
  const veteran = category === 'miniboss' && populationRoll === 20;
  const targetTier = Math.min(5, baseTier + (category === 'normal' ? 0 : veteran ? 2 : 1));
  const nearest = Math.min(...entries.map(entry => Math.abs(entry.tier - targetTier)));
  const leaders = entries.filter(entry => Math.abs(entry.tier - targetTier) === nearest);
  const families = new Set(leaders.map(entry => entry.family));
  const escorts = distance < 4 ? [] : entries.filter(entry => families.has(entry.family) && entry.tier < targetTier);
  return { leaders, escorts };
}

/** Most wells retain the distance band; rare rolls reveal younger or older local creatures. */
export function wellEnemyPool(content: GameContent, season: Season, distance: number, populationRoll: number): EnemyDefinition[] {
  const aquatic = enemyPopulationPool(content, season, 'aquatic');
  const tier = enemyPopulationTier(distance);
  const preferred = aquatic.filter(enemy => {
    const rank = Number(enemy.tags.find(tag => /^TIER_[1-5]$/.test(tag))?.slice(5));
    if (populationRoll === 1) return rank < tier;
    if (populationRoll === 20) return distance >= 4 && rank > tier && rank <= Math.min(5, tier + 2);
    return rank === tier;
  });
  const usual = aquatic.filter(enemy => enemy.tags.includes(`TIER_${tier}`));
  return preferred.length ? preferred : usual.length ? usual : aquatic;
}
