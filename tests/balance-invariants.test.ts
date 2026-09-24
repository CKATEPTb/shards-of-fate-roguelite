import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { createCoopState } from '@shards/game-core';
import { equipmentLootPool, featuredEquipmentSetIds } from '../packages/game-core/src/coop/equipment-loot-pool';
import { awardAdventureLoot, coopRewardId } from '../packages/game-core/src/coop/rewards';
import { rarityProbabilities, setCollectionOdds } from '../tools/balance-simulator/src/content-audit';

describe('expedition equipment themes', () => {
  const catalog = gameContent.equipmentCatalog!;
  const available = Object.values(catalog.items).filter(item => item.rarity === 'common' && item.setId && catalog.sets[item.setId]?.bonuses?.length);
  const featured = featuredEquipmentSetIds(catalog, 'balance-themes', 'guardian', 'common');

  it('derives six stable rarity-specific themes without depending on collected items', () => {
    expect(featured).toHaveLength(6);
    expect(new Set(featured).size).toBe(6);
    expect(featuredEquipmentSetIds(catalog, 'balance-themes', 'guardian', 'common')).toEqual(featured);
    expect(featured.every(id => catalog.sets[id].rarity === 'common')).toBe(true);
    expect(featuredEquipmentSetIds(catalog, 'another-expedition', 'guardian', 'common')).not.toEqual(featured);
    expect(featuredEquipmentSetIds(catalog, 'balance-themes', 'priest', 'common')).not.toEqual(featured);
  });

  it('focuses four die faces and preserves the complete eligible catalog on the fifth', () => {
    for (const face of [1, 2, 3, 4]) {
      const pool = equipmentLootPool(available, featured, face);
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every(item => featured.includes(item.setId!))).toBe(true);
    }
    expect(equipmentLootPool(available, featured, 5)).toEqual(available);
  });

  it('does not restore consumed items and falls back when all featured items are exhausted', () => {
    const remaining = available.filter(item => !featured.includes(item.setId!));
    expect(equipmentLootPool(remaining, featured, 1)).toEqual(remaining);
    expect(equipmentLootPool([], featured, 1)).toEqual([]);
    expect(() => equipmentLootPool(available, featured, 0)).toThrow();
    expect(() => equipmentLootPool(available, featured, 6)).toThrow();
  });

  it('awards deterministic, unique equipment while preserving consumed and bag exclusions', () => {
    const initial = createCoopState('THEMED-REWARD-INTEGRATION', ['guardian'], gameContent);
    const chunkId = initial.actors[0].chunkId;
    const excluded = available.slice(0, 3);
    initial.removedRewardIds.push(coopRewardId('guardian:equipment', excluded[0].id));
    initial.progression!.heroes.guardian.inventory!.push({ id: 'fixture-bag', kind: 'equipment', definitionId: excluded[1].id, rarity: 'common', source: 'fixture', luckRolls: [] });
    initial.progression!.heroes.guardian.rewards.push({ id: 'fixture-pending', kind: 'equipment', definitionId: excluded[2].id, rarity: 'common', source: 'fixture', luckRolls: [] });
    const simulate = (content = gameContent) => {
      let state = initial;
      for (let index = 0; index < 15; index++) state = awardAdventureLoot(state, 'guardian', `chest:balance-${index}`, chunkId, content);
      return state;
    };
    const first = simulate(), second = simulate();
    expect(first.progression).toEqual(second.progression);
    expect(first.diceCounters).toEqual(second.diceCounters);
    // A fresh unfrozen wrapper bypasses both caches without changing the logical content.
    const uncached = simulate({ ...gameContent });
    expect(first.progression).toEqual(uncached.progression);
    expect(first.diceCounters).toEqual(uncached.diceCounters);
    expect(first.diceIndex).toBe(uncached.diceIndex);
    const equipment = first.progression!.heroes.guardian.rewards.filter(reward => reward.kind === 'equipment' && reward.source !== 'fixture');
    expect(equipment).toHaveLength(30);
    expect(new Set(equipment.map(reward => reward.definitionId)).size).toBe(30);
    expect(equipment.every(reward => !excluded.some(item => item.id === reward.definitionId))).toBe(true);
    expect(awardAdventureLoot(first, 'guardian', 'chest:balance-0', chunkId, gameContent)).toBe(first);
    expect(initial.progression!.heroes.guardian.claimedSources).toHaveLength(0);
  });

  it('re-reads equipment pools after mutable custom content changes', () => {
    const starterIds = new Set(gameContent.characters.find(hero => hero.id === 'guardian')!.anatomy!.equipment.map(item => item.id));
    const limitedItems = Object.fromEntries(Object.entries(catalog.items).filter(([id]) => starterIds.has(id)));
    limitedItems[available[0].id] = available[0];
    const mutable = { ...gameContent, equipmentCatalog: { ...catalog, items: limitedItems } };
    let state = createCoopState('MUTABLE-LOOT-POOL', ['guardian'], mutable);
    // Starter items are valid loot too; exhaust them to isolate changes to the custom pool.
    state.removedRewardIds.push(...[...starterIds].map(id => coopRewardId('guardian:equipment', id!)));
    const chunkId = state.actors[0].chunkId;
    for (let index = 0; index < 4; index++) state = awardAdventureLoot(state, 'guardian', `chest:before-${index}`, chunkId, mutable);
    expect(state.progression!.heroes.guardian.rewards.some(reward => reward.definitionId === available[0].id)).toBe(true);
    delete limitedItems[available[0].id];
    limitedItems[available[1].id] = available[1];
    for (let index = 0; index < 4; index++) state = awardAdventureLoot(state, 'guardian', `chest:after-${index}`, chunkId, mutable);
    const equipment = state.progression!.heroes.guardian.rewards.filter(reward => reward.kind === 'equipment');
    expect(equipment.map(reward => reward.definitionId)).toEqual([available[0].id, available[1].id]);
  });
});

describe('balance audit probability invariants', () => {
  it('keeps rarity mass normalized and never downgrades a reward', () => {
    for (const luck of [-2, 0, 5, 12, 19, 30]) {
      for (const base of ['common', 'rare', 'epic', 'legendary'] as const) {
        const odds = rarityProbabilities(base, luck);
        expect(Object.values(odds).reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
        expect(Object.values(odds).every(p => p >= 0 && p <= 1)).toBe(true);
        if (base !== 'common') expect(odds.common).toBe(0);
      }
    }
  });

  it('reproduces collection sampling and cannot find a pair in a single equipment drop', () => {
    const report = setCollectionOdds(gameContent, 1, 50, 'common', 0, 'featured');
    expect(report).toEqual(setCollectionOdds(gameContent, 1, 50, 'common', 0, 'featured'));
    expect(report.thresholds.every(threshold => threshold.probabilityAny === 0)).toBe(true);
  });
});
