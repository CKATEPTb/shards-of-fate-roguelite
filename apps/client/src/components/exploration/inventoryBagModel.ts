import { REWARD_RARITIES, resolveEquipmentItem, type AdventureReward, type EquipmentItemDefinition } from '@shards/shared';
import { EQUIPMENT_ITEMS, EQUIPMENT_SETS } from '@shards/game-data';

export type InventoryBagSort = 'rarity' | 'newest' | 'sets';
export type InventoryBagCategoryId = 'head' | 'chest' | 'gloves' | 'pants' | 'boots' | 'weapons' | 'shields' | 'amulet' | 'rings' | 'skills' | 'other';

export const INVENTORY_BAG_CATEGORIES: readonly { id: InventoryBagCategoryId; name: string }[] = [
  { id: 'head', name: 'Шлемы' },
  { id: 'chest', name: 'Доспехи' },
  { id: 'gloves', name: 'Перчатки' },
  { id: 'pants', name: 'Штаны' },
  { id: 'boots', name: 'Сапоги' },
  { id: 'weapons', name: 'Оружие' },
  { id: 'shields', name: 'Щиты' },
  { id: 'amulet', name: 'Ожерелья' },
  { id: 'rings', name: 'Кольца' },
  { id: 'skills', name: 'Способности' },
  { id: 'other', name: 'Другие находки' },
];

export interface InventoryBagEntry {
  reward: AdventureReward;
  /** Index in the saved inventory is the only source of pickup chronology. */
  pickupOrder: number;
  category: InventoryBagCategoryId;
  setId: string | null;
}

export interface InventoryBagSection {
  id: string;
  name: string;
  category: InventoryBagCategoryId | 'set';
  setId: string | null;
  entries: InventoryBagEntry[];
}

export function inventoryRewardCategory(reward: AdventureReward): InventoryBagCategoryId {
  return rewardCategory(reward, reward.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId) : undefined);
}

function rewardCategory(reward: AdventureReward, item?: EquipmentItemDefinition): InventoryBagCategoryId {
  if (reward.kind === 'skill') return 'skills';
  if (!item) return 'other';
  if (item.slot === 'hand') return item.weapon?.kind === 'shield' ? 'shields' : 'weapons';
  if (item.slot === 'ring1' || item.slot === 'ring2') return 'rings';
  return item.slot;
}

export function inventoryRewardSetId(reward: AdventureReward): string | null {
  return reward.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId)?.setId ?? null : null;
}

export function inventorySetName(setId: string): string {
  return EQUIPMENT_SETS[setId]?.name ?? setId;
}

const rarityThenNewest = (left: InventoryBagEntry, right: InventoryBagEntry) => REWARD_RARITIES.indexOf(right.reward.rarity)
  - REWARD_RARITIES.indexOf(left.reward.rarity) || right.pickupOrder - left.pickupOrder;
const categoryIndices = new Map(INVENTORY_BAG_CATEGORIES.map((category, index) => [category.id, index]));
const categoryOrder = (category: InventoryBagCategoryId) => categoryIndices.get(category)!;
const setNameCollator = new Intl.Collator('ru');

/** Sorting produces view arrays; saved inventory and its arrival order stay intact. */
export function buildInventoryBagSections(inventory: readonly AdventureReward[], sort: InventoryBagSort): InventoryBagSection[] {
  const categories = new Map<InventoryBagCategoryId, InventoryBagEntry[]>();
  const sets = new Map<string, InventoryBagEntry[]>();
  inventory.forEach((reward, pickupOrder) => {
    // Upgraded items allocate a derived definition; resolve each only once.
    const item = reward.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId) : undefined;
    const entry: InventoryBagEntry = { reward, pickupOrder, category: rewardCategory(reward, item), setId: item?.setId ?? null };
    if (sort === 'sets' && entry.setId) {
      const group = sets.get(entry.setId);
      if (group) group.push(entry);
      else sets.set(entry.setId, [entry]);
    } else {
      const group = categories.get(entry.category);
      if (group) group.push(entry);
      else categories.set(entry.category, [entry]);
    }
  });
  if (sort !== 'sets') {
    const compare = sort === 'newest' ? (left: InventoryBagEntry, right: InventoryBagEntry) => right.pickupOrder - left.pickupOrder : rarityThenNewest;
    return INVENTORY_BAG_CATEGORIES.filter(category => category.id !== 'other' || categories.has('other')).map(category => ({
      id: `category:${category.id}`, name: category.name, category: category.id, setId: null,
      entries: (categories.get(category.id) ?? []).sort(compare),
    }));
  }

  const sections = [...sets].map(([setId, group]): InventoryBagSection => ({
    id: `set:${setId}`, name: inventorySetName(setId), category: 'set', setId,
    entries: group.sort((left, right) => categoryOrder(left.category) - categoryOrder(right.category) || rarityThenNewest(left, right)),
  })).sort((left, right) => setNameCollator.compare(left.name, right.name) || left.id.localeCompare(right.id));
  for (const category of INVENTORY_BAG_CATEGORIES) {
    const group = categories.get(category.id);
    if (!group?.length) continue;
    group.sort(rarityThenNewest);
    sections.push({ id: `category:${category.id}`, name: category.id === 'skills' ? category.name : `${category.name} · без комплекта`,
      category: category.id, setId: null, entries: group });
  }
  return sections;
}
