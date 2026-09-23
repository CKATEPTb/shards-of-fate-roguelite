import type { AdventureReward, CoopEvent, CoopResult, CoopState, EquipmentItemDefinition, GameContent, RewardPoolEntry, RewardRarity, SkillDefinition } from '@shards/shared';
import { createEntityRng, hashString } from '../random';
import { compareCoopIds, coopGraph } from './world';
import { drawDie } from '../dice';
import { rollRewardRarity } from '../rewards';
import { adventureContent, initialProgress } from './progression';
import { resolveWorldNode } from '../world/chunk-identity';
import { activeEquipmentSetBonuses } from '../equipment-sets';
import { equipmentLootPool, featuredEquipmentSetIds, EQUIPMENT_THEME_DIE_SIDES } from './equipment-loot-pool';

type LootEntry = EquipmentItemDefinition | SkillDefinition;
interface FrozenLootCache { entries: Map<string, readonly LootEntry[]>; themes: Map<string, readonly string[]> }
const frozenLootCaches = new WeakMap<GameContent, FrozenLootCache>();

/** Same immutable-content contract as hashValue; mutable custom content is always re-read. */
function frozenLootCache(content: GameContent): FrozenLootCache | undefined {
  if (!Object.isFrozen(content)) return undefined;
  let cache = frozenLootCaches.get(content);
  if (!cache) frozenLootCaches.set(content, cache = { entries: new Map(), themes: new Map() });
  return cache;
}

function rewardEntries(content: GameContent, kind: AdventureReward['kind'], rarity: RewardRarity): readonly LootEntry[] {
  const cache = frozenLootCache(content), key = `${kind}:${rarity}`;
  const found = cache?.entries.get(key);
  if (found) return found;
  const entries = (kind === 'equipment'
    ? Object.values(content.equipmentCatalog?.items ?? {}).filter(item => item.setId && content.equipmentCatalog?.sets[item.setId]?.bonuses?.length)
    : content.skills.filter(skill => skill.rarity)).filter(entry => entry.rarity === rarity).sort((a, b) => compareCoopIds(a.id, b.id));
  cache?.entries.set(key, entries);
  return entries;
}

function featuredSets(content: GameContent, seed: string, actorId: string, rarity: RewardRarity): readonly string[] {
  const cache = frozenLootCache(content), key = JSON.stringify([seed, actorId, rarity]);
  const found = cache?.themes.get(key);
  if (found) return found;
  const themes = featuredEquipmentSetIds(content.equipmentCatalog!, seed, actorId, rarity);
  if (cache) {
    if (cache.themes.size >= 512) cache.themes.delete(cache.themes.keys().next().value!);
    cache.themes.set(key, themes);
  }
  return themes;
}

export function coopRewardId(poolId: string, rewardId: string): string {
  return `${encodeURIComponent(poolId)}:${encodeURIComponent(rewardId)}`;
}

/** Pool ordering is seed-derived, so observing a chest cannot consume gameplay dice. */
export function coopRewardPool(state: CoopState, poolId: string, rewardIds: readonly string[]): string[] {
  const removed = new Set(state.removedRewardIds);
  return [...new Set(rewardIds)].filter(id => !removed.has(coopRewardId(poolId, id))).sort((a, b) =>
    hashString(`${state.seed}:reward:${poolId}:${a}`) - hashString(`${state.seed}:reward:${poolId}:${b}`) || compareCoopIds(a, b));
}

/** Select the upgraded tier without restoring items already taken or declined. */
export function coopRewardPoolAtRarity(state: CoopState, poolId: string, rewards: readonly RewardPoolEntry[], rarity: RewardRarity): string[] {
  return coopRewardPool(state, poolId, rewards.filter(reward => reward.rarity === rarity).map(reward => reward.id));
}

