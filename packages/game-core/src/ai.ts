import type { Combatant, SkillDefinition } from '@shards/shared';
import { compareIds, definitionFor, type CombatContext } from './context';
import { selectTargets } from './targets';
import { canBodyAct, healableHealthRatio } from './anatomy';

export function chooseSkill(ctx: CombatContext, actor: Combatant): SkillDefinition | undefined {
  if (actor.body && !canBodyAct(actor.body)) return undefined;
  const skills = definitionFor(ctx, actor.definitionId).skillIds.map(id => {
    const skill = ctx.content.skills.find(candidate => candidate.id === id);
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    return skill;
  }).sort((a, b) => b.priority - a.priority || compareIds(a.id, b.id));
  return skills.find(skill => {
    if ((actor.cooldowns[skill.id] ?? 0) > 0 || !selectTargets(ctx, actor, skill.target).length) return false;
    if (skill.condition === 'hasOtherAlly') return ctx.state.units.some(unit => unit.team === actor.team && unit.id !== actor.id && unit.hp > 0);
    if (skill.condition === 'selfWounded') return healableHealthRatio(actor) < ctx.content.balance.healThreshold;
    if (skill.condition === 'allyWounded') return ctx.state.units.some(unit => unit.team === actor.team && unit.hp > 0 && healableHealthRatio(unit) < ctx.content.balance.healThreshold);
    return true;
  });
}
