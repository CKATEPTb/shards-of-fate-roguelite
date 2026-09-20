import type { CombatState, GameContent } from '@shards/shared';
import { rollFor } from './combat-rolls';
import { runAttackTurn } from './attack-turn';
import { expireShields } from './shields';
import { chooseSkill } from './ai';
import { CombatLimitError, compareIds, definitionFor, type CombatContext } from './context';
import { createContext } from './events';
import { expireStatuses, tickStatuses } from './statuses';
import { canBodyAct } from './anatomy';

export function isTerminal(state: CombatState): boolean { return state.status === 'victory' || state.status === 'defeat' || state.status === 'draw'; }

function terminalOutcome(ctx: CombatContext, roundLimit: boolean): 'victory' | 'defeat' | 'draw' | undefined {
  const heroes = ctx.state.units.some(unit => unit.team === 'heroes' && unit.hp > 0);
  const enemies = ctx.state.units.some(unit => unit.team === 'enemies' && unit.hp > 0);
  if (heroes && enemies && !roundLimit) return undefined;
  return heroes && !enemies ? 'victory' : enemies && !heroes ? 'defeat' : 'draw';
}

function finishIfNeeded(ctx: CombatContext, roundLimit = false): boolean {
  const outcome = terminalOutcome(ctx, roundLimit);
  if (!outcome) return false;
  ctx.state.status = outcome;
  const labels = { victory: 'Победа', defeat: 'Поражение', draw: 'Ничья' };
  const eventIndex = ctx.state.events.length;
  ctx.emit({ type: 'COMBAT_ENDED', message: `Бой завершён: ${labels[outcome]}` });
  // Terminal triggers may kill remaining actors, but healing never revives a corpse.
  const finalOutcome = terminalOutcome(ctx, roundLimit) ?? outcome;
  ctx.state.status = finalOutcome;
  ctx.state.events[eventIndex].message = `Бой завершён: ${labels[finalOutcome]}`;
  return true;
}

function beginRound(ctx: CombatContext): void {
  ctx.state.round++;
  ctx.emit({ type: 'ROUND_STARTED', message: `Раунд ${ctx.state.round}` });
  const initiative = ctx.state.units.filter(unit => unit.hp > 0).map(unit => ({ unit, roll: rollFor(ctx, unit, 'd20', 'initiative', unit.stats.initiative) }));
  ctx.state.turnOrder = initiative.sort((a, b) => b.roll - a.roll || compareIds(a.unit.id, b.unit.id)).map(entry => entry.unit.id);
  ctx.state.turnIndex = 0;
}

function advance(state: CombatState, content: GameContent): void {
  const ctx = createContext(state, content);
  if (state.status === 'ready') {
    state.status = 'running';
    ctx.emit({ type: 'COMBAT_STARTED', message: `Начало боя · seed: ${state.seed}` });
  }
  if (finishIfNeeded(ctx)) return;
  while (true) {
    while (state.turnIndex < state.turnOrder.length && !state.units.some(unit => unit.id === state.turnOrder[state.turnIndex] && unit.hp > 0)) state.turnIndex++;
    if (state.turnIndex < state.turnOrder.length) break;
    if (state.round >= content.balance.maxRounds) { finishIfNeeded(ctx, true); return; }
    beginRound(ctx);
    if (finishIfNeeded(ctx)) return;
  }
  const actor = state.units.find(unit => unit.id === state.turnOrder[state.turnIndex])!;
  state.turn++;
  actor.turnsTaken++;
  for (const cooldowns of [actor.cooldowns, actor.effectCooldowns]) for (const id of Object.keys(cooldowns)) cooldowns[id] = Math.max(0, cooldowns[id] - 1);
  ctx.emit({ type: 'TURN_STARTED', actorId: actor.id, message: `${actor.name}: начало хода` });
  tickStatuses(ctx, actor, 'TURN_STARTED');
  if (actor.hp > 0 && (!actor.body || canBodyAct(actor.body)) && state.units.some(unit => unit.team !== actor.team && unit.hp > 0)) {
    const skill = chooseSkill(ctx, actor);
    if (skill) {
      actor.cooldowns[skill.id] = skill.cooldown;
      ctx.emit({ type: 'SKILL_USED', actorId: actor.id, skillId: skill.id, message: `${actor.name}: ${skill.name}` });
      runAttackTurn(ctx, actor, skill.actions, skill.target, skill.id);
    } else runAttackTurn(ctx, actor, [definitionFor(ctx, actor.definitionId).basicAttack], 'enemy');
  }
  tickStatuses(ctx, actor, 'TURN_ENDED');
  ctx.emit({ type: 'TURN_ENDED', actorId: actor.id, message: `${actor.name}: конец хода` });
  expireStatuses(ctx, actor);
  expireShields(ctx, actor);
  state.turnIndex++;
  finishIfNeeded(ctx);
}

/** Resolves exactly one full living actor turn, or ends a battle at its round cap. */
export function stepCombat(state: CombatState, content: GameContent): CombatState {
  const updated = structuredClone(state);
  if (!isTerminal(updated)) advance(updated, content);
  return updated;
}

/** Uses the same transition as stepCombat while avoiding a complete log clone each turn. */
export function runCombat(state: CombatState, content: GameContent): CombatState {
  const updated = structuredClone(state);
  const limit = content.balance.maxRounds * updated.units.length + 2;
  for (let index = 0; !isTerminal(updated); index++) {
    if (index >= limit) throw new CombatLimitError('Maximum combat steps exceeded');
    advance(updated, content);
  }
  return updated;
}
