import type { EquipmentWeapon } from './weapons';
import type { RewardRarity } from './rewards';
import type { Modifiers } from './model';
import type { AuraVisualDefinition } from './auras';

export const BODY_PARTS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
export const LIMB_PARTS = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
export type BodyPart = typeof BODY_PARTS[number];
export type BodyResources = Record<BodyPart, number>;
/** A disabled part remains attached and healable until its negative loss threshold. */
export interface BodyPartResource { current: number; max: number; lost?: boolean }
export type HeroBody = Record<BodyPart, BodyPartResource>;
export type EquipmentSlot = 'head' | 'chest' | 'gloves' | 'pants' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'rightHand' | 'leftHand';

/** Fixed starting equipment; resources protect body parts, while armor reduces damage. */
export interface StarterEquipment {
  /** Catalogue identity and visual material stay independent of the wearer. */
  id?: string;
  appearanceId?: string;
  setId?: string;
  rarity?: RewardRarity;
  slot: EquipmentSlot;
  name: string;
  description: string;
  resources: Partial<BodyResources>;
  armor: number;
  bodyParts: BodyPart[];
  bonuses?: {
    power?: number;
    initiative?: number;
    evasion?: number;
    crit?: number;
    agility?: number;
    accuracy?: number;
    resilience?: number;
    luck?: number;
    /** @deprecated Legacy input only; new equipment uses unified power. */
    healing?: number;
  };
  weapon?: EquipmentWeapon;
}
/** A hand item can be equipped in either anatomical hand. */
export interface EquipmentItemDefinition extends Omit<StarterEquipment, 'id' | 'appearanceId' | 'slot'> {
  id: string;
  appearanceId: string;
  rarity: RewardRarity;
  slot: Exclude<EquipmentSlot, 'rightHand' | 'leftHand'> | 'hand';
}
export type EquipmentSetAttributeModifiers = Pick<Modifiers,
  'powerBonus' | 'initiativeBonus' | 'evasionBonus' | 'critBonus' | 'agilityBonus' | 'accuracyBonus' | 'resilienceBonus' | 'luckBonus'>;
/** A derived aura supplied by equipped pieces; it grants no skill or separate action. */
export interface EquipmentSetAuraDefinition {
  id: string;
  name: string;
  description: string;
  modifiers: Modifiers;
  visual: AuraVisualDefinition;
}
export interface EquipmentSetBonusDefinition {
  /** Distinct, usable catalogue item IDs; occupying two hands still counts once. */
  pieces: 2 | 4 | 6;
  name: string;
  description: string;
  /** Direct set bonuses affect attributes only; reactive rules belong to the aura. */
  modifiers: EquipmentSetAttributeModifiers;
  aura?: EquipmentSetAuraDefinition;
}
export interface EquipmentSetVisualDefinition {
  silhouette: 'guardian' | 'priest' | 'mage' | 'vampire' | 'paladin' | 'druid' | 'necromancer' | 'rogue' | 'ranger';
  palette: { dark: string; shadow: string; metal: string; edge: string; cloth: string; fold: string; trim: string };
  material?: 'cloth' | 'leather' | 'mail' | 'plate' | 'bone';
  motif?: 'rune' | 'sun' | 'moon' | 'leaf' | 'skull' | 'flame' | 'star' | 'eye' | 'claw' | 'cross' | 'crystal' | 'bolt';
  variant: number;
  accents?: { leather?: string; wood?: string; bone?: string; gem?: string };
}
export interface EquipmentSetDefinition {
  id: string;
  name: string;
  itemIds: string[];
  description?: string;
  rarity?: RewardRarity;
  visual?: EquipmentSetVisualDefinition;
  bonuses?: EquipmentSetBonusDefinition[];
  /** A complete suggested outfit, independent of a particular hero. */
  loadout?: Partial<Record<EquipmentSlot, string>>;
}
/** Only relevant bonus rules travel with an outfit; only identifiers are persisted in adventure saves. */
export interface EquippedSetBonuses {
  setId: string;
  name: string;
  bonuses: EquipmentSetBonusDefinition[];
}
export interface HeroAnatomy {
  base: BodyResources;
  equipment: StarterEquipment[];
  setBonuses?: EquippedSetBonuses[];
}
