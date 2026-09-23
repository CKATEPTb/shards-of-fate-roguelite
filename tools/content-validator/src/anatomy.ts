import { BODY_PARTS, WEAPON_KINDS, isHandSlot, occupiedHandSlots } from '@shards/shared';
import { z } from 'zod';
import { dice, modifiers, nonnegative, text } from './common';
import { auraVisualSchema } from './aura-visual';

const resource = z.number().int().min(1).max(1_000_000);
const resources = z.object({ head: resource, torso: resource, leftArm: resource, rightArm: resource, leftLeg: resource, rightLeg: resource }).strict();
export const equipmentResourcesSchema = resources.partial();
export const equipmentWeaponSchema = z.object({ kind: z.enum(WEAPON_KINDS), hands: z.union([z.literal(1), z.literal(2)]), damage: dice.optional() }).strict().superRefine((value, context) => {
  const hands = ['bow', 'staff', 'greatsword', 'greatmace', 'greathammer', 'scythe'].includes(value.kind) ? 2 : 1;
  if (value.hands !== hands) context.addIssue({ code: 'custom', path: ['hands'], message: 'Hand count must match the weapon kind' });
  if (value.kind === 'shield' ? value.damage !== undefined : value.damage === undefined) context.addIssue({ code: 'custom', path: ['damage'], message: 'Offensive weapons need damage dice; shields do not deal weapon damage' });
});
const rating = z.number().int().min(0).max(1_000_000);
const signedRating = z.number().int().min(-1_000_000).max(1_000_000);
export const equipmentBonusesSchema = z.object({
  power: rating.optional(), initiative: signedRating.optional(), evasion: rating.optional(), crit: rating.optional(),
  agility: signedRating.optional(), accuracy: rating.optional(), resilience: rating.optional(), luck: rating.optional(),
}).strict();

const hasModifiers = (value: object): boolean => Object.values(value).some(entry => entry !== undefined);
export const equipmentSetAttributeModifiersSchema = modifiers.pick({
  powerBonus: true, initiativeBonus: true, evasionBonus: true, critBonus: true,
  agilityBonus: true, accuracyBonus: true, resilienceBonus: true, luckBonus: true,
}).strict();

export const equipmentSetAuraSchema = z.object({
  id: text, name: text, description: text,
  modifiers: modifiers.refine(hasModifiers, 'A set aura needs at least one modifier'),
  visual: auraVisualSchema,
}).strict();

export const equipmentSetBonusSchema = z.object({
  pieces: z.union([z.literal(2), z.literal(4), z.literal(6)]), name: text, description: text,
  modifiers: equipmentSetAttributeModifiersSchema, aura: equipmentSetAuraSchema.optional(),
}).strict().superRefine((bonus, context) => {
  if (!hasModifiers(bonus.modifiers) && !bonus.aura) {
    context.addIssue({ code: 'custom', path: ['modifiers'], message: 'A set threshold needs an attribute bonus or an aura' });
  }
});

export const equipmentSetBonusesSchema = z.array(equipmentSetBonusSchema).min(1).max(3).superRefine((bonuses, context) => {
  if (new Set(bonuses.map(bonus => bonus.pieces)).size !== bonuses.length) {
    context.addIssue({ code: 'custom', message: 'Set bonus thresholds must be unique' });
  }
});

const compactSetBonuses = z.object({ setId: text, name: text, bonuses: equipmentSetBonusesSchema }).strict();

export const equippedItemSchema = z.object({
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
  id: text.optional(), appearanceId: text.optional(), setId: text.optional(),
  slot: z.enum(['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand']),
  name: text, description: text, resources: equipmentResourcesSchema, armor: nonnegative,
  bodyParts: z.array(z.enum(BODY_PARTS)).min(1).max(6),
  bonuses: equipmentBonusesSchema.optional(),
  weapon: equipmentWeaponSchema.optional(),
}).strict().superRefine((item, context) => {
  if (item.weapon && !isHandSlot(item.slot)) context.addIssue({ code: 'custom', path: ['weapon'], message: 'Weapons must occupy a hand slot' });
  if (isHandSlot(item.slot)) {
    if (!item.weapon) context.addIssue({ code: 'custom', path: ['weapon'], message: 'Hand slots only accept weapons or shields' });
    const required = item.weapon?.hands === 2 ? ['rightArm', 'leftArm'] as const : [item.slot === 'rightHand' ? 'rightArm' : 'leftArm'] as const;
    if (required.length !== item.bodyParts.length || required.some(part => !item.bodyParts.includes(part))) context.addIssue({ code: 'custom', path: ['bodyParts'], message: 'Hand item requirements must match its equipped hand and hand count' });
  }
  if (new Set(item.bodyParts).size !== item.bodyParts.length) context.addIssue({ code: 'custom', path: ['bodyParts'], message: 'Body part bindings must be unique' });
  for (const part of BODY_PARTS) if (item.resources[part] !== undefined && !item.bodyParts.includes(part)) context.addIssue({ code: 'custom', path: ['resources', part], message: 'Resource must belong to an equipped body part' });
});

export const anatomySchema = z.object({ base: resources, equipment: z.array(equippedItemSchema).max(10),
  setBonuses: z.array(compactSetBonuses).max(10).optional(),
}).strict().superRefine((anatomy, context) => {
  if (new Set(anatomy.equipment.map(item => item.slot)).size !== anatomy.equipment.length) context.addIssue({ code: 'custom', path: ['equipment'], message: 'Equipment slots must be unique' });
  const hands = anatomy.equipment.flatMap(occupiedHandSlots);
  if (new Set(hands).size !== hands.length) context.addIssue({ code: 'custom', path: ['equipment'], message: 'A two-handed weapon reserves both hand slots' });
  const sets = anatomy.setBonuses ?? [];
  if (new Set(sets.map(set => set.setId)).size !== sets.length) context.addIssue({ code: 'custom', path: ['setBonuses'], message: 'Equipped set identifiers must be unique' });
  sets.forEach((set, index) => {
    if (!anatomy.equipment.some(item => item.setId === set.setId && item.id)) {
      context.addIssue({ code: 'custom', path: ['setBonuses', index, 'setId'], message: 'Set rules must belong to an equipped item' });
    }
  });
});
