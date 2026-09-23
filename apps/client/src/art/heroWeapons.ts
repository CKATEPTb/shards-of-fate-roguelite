import type { WeaponKind } from '@shards/shared';

/** Visual poses use the same family identifiers as equipped gameplay weapons. */
export type HeroWeaponKind = WeaponKind;

export interface HeroWeaponDefinition {
  kind: HeroWeaponKind;
  name: string;
  hands: 1 | 2;
}

export const HERO_WEAPONS = [
  { kind: 'bow', name: 'Лук', hands: 2 },
  { kind: 'staff', name: 'Посох', hands: 2 },
  { kind: 'dagger', name: 'Кинжал', hands: 1 },
  { kind: 'sword', name: 'Меч', hands: 1 },
  { kind: 'greatsword', name: 'Двуручный меч', hands: 2 },
  { kind: 'mace', name: 'Булава', hands: 1 },
  { kind: 'greatmace', name: 'Двуручная булава', hands: 2 },
  { kind: 'hammer', name: 'Молот', hands: 1 },
  { kind: 'greathammer', name: 'Двуручный молот', hands: 2 },
  { kind: 'shield', name: 'Щит', hands: 1 },
  { kind: 'sickle', name: 'Серп', hands: 1 },
  { kind: 'scythe', name: 'Коса', hands: 2 },
  { kind: 'wand', name: 'Жезл', hands: 1 },
] as const satisfies readonly HeroWeaponDefinition[];

const weaponDefinitions = Object.fromEntries(HERO_WEAPONS.map(weapon => [weapon.kind, weapon])) as Record<HeroWeaponKind, HeroWeaponDefinition>;

export function heroWeaponDefinition(kind: HeroWeaponKind): HeroWeaponDefinition {
  return weaponDefinitions[kind];
}