/** Taken and skipped choices are equally consumed; no chest interaction is invented here. */
export function consumeCoopReward(state: CoopState, poolId: string, rewardId: string, outcome: 'taken' | 'skipped'): CoopResult {
  const id = coopRewardId(poolId, rewardId);
  if (state.removedRewardIds.includes(id)) return { state, events: [], accepted: false };
  const event: CoopEvent = { type: 'reward', rewardId: id, outcome };
  return { state: { ...state, removedRewardIds: [...state.removedRewardIds, id] }, events: [event], accepted: true };
}

export function adventureDistance(state: CoopState, chunkId: string): number {
  const node = resolveWorldNode(coopGraph(state.seed, state.worldVersion ?? 2), chunkId);
  return node ? Math.hypot(node.x, node.y) : 0;
}

export function awardAdventureLoot(state: CoopState, actorId: string, source: string, chunkId: string, content: GameContent, quality: 'normal' | 'epic' | 'miniboss' = 'normal'): CoopState {
  const progression = state.progression ?? initialProgress(content, state.characterIds);
  const hero = progression.heroes[actorId];
  if (!hero || hero.claimedSources.includes(source)) return state;
  const owner = `hero:${actorId}`, index = state.diceCounters?.[owner] ?? 0;
  let rng = createEntityRng(state.seed, owner, index);
  const distance = adventureDistance(state, chunkId);
  const base: RewardRarity = quality === 'miniboss' || distance >= 28 ? 'epic' : quality === 'epic' || distance >= 10 ? 'rare' : 'common';
  const definition = adventureContent({ progression }, content).characters.find(hero => hero.id === actorId)!;
  const luck = (definition.stats.luck ?? 0) + (definition.modifiers.luckBonus ?? 0)
    + activeEquipmentSetBonuses(definition, state.actors.find(actor => actor.id === actorId)?.body).reduce((sum, set) => sum
      + set.bonuses.reduce((total, bonus) => total + (bonus.modifiers.luckBonus ?? 0) + (bonus.aura?.modifiers.luckBonus ?? 0), 0), 0);
  const coins = drawDie(8, rng, 'LOOT') + 4 + Math.floor(distance * 2) + (quality === 'normal' ? 0 : quality === 'epic' ? 12 : 30);
  const rewards: AdventureReward[] = [];
  const kinds = source.startsWith('chest:') ? ['equipment', 'equipment', 'skill'] as const : ['equipment', 'skill'] as const;
  for (const kind of kinds) {
    const upgraded = rollRewardRarity(base, luck, rng);
    rng = upgraded.rng as typeof rng;
    const entries = rewardEntries(content, kind, upgraded.rarity);
    const used = new Set([...hero.rewards, ...(hero.inventory ?? []), ...rewards].filter(reward => reward.kind === kind).map(reward => reward.definitionId));
    let pool = entries.filter(entry => !used.has(entry.id)
      && !state.removedRewardIds.includes(coopRewardId(`${actorId}:${kind}`, entry.id)));
    if (!pool.length) continue;
    if (kind === 'equipment' && content.equipmentCatalog) {
      const featured = featuredSets(content, state.seed, actorId, upgraded.rarity);
      pool = equipmentLootPool(pool, featured, drawDie(EQUIPMENT_THEME_DIE_SIDES, rng, 'LOOT'));
    }
    const selected = pool[drawDie(pool.length, rng, 'LOOT') - 1];
    rewards.push({ id: `${actorId}:loot:${hero.claimedSources.length}:${rewards.length}`, kind, definitionId: selected.id, rarity: upgraded.rarity, source, luckRolls: upgraded.rolls });
  }
  return { ...state, diceIndex: state.diceIndex + rng.diceIndex - index, diceCounters: { ...state.diceCounters, [owner]: rng.diceIndex },
    progression: { ...progression, heroes: { ...progression.heroes, [actorId]: { ...hero, coins: hero.coins + coins,
      rewards: [...hero.rewards, ...rewards], claimedSources: [...hero.claimedSources, source] } } } };
}
