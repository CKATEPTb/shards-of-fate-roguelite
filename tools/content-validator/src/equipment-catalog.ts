import { BODY_PARTS, isHandSlot, type BodyPart, type EquipmentItemDefinition, type EquipmentSlot, type StarterEquipment } from '@shards/shared';
import { z } from 'zod';
import { anatomySchema, equippedItemSchema, equipmentBonusesSchema, equipmentResourcesSchema, equipmentSetBonusesSchema, equipmentWeaponSchema } from './anatomy';
import { color, nonnegative, text } from './common';
import type { ValidationResult } from './index';
import type { ValidationIssue } from './references';

const slots = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'] as const;
const outfitSlots = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2'] as const;
const rarity = z.enum(['common', 'rare', 'epic', 'legendary']);

const itemSchema = z.object({
  id: text, appearanceId: text, setId: text.optional(), rarity,
  slot: z.enum(['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'hand']),
  name: text, description: text, resources: equipmentResourcesSchema, armor: nonnegative,
  bodyParts: z.array(z.enum(BODY_PARTS)).max(6), bonuses: equipmentBonusesSchema.optional(), weapon: equipmentWeaponSchema.optional(),
}).strict().superRefine((item, context) => {
  if (new Set(item.bodyParts).size !== item.bodyParts.length) context.addIssue({ code: 'custom', path: ['bodyParts'], message: 'Body part bindings must be unique' });
  if ((item.slot === 'hand') !== !!item.weapon) context.addIssue({ code: 'custom', path: ['weapon'], message: 'Only hand items can be weapons or shields, and every hand item needs a weapon type' });
  if (item.slot === 'hand') return;
  const expected: Partial<Record<typeof item.slot, readonly BodyPart[]>> = {
    head: ['head'], chest: ['torso'], gloves: ['leftArm', 'rightArm'], pants: ['leftLeg', 'rightLeg'],
    boots: ['leftLeg', 'rightLeg'], amulet: ['torso'],
  };
  const binding = expected[item.slot];
  if (binding && (item.bodyParts.length !== binding.length || binding.some(part => !item.bodyParts.includes(part)))) {
    context.addIssue({ code: 'custom', path: ['bodyParts'], message: 'Body parts must match the equipment slot' });
  }
  if ((item.slot === 'ring1' || item.slot === 'ring2') && (item.bodyParts.length !== 1 || !['leftArm', 'rightArm'].includes(item.bodyParts[0]))) {
    context.addIssue({ code: 'custom', path: ['bodyParts'], message: 'A ring belongs to exactly one arm' });
  }
});

const visualSchema = z.object({
  silhouette: z.enum(['guardian', 'priest', 'mage', 'vampire', 'paladin', 'druid', 'necromancer', 'rogue', 'ranger']),
  palette: z.object({ dark: color, shadow: color, metal: color, edge: color, cloth: color, fold: color, trim: color }).strict(),
  material: z.enum(['cloth', 'leather', 'mail', 'plate', 'bone']).optional(),
  motif: z.enum(['rune', 'sun', 'moon', 'leaf', 'skull', 'flame', 'star', 'eye', 'claw', 'cross', 'crystal', 'bolt']).optional(),
  variant: z.number().int().min(0).max(1_000_000),
  accents: z.object({ leather: color.optional(), wood: color.optional(), bone: color.optional(), gem: color.optional() }).strict().optional(),
}).strict();

const loadoutSchema = z.object({
  head: text.optional(), chest: text.optional(), gloves: text.optional(), pants: text.optional(), boots: text.optional(),
  amulet: text.optional(), ring1: text.optional(), ring2: text.optional(), rightHand: text.optional(), leftHand: text.optional(),
}).strict();

const setSchema = z.object({
  id: text, name: text, itemIds: z.array(text).min(1).max(100), description: text.optional(), rarity: rarity.optional(),
  visual: visualSchema.optional(), bonuses: equipmentSetBonusesSchema.optional(), loadout: loadoutSchema.optional(),
}).strict().superRefine((set, context) => {
  if (new Set(set.itemIds).size !== set.itemIds.length) context.addIssue({ code: 'custom', path: ['itemIds'], message: 'Set item identifiers must be unique' });
  if (set.bonuses && (set.bonuses.length !== 3 || [2, 4, 6].some(pieces => !set.bonuses!.some(bonus => bonus.pieces === pieces)))) {
    context.addIssue({ code: 'custom', path: ['bonuses'], message: 'Catalogue set bonuses require exactly the 2, 4 and 6 piece thresholds' });
  }
  if (set.loadout) {
    for (const field of ['bonuses', 'visual', 'rarity', 'description'] as const) {
      if (set[field] === undefined) context.addIssue({ code: 'custom', path: [field], message: 'A full set needs bonuses, visual design, rarity and description' });
    }
    for (const slot of outfitSlots) if (!set.loadout[slot]) context.addIssue({ code: 'custom', path: ['loadout', slot], message: 'A full set needs all five armor pieces, an amulet and two rings' });
  }
});

export const catalogueSchema = z.object({ items: z.record(text, itemSchema), sets: z.record(text, setSchema) }).strict();

/** Anatomical hand requirements are chosen on equip, never baked into a hand catalogue entry. */
function equippedItem(item: EquipmentItemDefinition, slot: EquipmentSlot): StarterEquipment {
  const bodyParts: BodyPart[] = item.slot === 'hand'
    ? item.weapon?.hands === 2 ? ['rightArm', 'leftArm'] : [slot === 'rightHand' ? 'rightArm' : 'leftArm']
    : [...item.bodyParts];
  return { ...item, slot, bodyParts };
}

/** Validate the standalone catalogue without inflating GameContent or its deterministic hash. */
export function validateEquipmentCatalog(itemsInput: unknown, setsInput: unknown): ValidationResult {
  const parsed = catalogueSchema.safeParse({ items: itemsInput, sets: setsInput });
  if (!parsed.success) return { valid: false, issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.') || '$', message: issue.message })) };
  const { items, sets } = parsed.data;
  const issues: ValidationIssue[] = [];
  const report = (path: string, message: string) => issues.push({ path, message });
  const schemaIssues = (result: z.ZodSafeParseResult<unknown>, prefix: string) => {
    if (!result.success) for (const issue of result.error.issues) report(`${prefix}${issue.path.length ? `.${issue.path.join('.')}` : ''}`, issue.message);
  };
  const uniqueEntries = (entries: Record<string, { id: string; name: string }>, prefix: string) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const [key, entry] of Object.entries(entries)) {
      if (key !== entry.id) report(`${prefix}.${key}.id`, 'Catalogue key must equal its definition identifier');
      if (ids.has(entry.id)) report(`${prefix}.${key}.id`, `Duplicate identifier: ${entry.id}`);
      const name = entry.name.trim().toLowerCase();
      if (names.has(name)) report(`${prefix}.${key}.name`, `Duplicate name: ${entry.name}`);
      ids.add(entry.id); names.add(name);
    }
  };
  uniqueEntries(items, 'items'); uniqueEntries(sets, 'sets');

  for (const [id, item] of Object.entries(items)) {
    if (!Object.hasOwn(sets, item.appearanceId)) report(`items.${id}.appearanceId`, `Unknown appearance set: ${item.appearanceId}`);
    if (item.setId) {
      if (!Object.hasOwn(sets, item.setId)) report(`items.${id}.setId`, `Unknown set: ${item.setId}`);
      else if (!sets[item.setId].itemIds.includes(id)) report(`items.${id}.setId`, 'The owning set does not list this item');
    }
    const positions: EquipmentSlot[] = item.slot === 'hand' ? ['rightHand', 'leftHand'] : [item.slot];
    for (const slot of positions) schemaIssues(equippedItemSchema.safeParse(equippedItem(item, slot)), `items.${id}`);
  }

  for (const [id, set] of Object.entries(sets)) {
    const prefix = `sets.${id}`;
    for (const itemId of set.itemIds) {
      if (!Object.hasOwn(items, itemId)) { report(`${prefix}.itemIds`, `Unknown item: ${itemId}`); continue; }
      const item = items[itemId];
      if (item.setId !== id) report(`${prefix}.itemIds`, `Item ${itemId} belongs to another set or has no setId`);
      if (set.rarity && item.rarity !== set.rarity) report(`${prefix}.itemIds`, `Item ${itemId} has a different rarity`);
      if (set.loadout && item.appearanceId !== id) report(`${prefix}.itemIds`, `Item ${itemId} must use its full set's visual definition`);
    }
    if (!set.loadout) continue;
    const equipped: StarterEquipment[] = [];
    const chosen = new Set<string>();
    for (const slot of slots) {
      const itemId = set.loadout[slot];
      if (!itemId) continue;
      if (chosen.has(itemId)) report(`${prefix}.loadout.${slot}`, 'A default outfit must use distinct item identifiers');
      chosen.add(itemId);
      if (!Object.hasOwn(items, itemId)) { report(`${prefix}.loadout.${slot}`, `Unknown item: ${itemId}`); continue; }
      const item = items[itemId];
      if (!set.itemIds.includes(itemId) || item.setId !== id) report(`${prefix}.loadout.${slot}`, 'The selected item must belong to this set');
      if (item.slot === 'hand' ? !isHandSlot(slot) : item.slot !== slot) report(`${prefix}.loadout.${slot}`, 'Item does not fit the selected slot');
      equipped.push(equippedItem(item, slot));
    }
    if (chosen.size !== set.itemIds.length || set.itemIds.some(itemId => !chosen.has(itemId))) report(`${prefix}.loadout`, 'A full set outfit must include every catalogue piece exactly once');
    if (equipped.length !== 9 && equipped.length !== 10) report(`${prefix}.loadout`, 'A full outfit has nine items with a two-handed weapon, or ten with two one-handed items');
    const hands = equipped.filter(item => isHandSlot(item.slot));
    const fullHands = hands.length === 1 ? hands[0].weapon?.hands === 2 && hands[0].weapon.kind !== 'shield'
      : hands.length === 2 && hands.every(item => item.weapon?.hands === 1) && hands.some(item => item.weapon?.kind !== 'shield');
    if (!fullHands) report(`${prefix}.loadout`, 'Use one two-handed weapon, a weapon with a shield, or two one-handed weapons');
    schemaIssues(anatomySchema.safeParse({ base: { head: 1, torso: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1 }, equipment: equipped }), `${prefix}.loadout`);
  }
  return { valid: issues.length === 0, issues };
}

export class EquipmentCatalogValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(`Invalid equipment catalogue:\n${issues.map(issue => `${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'EquipmentCatalogValidationError';
  }
}

export function assertValidEquipmentCatalog(items: unknown, sets: unknown): void {
  const result = validateEquipmentCatalog(items, sets);
  if (!result.valid) throw new EquipmentCatalogValidationError(result.issues);
}
