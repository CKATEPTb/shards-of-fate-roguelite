import type { EquipmentSetAuraDefinition, EquipmentSetBonusDefinition, HeroBody, UnitDefinition } from '@shards/shared';
import { equipmentCondition } from './anatomy/equipment';

export interface ActiveEquipmentSetBonuses {
  setId: string;
  name: string;
  equippedPieces: number;
  /** All reached thresholds apply together. */
  bonuses: EquipmentSetBonusDefinition[];
}

export interface ActiveEquipmentSetAura {
  setId: string;
  setName: string;
  /** The piece threshold that supplies this aura. */
  pieces: 2 | 4 | 6;
  aura: EquipmentSetAuraDefinition;
}

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Derive bonuses from the current outfit and injuries; never persist an activation counter. */
export function activeEquipmentSetBonuses(definition: UnitDefinition, body?: HeroBody): ActiveEquipmentSetBonuses[] {
  const anatomy = definition.anatomy;
  if (!anatomy?.setBonuses?.length) return [];
  const pieces = new Map<string, Set<string>>();
  for (const item of anatomy.equipment) {
    if (!item.id || !item.setId || body && !equipmentCondition(item, body).active) continue;
    const ids = pieces.get(item.setId) ?? new Set<string>();
    ids.add(item.id);
    pieces.set(item.setId, ids);
  }
  const seen = new Set<string>();
  return [...anatomy.setBonuses].sort((a, b) => compareIds(a.setId, b.setId)).flatMap(set => {
    const equippedPieces = pieces.get(set.setId)?.size ?? 0;
    if (!equippedPieces || seen.has(set.setId)) return [];
    seen.add(set.setId);
    return [{ setId: set.setId, name: set.name, equippedPieces,
      bonuses: set.bonuses.filter(bonus => bonus.pieces <= equippedPieces).sort((a, b) => a.pieces - b.pieces) }];
  });
}

/** Set auras are derived from active pieces, so losing a threshold removes its aura immediately. */
export function activeEquipmentSetAuras(definition: UnitDefinition, body?: HeroBody): ActiveEquipmentSetAura[] {
  return activeEquipmentSetBonuses(definition, body).flatMap(set => set.bonuses.flatMap(bonus => bonus.aura
    ? [{ setId: set.setId, setName: set.name, pieces: bonus.pieces, aura: bonus.aura }] : []));
}
