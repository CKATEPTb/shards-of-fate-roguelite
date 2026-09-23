import type { CombatChoice, CombatState, Combatant, GameContent } from '@shards/shared';
import { rollFor } from './combat-rolls';
import { runAttackTurn } from './attack-turn';
import { expireShields } from './shields';
import { chooseSkill } from './ai';
import { CombatLimitError, definitionFor, type CombatContext } from './context';
import { createContext } from './events';
import { expireStatuses, tickStatuses } from './statuses';
import { canBodyAct } from './anatomy';
import { skillForChoice, validateCombatChoice } from './combat-choice';
import { ensureInitiative } from './initiative';
import { modifiersFor } from './modifiers';
import { COMBAT_RULES } from './combat-rules';

export { combatTargets } from './combat-choice';
export function isTerminal(state: CombatState): boolean {
  return state.status === 'victory' || state.status === 'defeat' || state.status === 'draw' || state.status === 'escaped';
}
const present = (unit: Combatant): boolean => unit.hp > 0 && !unit.escaped;

function terminalOutcome(ctx: CombatContext, roundLimit: boolean): CombatState['status'] | undefined {
  const heroes = ctx.state.units.some(unit => unit.team === 'heroes' && present(unit));
  const enemies = ctx.state.units.some(unit => unit.team === 'enemies' && present(unit));
  if (heroes && enemies && !roundLimit) return undefined;
  if (!heroes && ctx.state.units.some(unit => unit.team === 'heroes' && unit.escaped)) return 'escaped';
  return heroes && !enemies ? 'victory' : enemies && !heroes ? 'defeat' : 'draw';
}

function finishIfNeeded(ctx: CombatContext, roundLimit = false): boolean {
  const outcome = terminalOutcome(ctx, roundLimit);
  if (!outcome) return false;
  delete ctx.state.pendingActorId;
  ctx.state.status = outcome;
  const labels: Partial<Record<CombatState['status'], string>> = { victory: 'Победа', defeat: 'Поражение', draw: 'Ничья', escaped: 'Отступление' };
  const eventIndex = ctx.state.events.length;
  ctx.emit({ type: 'COMBAT_ENDED', message: `Бой завершён: ${labels[outcome]}` });
  const finalOutcome = terminalOutcome(ctx, roundLimit) ?? outcome;
  ctx.state.status = finalOutcome;
  ctx.state.events[eventIndex].message = `Бой завершён: ${labels[finalOutcome]}`;
  return true;
}

function beginRound(ctx: CombatContext): void {
  ctx.state.round++;
  ctx.emit({ type: 'ROUND_STARTED', message: `Раунд ${ctx.state.round}` });
  ctx.state.turnOrder = ensureInitiative(ctx, COMBAT_RULES.initiative === 'round');
  ctx.state.turnIndex = 0;
}

function completeTurn(ctx: CombatContext, actor: Combatant): void {
  if (present(actor)) tickStatuses(ctx, actor, 'TURN_ENDED');
  ctx.emit({ type: 'TURN_ENDED', actorId: actor.id, message: `${actor.name}: конец хода` });
  if (!actor.escaped) { expireStatuses(ctx, actor); expireShields(ctx, actor); }
  delete ctx.state.pendingActorId;
  ctx.state.turnIndex++;
  finishIfNeeded(ctx);
}

function enemyAction(ctx: CombatContext, actor: Combatant): void {
  const skill = chooseSkill(ctx, actor);
  if (skill) {
    actor.cooldowns[skill.id] = skill.cooldown;
    ctx.emit({ type: 'SKILL_USED', actorId: actor.id, skillId: skill.id, message: `${actor.name}: ${skill.name}` });
    runAttackTurn(ctx, actor, skill.actions, skill.target, skill.id);
  } else runAttackTurn(ctx, actor, [definitionFor(ctx, actor.definitionId).basicAttack], 'enemy');
}

/** Prepare one turn. Enemy decisions are confined to their own turn; heroes always wait. */
function advance(state: CombatState, content: GameContent): void {
  if (state.pendingActorId) return;
  const ctx = createContext(state, content);
  if (state.status === 'ready') {
    state.status = 'running';
    ctx.emit({ type: 'COMBAT_STARTED', message: `Начало боя · seed: ${state.seed}` });
  }
  if (finishIfNeeded(ctx)) return;
  while (true) {
    while (state.turnIndex < state.turnOrder.length && !state.units.some(unit => unit.id === state.turnOrder[state.turnIndex] && present(unit))) state.turnIndex++;
    if (state.turnIndex < state.turnOrder.length) break;
    if (state.round >= content.balance.maxRounds) { finishIfNeeded(ctx, true); return; }
    beginRound(ctx);
    if (finishIfNeeded(ctx)) return;
  }
  const actor = state.units.find(unit => unit.id === state.turnOrder[state.turnIndex])!;
  state.turn++;
  actor.turnsTaken++;
  for (const cooldowns of [actor.cooldowns, actor.effectCooldowns]) for (const id of Object.keys(cooldowns)) cooldowns[id] = Math.max(0, cooldowns[id] - 1);
  expireStatuses(ctx, actor, 'TURN_STARTED');
  ctx.emit({ type: 'TURN_STARTED', actorId: actor.id, message: `${actor.name}: начало хода` });
  tickStatuses(ctx, actor, 'TURN_STARTED');
  if (present(actor) && state.units.some(unit => unit.team !== actor.team && present(unit))) {
    if (actor.team === 'heroes') { state.pendingActorId = actor.id; return; }
    if (!actor.body || canBodyAct(actor.body)) enemyAction(ctx, actor);
  }
  completeTurn(ctx, actor);
}

