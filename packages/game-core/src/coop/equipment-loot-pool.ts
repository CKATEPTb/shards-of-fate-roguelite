import type { AdventureCatalog, EquipmentItemDefinition, RewardRarity } from '@shards/shared';
import { hashString } from '../random';

export const FEATURED_EQUIPMENT_SET_COUNT = 6;
export const EQUIPMENT_THEME_DIE_SIDES = 5;

/** A hero discovers six themes per rarity in this expedition; inspecting them consumes no dice. */
export function featuredEquipmentSetIds(catalog: AdventureCatalog, seed: string, characterId: string, rarity: RewardRarity): string[] {
  const eligible = new Set(Object.values(catalog.items).filter(item => item.rarity === rarity && item.setId
    && catalog.sets[item.setId]?.bonuses?.length).map(item => item.setId!));
  return [...eligible].sort((left, right) =>
    hashString(`${seed}:equipment-themes:${characterId}:${rarity}:${left}`) - hashString(`${seed}:equipment-themes:${characterId}:${rarity}:${right}`)
    || (left < right ? -1 : left > right ? 1 : 0)).slice(0, FEATURED_EQUIPMENT_SET_COUNT);
}

/** Four faces focus on the expedition's themes; the fifth keeps the whole catalog discoverable. */
export function equipmentLootPool<T extends Pick<EquipmentItemDefinition, 'id' | 'setId'>>(available: readonly T[], featuredSetIds: readonly string[], themeDie: number): T[] {
  if (!Number.isInteger(themeDie) || themeDie < 1 || themeDie > EQUIPMENT_THEME_DIE_SIDES) throw new Error('Equipment theme die must be in [1, 5]');
  if (themeDie === EQUIPMENT_THEME_DIE_SIDES) return [...available];
  const featured = new Set(featuredSetIds);
  const focused = available.filter(item => item.setId && featured.has(item.setId));
  // Exhausting a theme never deletes a valid reward of the rolled rarity.
  return focused.length ? focused : [...available];
}
