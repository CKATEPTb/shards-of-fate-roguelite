import type { BodyPart, EquipmentItemDefinition, EquipmentSlot, StarterEquipment } from './anatomy';

export const WEAPON_KINDS = ['bow', 'staff', 'dagger', 'sword', 'greatsword', 'mace', 'greatmace', 'hammer', 'greathammer', 'shield', 'sickle', 'scythe', 'wand'] as const;
export type WeaponKind = typeof WEAPON_KINDS[number];
export type AttackHand = 'right' | 'left';
export type AttackSlot = 'rightHand' | 'leftHand';

/** An equipped weapon's own damage dice; shields have no offensive damage roll. */
export interface EquipmentWeapon {
  kind: WeaponKind;
  hands: 1 | 2;
  damage?: string;
}

export function isHandSlot(slot: EquipmentSlot): slot is AttackSlot {
  return slot === 'rightHand' || slot === 'leftHand';
}
export function isRingSlot(slot: string): slot is 'ring1' | 'ring2' {
  return slot === 'ring1' || slot === 'ring2';
}
export function otherHandSlot(slot: AttackSlot): AttackSlot {
  return slot === 'rightHand' ? 'leftHand' : 'rightHand';
}
export function attackHandForSlot(slot: AttackSlot): AttackHand {
  return slot === 'rightHand' ? 'right' : 'left';
}
/** A two-handed item has one inventory entry and reserves both hands. */
export function occupiedHandSlots(item: Pick<StarterEquipment, 'slot' | 'weapon'>): AttackSlot[] {
  if (!isHandSlot(item.slot)) return [];
  return item.weapon?.hands === 2 ? [item.slot, otherHandSlot(item.slot)] : [item.slot];
}
type SlottedEquipment = Pick<EquipmentItemDefinition, 'weapon'> & { slot: EquipmentItemDefinition['slot'] | EquipmentSlot };

/** Catalogue ring slots are outfit defaults; either ring can use either ring slot. */
export function equipmentItemFitsSlot(item: SlottedEquipment, slot: EquipmentSlot): boolean {
  if (isHandSlot(slot)) return !!item.weapon && (item.slot === 'hand' || isHandSlot(item.slot));
  return !item.weapon && (isRingSlot(item.slot) ? isRingSlot(slot) : item.slot === slot);
}

/** Rings and held items follow the anatomical side chosen for the equipped instance. */
export function equipmentBodyPartsForSlot(item: SlottedEquipment & Pick<EquipmentItemDefinition, 'bodyParts'>, slot: EquipmentSlot): BodyPart[] {
  if (isHandSlot(slot)) return item.weapon?.hands === 2 ? ['rightArm', 'leftArm'] : [slot === 'rightHand' ? 'rightArm' : 'leftArm'];
  if (isRingSlot(slot)) return [slot === 'ring1' ? 'rightArm' : 'leftArm'];
  return [...item.bodyParts];
}

/** Replacing the target slot is allowed; an item in the other hand is not displaced. */
export function canEquipInSlot(equipment: readonly StarterEquipment[], item: SlottedEquipment, slot: EquipmentSlot): boolean {
  if (!equipmentItemFitsSlot(item, slot)) return false;
  if (!isHandSlot(slot)) return true;
  const desiredHands = occupiedHandSlots({ slot, weapon: item.weapon });
  return equipment.every(existing => existing.slot === slot || !occupiedHandSlots(existing).some(hand => desiredHands.includes(hand)));
}
