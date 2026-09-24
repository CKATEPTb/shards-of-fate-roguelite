import { baseEquipmentItemId, resolveEquipmentItem, type EquipmentItemDefinition, type EquipmentSlot, type HeroBody, type UnitDefinition } from '@shards/shared';
import { EQUIPMENT_ITEMS, STARTER_ANATOMY } from '@shards/game-data';
import { HERO_ART_IDS } from './heroOutfit';
import type { HeroWeaponKind } from './heroWeapons';

export { EQUIPMENT_ITEMS, EQUIPMENT_SETS } from '@shards/game-data';
export const HERO_VISUAL_SLOTS = ['head', 'chest', 'gloves', 'pants', 'boots', 'rightHand', 'leftHand', 'amulet', 'ring1', 'ring2'] as const satisfies readonly EquipmentSlot[];
export type HeroVisualLoadout = Partial<Record<EquipmentSlot, string | null>>;
export type ResolvedHeroLoadout = Readonly<Record<EquipmentSlot, string | null>>;
export interface HeroRenderState { body?: HeroBody; equipment?: HeroVisualLoadout }
export interface HeroVisualItem {
  id: string;
  name: string;
  appearanceId: string;
  slot: EquipmentItemDefinition['slot'];
  weaponKind?: HeroWeaponKind;
  hands?: 1 | 2;
}

/** Catalog identity, skin and weapon family are independent of the wearing hero. */
export const HERO_VISUAL_ITEMS: Readonly<Record<string, HeroVisualItem>> = Object.fromEntries(
  Object.values(EQUIPMENT_ITEMS).map(item => [item.id, {
    id: item.id, name: item.name, appearanceId: item.appearanceId, slot: item.slot,
    ...(item.weapon ? { weaponKind: item.weapon.kind, hands: item.weapon.hands } : {}),
  }]),
);

export function heroVisualItem(id: string | null | undefined, slot: EquipmentSlot): HeroVisualItem | undefined {
  const item = id && resolveEquipmentItem(EQUIPMENT_ITEMS, id) ? HERO_VISUAL_ITEMS[baseEquipmentItemId(id)] : undefined;
  return item && (item.slot === slot || item.slot === 'hand' && (slot === 'rightHand' || slot === 'leftHand')) ? item : undefined;
}

export function resolveHeroVisualLoadout(
  definition: Pick<UnitDefinition, 'id' | 'sprite' | 'role' | 'anatomy'>,
  overrides: HeroVisualLoadout = {},
): ResolvedHeroLoadout {
  const artId = HERO_ART_IDS.includes(definition.sprite as typeof HERO_ART_IDS[number]) ? definition.sprite
    : HERO_ART_IDS.includes(definition.id as typeof HERO_ART_IDS[number]) ? definition.id
    : definition.role === 'tank' ? 'guardian' : definition.role === 'healer' ? 'priest' : 'mage';
  const anatomy = definition.anatomy ?? STARTER_ANATOMY[artId];
  const loadout = Object.fromEntries(HERO_VISUAL_SLOTS.map(slot => {
    const supplied = overrides[slot];
    const equipped = anatomy?.equipment.find(item => item.slot === slot);
    const id = supplied !== undefined ? supplied : equipped?.id;
    return [slot, heroVisualItem(id, slot)?.id ?? null];
  })) as Record<EquipmentSlot, string | null>;
  // Reject an incompatible two-handed attachment. Never draw an extra weapon
  // in its support hand, even if a caller supplies an invalid preview override.
  const right = heroVisualItem(loadout.rightHand, 'rightHand'), left = heroVisualItem(loadout.leftHand, 'leftHand');
  if (right && left) {
    if (right.hands === 2) loadout.rightHand = null;
    if (left.hands === 2) loadout.leftHand = null;
  }
  return loadout;
}

export function heroLoadoutKey(loadout: ResolvedHeroLoadout): string {
  return HERO_VISUAL_SLOTS.map(slot => loadout[slot] ?? '-').join('|');
}
