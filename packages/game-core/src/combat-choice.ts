import type { CombatChoice, CombatState, Combatant, GameContent, SkillDefinition, TargetSelector } from '@shards/shared';
import { definitionFor } from './context';
import { createContext } from './events';
import { eligibleTargets, isRandomTargetSelector } from './targets';
import { canBodyAct } from './anatomy';

export function skillForChoice(state: CombatState, content: GameContent, choice: CombatChoice): SkillDefinition | undefined {
  if (choice.type !== 'skill') return undefined;
  const actor = state.units.find(unit => unit.id === choice.actorId);
  if (!actor || !choice.skillId) return undefined;
  const definition = definitionFor(createContext(state, content), actor.definitionId);
  return definition.skillIds.includes(choice.skillId) ? content.skills.find(skill => skill.id === choice.skillId) : undefined;
}

/** Enumerating targets never rolls dice or runs effects. Both the UI and command boundary use this. */
export function combatTargets(state: CombatState, content: GameContent, choice: CombatChoice): Combatant[] {
  const actor = state.units.find(unit => unit.id === choice.actorId && unit.hp > 0 && !unit.escaped);
  if (!actor || choice.type === 'flee') return [];
  const skill = skillForChoice(state, content, choice);
  if (choice.type === 'skill' && !skill) return [];
  const selector: TargetSelector = skill?.target ?? 'enemy';
  const candidates = eligibleTargets(createContext(state, content), actor, selector);
  // A caster anchor reports availability without rolling or exposing a fake random choice.
  // Automatic cards may be released anywhere; the command carries no target ID.
  return isRandomTargetSelector(selector) ? candidates.length ? [actor] : [] : candidates;
}

export function validateCombatChoice(state: CombatState, content: GameContent, choice: CombatChoice): Combatant {
  const actor = state.units.find(unit => unit.id === choice.actorId && unit.hp > 0 && !unit.escaped);
  if (state.status !== 'running' || !actor || actor.team !== 'heroes' || state.pendingActorId !== actor.id) throw new Error('Сейчас не ход этого героя');
  if (!['attack', 'skill', 'flee'].includes(choice.type)) throw new Error('Неизвестное действие');
  if (choice.type !== 'flee' && actor.body && !canBodyAct(actor.body)) throw new Error('Без сохранившихся рук доступен только побег');
  const skill = skillForChoice(state, content, choice);
  if (choice.type === 'skill') {
    if (!skill) throw new Error('Навык недоступен этому герою');
    if ((actor.cooldowns[skill.id] ?? 0) > 0) throw new Error('Навык ещё восстанавливается');
  } else if (choice.skillId !== undefined) throw new Error('У этого действия нет навыка');
  if (choice.type === 'flee') {
    if (choice.targetId !== undefined) throw new Error('Для побега цель не нужна');
  } else if (skill && isRandomTargetSelector(skill.target)) {
    if (choice.targetId !== undefined) throw new Error('Случайную цель выбирает кубик');
    if (!eligibleTargets(createContext(state, content), actor, skill.target).length) throw new Error('Для навыка нет живой цели');
  } else if (!combatTargets(state, content, choice).some(unit => unit.id === choice.targetId)) throw new Error('Выберите подходящую живую цель');
  return actor;
}
