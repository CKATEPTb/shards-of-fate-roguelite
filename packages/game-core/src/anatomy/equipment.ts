import { attackHandForSlot, occupiedHandSlots, type BodyPart, type BodyResources, type Combatant, type HeroBody, type StarterEquipment, type Stats, type UnitDefinition } from '@shards/shared';
import { bodyCombatHealth, bodyHealthRatio, bodyMaxHealth, isBodyPartFunctional, isBodyPartPresent } from './body';

export interface EquipmentCondition { active: boolean; fraction: number; bonusFraction: number; armor: number; resources: Partial<BodyResources> }

export function equipmentCondition(item: StarterEquipment, body: HeroBody): EquipmentCondition {
  const hands = occupiedHandSlots(item);
  const usable = hands.every(slot => isBodyPartFunctional(body, `${attackHandForSlot(slot)}Arm`));
  const present = item.bodyParts.filter(part => isBodyPartPresent(body, part));
  const fraction = item.bodyParts.length ? present.length / item.bodyParts.length : 1;
  return { active: fraction > 0 && usable, fraction, bonusFraction: usable ? fraction : 0, armor: item.armor * fraction,
    resources: Object.fromEntries(present.filter(part => item.resources[part] !== undefined).map(part => [part, item.resources[part]])) };
}

/** Each covered, attached part receives the item's full local armor value. */
export function bodyPartArmor(definition: UnitDefinition, body: HeroBody, part: BodyPart): number {
  if (!isBodyPartPresent(body, part)) return 0;
  return Math.max(0, (definition.anatomy?.equipment ?? []).reduce((armor, item) => armor + (item.bodyParts.includes(part) ? item.armor : 0), 0));
}

export function effectiveBodyArmor(definition: UnitDefinition, body: HeroBody): number {
  return Math.max(0, definition.stats.armor - (definition.anatomy?.equipment.reduce((lost, item) => lost + item.armor * (1 - equipmentCondition(item, body).fraction), 0) ?? 0));
}

export function bodyCombatStats(definition: UnitDefinition, body: HeroBody): Stats {
  const stats = { ...definition.stats, maxHp: bodyMaxHealth(body), armor: effectiveBodyArmor(definition, body) };
  for (const item of definition.anatomy?.equipment ?? []) {
    const lost = 1 - equipmentCondition(item, body).bonusFraction;
    for (const key of ['power', 'initiative', 'evasion', 'crit', 'agility', 'accuracy', 'resilience', 'luck'] as const) {
      if (item.bonuses?.[key] !== undefined) stats[key] = (stats[key] ?? 0) - item.bonuses[key]! * lost;
    }
  }
  stats.power = Math.max(0, stats.power);
  return stats;
}

/** Scalar health is retained only as the combat engine's compatibility mirror. */
export function syncBodyCombatant(unit: Combatant, definition: UnitDefinition): void {
  if (!unit.body) return;
  unit.hp = bodyCombatHealth(unit.body);
  unit.stats = bodyCombatStats(definition, unit.body);
}

export function healableHealthRatio(unit: Combatant): number {
  return unit.body ? bodyHealthRatio(unit.body) : unit.hp / unit.stats.maxHp;
}
