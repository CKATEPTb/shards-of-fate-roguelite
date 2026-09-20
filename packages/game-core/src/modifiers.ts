import type { Combatant, Modifiers } from '@shards/shared';
import { definitionFor, type CombatContext } from './context';

export function modifiersFor(ctx: CombatContext, unit: Combatant): Required<Modifiers> {
  const sources = [definitionFor(ctx, unit.definitionId).modifiers, ...unit.statuses.map(status => ctx.content.statuses.find(definition => definition.id === status.id)!.modifiers)];
  return sources.reduce<Required<Modifiers>>((value, source) => ({
    damageMultiplier: value.damageMultiplier * (source.damageMultiplier ?? 1),
    damageReduction: value.damageReduction + (source.damageReduction ?? 0),
    partyDamageReduction: value.partyDamageReduction + (source.partyDamageReduction ?? 0),
    taunt: value.taunt || (source.taunt ?? false),
    vampirism: value.vampirism + (source.vampirism ?? 0),
    healingShare: value.healingShare + (source.healingShare ?? 0),
    preserveHotChance: value.preserveHotChance + (source.preserveHotChance ?? 0),
    preserveShieldChance: value.preserveShieldChance + (source.preserveShieldChance ?? 0),
    guaranteedCrit: value.guaranteedCrit || (source.guaranteedCrit ?? false),
    evasionBonus: value.evasionBonus + (source.evasionBonus ?? 0),
    repeatChance: value.repeatChance + (source.repeatChance ?? 0),
  }), { damageMultiplier: 1, damageReduction: 0, partyDamageReduction: 0, taunt: false,
    vampirism: 0, healingShare: 0, preserveHotChance: 0, preserveShieldChance: 0,
    guaranteedCrit: false, evasionBonus: 0, repeatChance: 0 });
}

export function damageReductionFor(ctx: CombatContext, target: Combatant): number {
  const local = modifiersFor(ctx, target).damageReduction;
  const party = ctx.state.units.filter(unit => unit.team === target.team && unit.hp > 0)
    .reduce((total, unit) => total + modifiersFor(ctx, unit).partyDamageReduction, 0);
  return Math.max(0, Math.min(ctx.content.balance.maxDamageReduction, local + party));
}
