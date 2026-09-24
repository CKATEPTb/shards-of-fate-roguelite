import { activeEquipmentSetAuras, startHeroBody } from '@shards/game-core';
import { equipmentItemFitsSlot, REWARD_RARITIES, SEASON_BOSS_ORDER, type EquipmentSlot, type GameContent, type RoamingCategory } from '@shards/shared';
import { adventureRewardEntries } from '../../../packages/game-core/src/coop/rewards';
import { equipmentLootPool, featuredEquipmentSetIds } from '../../../packages/game-core/src/coop/equipment-loot-pool';
import { equippedHero } from '../../../packages/game-core/src/coop/progression';
import { seasonBossPool } from '../../../packages/game-core/src/coop/bosses';
import { patrolEnemyPools, wellEnemyPool } from '../../../packages/game-core/src/roaming/population';
import { worldProfile } from '../../../packages/game-core/src/world/profile';
import { seasonAt } from '../../../packages/game-core/src/world/grid';
import { traceAuraReachability } from './aura-reachability';

/** Fast production-pool gate. Seeded generation/combat tests supply execution evidence separately. */
export function auditContentAvailability(content: GameContent) {
  const enemyRoutes = new Map<string, string>();
  const addEnemy = (id: string, route: string) => { if (!enemyRoutes.has(id)) enemyRoutes.set(id, route); };
  const categories: RoamingCategory[] = ['normal', 'epic', 'miniboss'];
  const considered = new Set<string>();
  // Every coordinate on this spoke exists and is connected in the world generator.
  for (let index = 0; index < 4; index++) {
    const seed = `content-availability-${index}`, profile = worldProfile(seed);
    for (let distance = 0; distance <= profile.radius; distance++) {
      const season = seasonAt({ x: distance, y: 0 }, profile), band = `${season}:${distance}`;
      if (considered.has(band)) continue;
      considered.add(band);
      for (const habitat of ['surface', 'basement'] as const) for (const category of categories) {
        if (distance < 4 && category !== 'normal') continue;
        const allowed = category === 'normal' || Object.values(content.difficulties ?? {}).some(profile =>
          (category === 'epic' ? profile.epicGroupChance : profile.minibossChunkChance) > 0);
        if (!allowed) continue;
        for (const roll of [1, 20]) {
          const pools = patrolEnemyPools(content, season, habitat, distance, category, roll);
          for (const entry of pools.leaders) {
            // Starting patrols have only one or two members, leaving no healer slot.
            if (distance < 4 && entry.enemy.role === 'healer') continue;
            addEnemy(entry.enemy.id, `${seed}/${distance},0/${habitat}/${category}/leader`);
          }
          for (const entry of pools.escorts) addEnemy(entry.enemy.id, `${seed}/${distance},0/${habitat}/${category}/escort`);
        }
      }
      for (const roll of [1, 2, 20]) for (const enemy of wellEnemyPool(content, season, distance, roll)) {
        addEnemy(enemy.id, `${seed}/${distance},0/well/d20=${roll}`);
      }
    }
  }
  for (const season of SEASON_BOSS_ORDER) for (const enemy of seasonBossPool(content, season)) addEnemy(enemy.id, `season-boss/${season}`);

  const catalog = content.equipmentCatalog;
  const itemIds = new Set<string>();
  const skillIds = new Set<string>();
  const itemCounts: Record<string, number> = {};
  for (const rarity of REWARD_RARITIES) {
    const available = adventureRewardEntries(content, 'equipment', rarity);
    const items = catalog ? available.flatMap(item => catalog.items[item.id] ? [catalog.items[item.id]] : []) : [];
    const pool = catalog ? equipmentLootPool(items, featuredEquipmentSetIds(catalog, 'content-availability', content.characters[0].id, rarity), 5) : [];
    pool.forEach(item => itemIds.add(item.id));
    itemCounts[rarity] = pool.length;
    adventureRewardEntries(content, 'skill', rarity).forEach(skill => skillIds.add(skill.id));
  }
  const allItems = Object.values(catalog?.items ?? {});
  const invalidSlots = allItems.filter(item => !equipmentItemFitsSlot(item, item.slot === 'hand' ? 'rightHand' : item.slot)).map(item => item.id);
  const sets = Object.values(catalog?.sets ?? {}).filter(set => set.bonuses?.length);
  const setIssues: string[] = [];
  const allSetAuraIds = new Set(sets.flatMap(set => set.bonuses!.flatMap(bonus => bonus.aura ? [bonus.aura.id] : [])));
  const activeSetAuraIds = new Set<string>();
  for (const set of sets) {
    const equipment = Object.entries(set.loadout ?? {}).map(([slot, itemId]) => ({ slot: slot as EquipmentSlot, itemId: itemId! }));
    if (!equipment.length || equipment.some(entry => !itemIds.has(entry.itemId))) { setIssues.push(set.id); continue; }
    try {
      const hero = equippedHero(content.characters[0], { equipment, skills: [null, null] }, content);
      const actual = activeEquipmentSetAuras(hero, startHeroBody(hero));
      for (const entry of actual) activeSetAuraIds.add(entry.aura.id);
      if (set.bonuses!.some(bonus => bonus.aura && !actual.some(entry => entry.aura.id === bonus.aura!.id))) setIssues.push(set.id);
    } catch { setIssues.push(set.id); }
  }
  const aura = traceAuraReachability(content, { unitIds: new Set([...content.characters.map(hero => hero.id), ...enemyRoutes.keys()]), skillIds });
  const missing = {
    enemies: content.enemies.filter(enemy => !enemyRoutes.has(enemy.id)).map(enemy => enemy.id),
    items: allItems.filter(item => !itemIds.has(item.id)).map(item => item.id),
    skills: content.skills.filter(skill => skill.rarity && !skillIds.has(skill.id)).map(skill => skill.id),
    auras: aura.unreachableStatusIds,
    setAuras: [...allSetAuraIds].filter(id => !activeSetAuraIds.has(id)),
    sets: setIssues, invalidSlots,
  };
  return { valid: Object.values(missing).every(ids => ids.length === 0),
    counts: { enemies: content.enemies.length, bosses: content.enemies.filter(enemy => enemy.tags.includes('BOSS')).length,
      items: allItems.length, itemsByRarity: itemCounts, sets: sets.length, learnedSkills: skillIds.size,
      auras: content.statuses.length, setAuras: allSetAuraIds.size },
    missing, enemyRoutes: Object.fromEntries(enemyRoutes), auraRoutes: aura.routes };
}

export function assertContentAvailability(content: GameContent) {
  const result = auditContentAvailability(content);
  if (!result.valid) throw new Error(`Content unavailable in play: ${Object.entries(result.missing)
    .filter(([, ids]) => ids.length).map(([kind, ids]) => `${kind}: ${ids.join(', ')}`).join('; ')}`);
  return result;
}