export function stepCombat(state: CombatState, content: GameContent): CombatState {
  if (isTerminal(state) || state.pendingActorId) return state;
  const updated = structuredClone(state);
  advance(updated, content);
  return updated;
}

function attemptEscape(ctx: CombatContext, actor: Combatant): void {
  const enemies = ctx.state.units.filter(unit => unit.team !== actor.team && present(unit));
  const enemyLevel = Math.max(1, ...enemies.map(unit => ctx.content.enemies.find(enemy => enemy.id === unit.definitionId)?.level ?? 1));
  const bonus = (actor.stats.agility ?? 0) + modifiersFor(ctx, actor).agilityBonus - enemyLevel;
  const total = rollFor(ctx, actor, '1d20', 'flee', bonus);
  if (!present(actor)) return;
  if (total < COMBAT_RULES.escapeTarget) {
    ctx.emit({ type: 'FLEE_FAILED', actorId: actor.id, amount: total, message: `${actor.name}: побег не удался — нужно ${COMBAT_RULES.escapeTarget}, выпало ${total}` });
    return;
  }
  const escaping = COMBAT_RULES.escapeScope === 'party' ? ctx.state.units.filter(unit => unit.team === actor.team && present(unit)) : [actor];
  for (const unit of escaping) {
    unit.escaped = true;
    ctx.emit({ type: 'FLEE_SUCCEEDED', actorId: unit.id, amount: total, message: `${unit.name}: покидает бой` });
  }
}

/** One validated choice consumes exactly one prepared turn, including a failed escape. */
export function submitCombatAction(state: CombatState, content: GameContent, choice: CombatChoice): CombatState {
  validateCombatChoice(state, content, choice);
  const updated = structuredClone(state);
  const ctx = createContext(updated, content);
  const actor = updated.units.find(unit => unit.id === choice.actorId)!;
  delete updated.pendingActorId;
  if (choice.type === 'flee') attemptEscape(ctx, actor);
  else {
    const skill = skillForChoice(updated, content, choice);
    if (skill) {
      actor.cooldowns[skill.id] = skill.cooldown;
      ctx.emit({ type: 'SKILL_USED', actorId: actor.id, targetId: choice.targetId, skillId: skill.id, message: `${actor.name}: ${skill.name}` });
    }
    runAttackTurn(ctx, actor, skill?.actions ?? [definitionFor(ctx, actor.definitionId).basicAttack], skill?.target ?? 'enemy', skill?.id, choice.targetId);
  }
  completeTurn(ctx, actor);
  return updated;
}

export type CombatDecisionPolicy = (state: CombatState, content: GameContent) => CombatChoice;

/** Batch helper for authored replays/tools. Without an explicit policy it stops at the first hero decision. */
export function runCombat(state: CombatState, content: GameContent, policy?: CombatDecisionPolicy,
  options: { eventHistoryLimit?: number } = {}): CombatState {
  if (options.eventHistoryLimit !== undefined && (!Number.isInteger(options.eventHistoryLimit) || options.eventHistoryLimit < 1)) throw new Error('Event history limit must be a positive integer');
  let updated = structuredClone(state);
  const limit = content.balance.maxRounds * updated.units.length * 2 + 2;
  for (let index = 0; !isTerminal(updated); index++) {
    if (index >= limit) throw new CombatLimitError('Maximum combat steps exceeded');
    const firstSequence = updated.nextSequence;
    if (updated.pendingActorId) {
      if (!policy) return updated;
      updated = submitCombatAction(updated, content, policy(updated, content));
    } else advance(updated, content);
    // Optional offline retention is applied only after a complete transition.
    // Triggers and aura ticks can inspect every event of their current turn.
    if (options.eventHistoryLimit !== undefined) {
      const keep = Math.max(options.eventHistoryLimit, updated.nextSequence - firstSequence);
      if (updated.events.length > keep) updated.events = updated.events.slice(-keep);
    }
  }
  return updated;
}
