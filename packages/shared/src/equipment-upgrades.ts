import { BODY_PARTS, type EquipmentItemDefinition } from './anatomy';
import { REWARD_RARITIES, type RewardRarity } from './rewards';

type EquipmentItems = Readonly<Record<string, EquipmentItemDefinition>>;
const upgradePattern = /^upgrade:(rare|epic|legendary):([^:]+)$/;
const armorSlots = new Set(['head', 'chest', 'gloves', 'pants', 'boots']);

/** Rarity is an instance variant; artwork and distinct set pieces use the original identity. */
export function baseEquipmentItemId(id: string): string {
  return upgradePattern.exec(id)?.[2] ?? id;
}

/** Resolve a saved outfit without inserting generated variants into the loot catalogue. */
export function resolveEquipmentItem(items: EquipmentItems | undefined, id: string): EquipmentItemDefinition | undefined {
  if (!items || typeof id !== 'string' || !id.length) return undefined;
  if (Object.hasOwn(items, id)) return items[id]?.id === id ? items[id] : undefined;
  if (id.length > 128) return undefined;
  const match = upgradePattern.exec(id);
  if (!match || !Object.hasOwn(items, match[2])) return undefined;
  const base = items[match[2]], rarity = match[1] as RewardRarity;
  if (!base || base.id !== match[2]) return undefined;
  const baseRank = REWARD_RARITIES.indexOf(base.rarity), rank = REWARD_RARITIES.indexOf(rarity);
  if (baseRank < 0 || rank <= baseRank) return undefined;
  const tiers = rank - baseRank;
  const resources = { ...base.resources };
  for (const part of BODY_PARTS) {
    const value = resources[part] ?? 0;
    if (value > 0) resources[part] = value + tiers * (part === 'torso' ? 7 : 3);
  }
  const bonuses = base.bonuses ? { ...base.bonuses } : undefined;
  if (bonuses) for (const key of Object.keys(bonuses) as Array<keyof NonNullable<EquipmentItemDefinition['bonuses']>>) {
    const value = bonuses[key] ?? 0;
    if (value > 0) bonuses[key] = value + tiers * (key === 'power' && base.weapon ? 2 : 1);
  }
  const weapon = base.weapon ? { ...base.weapon } : undefined;
  if (weapon?.damage) {
    const dice = /^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(weapon.damage.trim());
    if (!dice) return undefined;
    const count = dice[1] ? Number(dice[1]) : 1, sides = Number(dice[2]) + tiers * 2, modifier = Number(dice[4] ?? 0);
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000 || !Number.isSafeInteger(sides) || sides < 1 || sides > 1_000_000
      || !Number.isSafeInteger(modifier) || modifier > 1_000_000) return undefined;
    weapon.damage = `${count}d${sides}${dice[3] ? `${dice[3]}${dice[4]}` : ''}`;
  }
  // Jewelry and offensive weapons do not acquire unrelated limb protection.
  const armorStep = base.armor < 0 ? 0 : base.weapon?.kind === 'shield' ? 3 : armorSlots.has(base.slot) || base.armor > 0 ? 1 : 0;
  return { ...base, id, rarity, resources, armor: base.armor + armorStep * tiers, bodyParts: [...base.bodyParts],
    ...(bonuses ? { bonuses } : {}), ...(weapon ? { weapon } : {}) };
}

/** The next authored rarity, calculated from the base item rather than rounded intermediate values. */
export function nextEquipmentUpgrade(items: EquipmentItems | undefined, id: string): EquipmentItemDefinition | undefined {
  const current = resolveEquipmentItem(items, id);
  if (!current || current.rarity === 'legendary') return undefined;
  const rarity = REWARD_RARITIES[REWARD_RARITIES.indexOf(current.rarity) + 1];
  return rarity ? resolveEquipmentItem(items, `upgrade:${rarity}:${baseEquipmentItemId(id)}`) : undefined;
}
