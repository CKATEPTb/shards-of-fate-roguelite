import { describe, expect, it } from 'vitest';
import { CATALOG_EQUIPMENT_SETS, gameContent } from '@shards/game-data';
import { createCoopState } from '@shards/game-core';
import { equipmentItemFitsSlot, type EquipmentSlot } from '@shards/shared';
import { equipmentLootPool, featuredEquipmentSetIds } from '../packages/game-core/src/coop/equipment-loot-pool';
import { adventureRewardEntries, awardAdventureLoot, coopRewardId } from '../packages/game-core/src/coop/rewards';
import { equippedHero } from '../packages/game-core/src/coop/progression';
import { activeEquipmentSetAuras } from '../packages/game-core/src/equipment-sets';
import { startHeroBody } from '../packages/game-core/src/anatomy/body';

const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
const catalog = gameContent.equipmentCatalog!;
const hero = gameContent.characters.find(character => character.id === 'guardian')!;

describe('equipment availability in the adventure', () => {
  it('exposes every item through the actual rarity pool, including items without set bonuses', () => {
    const reachable = rarities.flatMap(rarity => adventureRewardEntries(gameContent, 'equipment', rarity));
    expect(reachable.map(item => item.id).sort()).toEqual(Object.keys(catalog.items).sort());
    expect(new Set(reachable.map(item => item.id)).size).toBe(reachable.length);
    for (const rarity of rarities) {
      const pool = adventureRewardEntries(gameContent, 'equipment', rarity);
      expect(pool.every(item => item.rarity === rarity)).toBe(true);
      const featured = featuredEquipmentSetIds(catalog, 'ITEM-REACHABILITY', hero.id, rarity);
      const equipment = pool.map(item => catalog.items[item.id]);
      // The fifth face always retains every item, whatever the six featured themes are.
      expect(equipmentLootPool(equipment, featured, 5)).toEqual(equipment);
      for (const face of [1, 2, 3, 4]) {
        expect(equipmentLootPool(equipment, featured, face).every(item => featured.includes(item.setId!))).toBe(true);
      }
    }
  });

  it.each(['steel-greatsword', 'flanged-mace', 'flanged-greatmace', 'forge-greathammer', 'reaping-scythe'])(
    'can award the previously preview-only weapon %s through normal chest loot', itemId => {
      let state = createCoopState(`RECOVER-${itemId}`, [hero.id], gameContent);
      const chunkId = state.actors[0].chunkId;
      // Exhaust the other common items to isolate eligibility without depending on a lucky item index.
      state = { ...state, removedRewardIds: Object.values(catalog.items)
        .filter(item => item.rarity === 'common' && item.id !== itemId)
        .map(item => coopRewardId(`${hero.id}:equipment`, item.id)) };
      for (let chest = 0; chest < 8 && !state.progression!.heroes[hero.id].rewards.some(reward => reward.definitionId === itemId); chest++) {
        state = awardAdventureLoot(state, hero.id, `chest:reachability-${chest}`, chunkId, gameContent);
      }
      expect(state.progression!.heroes[hero.id].rewards.some(reward => reward.kind === 'equipment' && reward.definitionId === itemId)).toBe(true);
    });

  it('allows every reward to be equipped, including either hand and either ring slot', () => {
    for (const item of Object.values(catalog.items)) {
      const slots: EquipmentSlot[] = item.slot === 'hand' ? ['leftHand', 'rightHand']
        : item.slot === 'ring1' || item.slot === 'ring2' ? ['ring1', 'ring2'] : [item.slot];
      for (const slot of slots) {
        expect(equipmentItemFitsSlot(item, slot), `${item.id} in ${slot}`).toBe(true);
        const equipped = equippedHero(hero, { equipment: [{ itemId: item.id, slot }], skills: [null, null] }, gameContent);
        expect(equipped.anatomy!.equipment[0].id).toBe(item.id);
        expect(equipped.anatomy!.equipment[0].slot).toBe(slot);
      }
    }
  });

  it('can activate every catalogued set aura with obtainable compatible pieces', () => {
    const allLoot = new Set(rarities.flatMap(rarity => adventureRewardEntries(gameContent, 'equipment', rarity).map(item => item.id)));
    const reachableAuras = new Set<string>();
    for (const set of CATALOG_EQUIPMENT_SETS) {
      const equipment = Object.entries(set.loadout!).map(([slot, itemId]) => ({ slot: slot as EquipmentSlot, itemId: itemId! }));
      expect(equipment.every(item => allLoot.has(item.itemId)), set.id).toBe(true);
      const equipped = equippedHero(hero, { equipment, skills: [null, null] }, gameContent);
      const actual = activeEquipmentSetAuras(equipped, startHeroBody(equipped));
      const expected = set.bonuses!.flatMap(bonus => bonus.aura ? [bonus.aura.id] : []);
      expect(actual.map(bonus => bonus.aura.id), set.id).toEqual(expected);
      actual.forEach(bonus => reachableAuras.add(bonus.aura.id));
    }
    expect(reachableAuras.size).toBe(28);
  });
});
