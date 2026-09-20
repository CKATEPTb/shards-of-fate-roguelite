import type { BodyResources, Combatant, HeroBody, StarterEquipment, Stats, UnitDefinition } from '@shards/shared';
import { bodyCombatHealth, bodyHealthRatio, bodyMaxHealth } from './body';

export interface EquipmentCondition { active: boolean; fraction: number; armor: number; resources: Partial<BodyResources> }

export function equipmentCondition(item: StarterEquipment, body: HeroBody): EquipmentCondition {
  const present = item.bodyParts.filter(part => body[part].current > 0);
  const fraction = item.bodyParts.length ? present.length / item.bodyParts.length : 1;
  return { active: fraction > 0, fraction, armor: item.armor * fraction, resources: Object.fromEntries(present.filter(part => item.resources[part] !== undefined).map(part => [part, item.resources[part]])) };
}

export function effectiveBodyArmor(definition: UnitDefinition, body: HeroBody): number {
  return Math.max(0, definition.stats.armor - (definition.anatomy?.equipment.reduce((lost, item) => lost + item.armor * (1 - equipmentCondition(item, body).fraction), 0) ?? 0));
}

export function bodyCombatStats(definition: UnitDefinition, body: HeroBody): Stats {
  const stats = { ...definition.stats, maxHp: bodyMaxHealth(body), armor: effectiveBodyArmor(definition, body) };
  for (const item of definition.anatomy?.equipment ?? []) {
    const lost = 1 - equipmentCondition(item, body).fraction;
    stats.power = Math.max(0, stats.power - (item.bonuses?.power ?? 0) * lost);
    stats.healing = Math.max(0, stats.healing - (item.bonuses?.healing ?? 0) * lost);
  }
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
