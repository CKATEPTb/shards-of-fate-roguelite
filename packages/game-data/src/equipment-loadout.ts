import { BODY_PARTS, occupiedHandSlots, resolveEquipmentItem, type EquipmentSlot, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { EQUIPMENT_ITEMS, EQUIPMENT_SETS, equipItem } from './equipment';

const attributes = ['power', 'initiative', 'evasion', 'crit', 'agility', 'accuracy', 'resilience', 'luck'] as const;
const itemBonus = (equipment: readonly StarterEquipment[], key: typeof attributes[number]) => equipment.reduce((sum, item) => sum + (item.bonuses?.[key] ?? 0), 0);

/** Build a separate definition for a fitting or a future equipped hero. Never mutate shipped characters. */
export function applyEquipmentToHero(definition: UnitDefinition, equipment: readonly StarterEquipment[]): UnitDefinition {
  if (!definition.anatomy) throw new Error('Для примерки нужна анатомия героя');
  if (new Set(equipment.map(item => item.slot)).size !== equipment.length) throw new Error('В каждом слоте может быть только один предмет');
  const current = definition.anatomy.equipment;
  const equipped = equipment.map(item => {
    if (!item.id || !resolveEquipmentItem(EQUIPMENT_ITEMS, item.id)) throw new Error(`Неизвестный предмет: ${item.id ?? item.name}`);
    return equipItem(item.id, item.slot);
  });
  const occupied = equipped.flatMap(occupiedHandSlots);
  if (new Set(occupied).size !== occupied.length) throw new Error('Двуручное оружие занимает обе руки');
  const stats = { ...definition.stats };
  for (const key of attributes) stats[key] = (definition.stats[key] ?? 0) - itemBonus(current, key) + itemBonus(equipped, key);
  // Armor remains local to the struck part. It is never added to every limb through stats.armor.
  stats.maxHp = BODY_PARTS.reduce((sum, part) => sum + definition.anatomy!.base[part] + equipped.reduce((total, item) => total + (item.resources[part] ?? 0), 0), 0);
  const setBonuses = [...new Set(equipped.flatMap(item => item.setId ? [item.setId] : []))].sort().flatMap(setId => {
    const set = EQUIPMENT_SETS[setId];
    return set?.bonuses?.length ? [{ setId, name: set.name, bonuses: structuredClone(set.bonuses) }] : [];
  });
  return {
    ...definition, stats,
    anatomy: { base: { ...definition.anatomy.base }, equipment: equipped, ...(setBonuses.length ? { setBonuses } : {}) },
    modifiers: { ...definition.modifiers }, skillIds: [...definition.skillIds], effectIds: [...definition.effectIds], tags: [...definition.tags],
  };
}

/** A recommended fitting is a compatible combination; itemIds alone do not encode hands. */
export function equipmentForSet(setId: string): StarterEquipment[] {
  const set = EQUIPMENT_SETS[setId];
  if (!set) throw new Error(`Неизвестный комплект: ${setId}`);
  if (set.loadout) return Object.entries(set.loadout).flatMap(([slot, id]) => id ? [equipItem(id, slot as EquipmentSlot)] : []);
  return set.itemIds.map(id => {
    const item = resolveEquipmentItem(EQUIPMENT_ITEMS, id);
    if (!item || item.slot === 'hand') throw new Error('Для оружия комплекта требуется указать руку');
    return equipItem(id, item.slot);
  });
}
