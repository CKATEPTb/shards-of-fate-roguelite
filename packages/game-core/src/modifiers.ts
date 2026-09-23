import type { Combatant, Modifiers } from '@shards/shared';
import { definitionFor, type CombatContext } from './context';
import { activeEquipmentSetBonuses } from './equipment-sets';

type ResolvedModifiers = Modifiers & Required<Pick<Modifiers,
  'damageBonus' | 'damageReduction' | 'partyDamageReduction' | 'taunt' | 'guaranteedCrit' |
  'evasionBonus' | 'initiativeBonus' | 'agilityBonus' | 'invulnerable' |
  'accuracyBonus' | 'critBonus' | 'armorBonus' | 'powerBonus' | 'resilienceBonus' | 'luckBonus'>>;

/** Keep individual sources for dice bonuses; temporary auras retain their override priority. */
export function modifierSourcesFor(ctx: CombatContext, unit: Combatant): Modifiers[] {
  const definition = definitionFor(ctx, unit.definitionId);
  return [definition.modifiers,
    ...activeEquipmentSetBonuses(definition, unit.body).flatMap(set => set.bonuses.flatMap(bonus =>
      bonus.aura ? [bonus.modifiers, bonus.aura.modifiers] : [bonus.modifiers])),
    ...unit.statuses.flatMap(status => {
      const statusDefinition = ctx.content.statuses.find(candidate => candidate.id === status.id);
      return statusDefinition ? [statusDefinition.modifiers] : [];
    })];
}

export function modifiersFor(ctx: CombatContext, unit: Combatant): ResolvedModifiers {
  return modifierSourcesFor(ctx, unit).reduce<ResolvedModifiers>((value, source) => ({
    ...value, ...source,
    damageBonus: value.damageBonus + (source.damageBonus ?? 0),
    damageReduction: value.damageReduction + (source.damageReduction ?? 0),
    partyDamageReduction: value.partyDamageReduction + (source.partyDamageReduction ?? 0),
    taunt: value.taunt || (source.taunt ?? false),
    guaranteedCrit: value.guaranteedCrit || (source.guaranteedCrit ?? false),
    invulnerable: value.invulnerable || (source.invulnerable ?? false),
    evasionBonus: value.evasionBonus + (source.evasionBonus ?? 0),
    initiativeBonus: value.initiativeBonus + (source.initiativeBonus ?? 0),
    agilityBonus: value.agilityBonus + (source.agilityBonus ?? 0),
    accuracyBonus: value.accuracyBonus + (source.accuracyBonus ?? 0),
    critBonus: value.critBonus + (source.critBonus ?? 0),
    armorBonus: value.armorBonus + (source.armorBonus ?? 0),
    powerBonus: value.powerBonus + (source.powerBonus ?? 0),
    resilienceBonus: value.resilienceBonus + (source.resilienceBonus ?? 0),
    luckBonus: value.luckBonus + (source.luckBonus ?? 0),
  }), { damageBonus: 0, damageReduction: 0, partyDamageReduction: 0, taunt: false,
    guaranteedCrit: false, invulnerable: false, evasionBonus: 0, initiativeBonus: 0, agilityBonus: 0,
    accuracyBonus: 0, critBonus: 0, armorBonus: 0, powerBonus: 0, resilienceBonus: 0, luckBonus: 0 });
}

export function damageReductionFor(ctx: CombatContext, target: Combatant): number {
  const local = modifiersFor(ctx, target).damageReduction;
  const party = ctx.state.units.filter(unit => unit.team === target.team && unit.hp > 0 && !unit.escaped)
    .reduce((total, unit) => total + modifiersFor(ctx, unit).partyDamageReduction, 0);
  return Math.max(0, Math.min(ctx.content.balance.maxDamageReduction, local + party));
}
