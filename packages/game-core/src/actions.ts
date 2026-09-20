import type { ActionDefinition, BodyPart, Combatant, CombatEvent, TargetSelector } from '@shards/shared';
import { definitionFor, type CombatContext } from './context';
import { damageReductionFor, modifiersFor } from './modifiers';
import { selectTargets } from './targets';
import { bodyPartForRoll, canBodyAct, damageBody, syncBodyCombatant } from './anatomy';
import { rollFor } from './combat-rolls';
import { applyHealing } from './healing';
import { absorbDamage, addShield } from './shields';
import { getDifficultyProfile } from './difficulty';

export { rollFor } from './combat-rolls';

export interface ActionContext {
  source: Combatant;
  target: TargetSelector;
  origin: 'attack' | 'effect' | 'status';
  event?: CombatEvent;
  skillId?: string;
  statusId?: string;
  remaining?: number;
  bearer?: Combatant;
}

function actionAmount(ctx: CombatContext, action: ActionDefinition, options: ActionContext): number {
  const dice = action.dice ? rollFor(ctx, options.source, action.dice, action.type) : 0;
  const scaling = action.scaling ? options.source.stats[action.scaling] * (action.factor ?? 1) : 0;
  const duration = action.scaleWithRemainingDuration ? options.remaining ?? 1 : 1;
  return Math.max(0, Math.floor((dice + scaling) * duration));
}

function dealDamage(ctx: CombatContext, action: ActionDefinition, options: ActionContext, target: Combatant): 'miss' | void {
  const source = options.source;
  let critical = false;
  let bodyPart: BodyPart | undefined;
  if (options.origin === 'attack') {
    ctx.emit({ type: 'ATTACK_STARTED', actorId: source.id, targetId: target.id, skillId: options.skillId, message: `${source.name} атакует: ${target.name}` });
    if (source.hp <= 0 || target.hp <= 0) return;
  }
  if (target.body) {
    const selected = options.origin === 'status' ? 'torso' : bodyPartForRoll(rollFor(ctx, source, 'd20', 'body'));
    if (selected === null) {
      ctx.emit({ type: 'MISS', actorId: source.id, targetId: target.id, message: `${source.name}: промах по цели ${target.name}` });
      return 'miss';
    }
    bodyPart = selected;
  }
  if (options.origin === 'attack') {
    const hit = rollFor(ctx, source, 'd20', 'accuracy');
    const threshold = Math.min(19, Math.max(1, Math.floor((target.stats.evasion + modifiersFor(ctx, target).evasionBonus) * 20)));
    if (hit <= threshold) {
      ctx.emit({ type: 'MISS', actorId: source.id, targetId: target.id, bodyPart, message: `${source.name}: промах по цели ${target.name}` });
      return 'miss';
    }
    critical = modifiersFor(ctx, source).guaranteedCrit || hit === 20 || hit > 20 - Math.floor(source.stats.crit * 20);
    ctx.emit({ type: 'HIT', actorId: source.id, targetId: target.id, bodyPart, message: `${source.name}: попадание по цели ${target.name}` });
    if (critical) ctx.emit({ type: 'CRIT', actorId: source.id, targetId: target.id, bodyPart, message: `${source.name}: критическое попадание` });
  }
  if (target.hp <= 0) return;
  const modifiers = modifiersFor(ctx, source);
  const repeatOverflow = options.origin === 'attack' ? 1 + Math.max(0, modifiers.repeatChance - 1) : 1;
  const difficulty = source.team === 'enemies' ? getDifficultyProfile(ctx.content, ctx.state.difficultyId).enemyDamageMultiplier : 1;
  const raw = actionAmount(ctx, action, options) * modifiers.damageMultiplier * repeatOverflow * difficulty * (critical ? ctx.content.balance.critMultiplier : 1);
  if (target.hp <= 0) return;
  const armor = 100 / (100 + Math.max(0, target.stats.armor) * ctx.content.balance.armorFactor);
  const damage = raw > 0 ? Math.max(1, Math.floor(raw * armor * (1 - damageReductionFor(ctx, target)))) : 0;
  const previousShield = target.shield;
  const absorbed = absorbDamage(ctx, target, damage);
  let actual: number;
  if (target.body && bodyPart) {
    const result = damageBody(target.body, bodyPart, damage - absorbed);
    target.body = result.body;
    bodyPart = result.part;
    actual = result.damage;
    syncBodyCombatant(target, definitionFor(ctx, target.definitionId));
  } else {
    actual = Math.min(target.hp, damage - absorbed);
    target.hp -= actual;
  }
  const died = target.hp === 0;
  const parts: Record<BodyPart, string> = { head: 'голова', torso: 'тело', leftArm: 'левая рука', rightArm: 'правая рука', leftLeg: 'левая нога', rightLeg: 'правая нога' };
  ctx.emit({ type: 'DAMAGE', actorId: source.id, targetId: target.id, skillId: options.skillId, statusId: options.statusId, bodyPart, amount: actual, message: `${target.name}${bodyPart ? `, ${parts[bodyPart]}` : ''}: −${actual}${absorbed ? ` (щит поглотил ${absorbed})` : ''}` });
  if (previousShield > 0 && target.shield === 0) ctx.emit({ type: 'SHIELD_BROKEN', actorId: source.id, targetId: target.id, message: `${target.name}: щит разрушен` });
  if (died) ctx.emit({ type: 'ENTITY_DIED', actorId: source.id, targetId: target.id, message: `${target.name}: поражён` });
  if (options.origin === 'attack' && source.team !== target.team && source.hp > 0) applyHealing(ctx, source, source, Math.floor(actual * modifiers.vampirism));
}

function applyStatus(ctx: CombatContext, action: ActionDefinition, source: Combatant, target: Combatant): void {
  const definition = ctx.content.statuses.find(status => status.id === action.statusId);
  if (!definition || !Number.isInteger(action.duration) || action.duration! < 1) throw new Error(`Invalid status action: ${action.statusId}`);
  const previous = target.statuses.find(status => status.id === definition.id);
  if (previous) {
    if (action.duration! >= previous.remaining) {
      previous.remaining = action.duration!;
      previous.sourceId = source.id;
      previous.appliedTurn = ctx.state.turn;
    }
  } else target.statuses.push({ id: definition.id, sourceId: source.id, remaining: action.duration!, appliedTurn: ctx.state.turn });
  ctx.emit({ type: 'STATUS_APPLIED', actorId: source.id, targetId: target.id, statusId: definition.id, amount: previous?.remaining ?? action.duration, message: `${target.name}: ${definition.name} (ходов: ${previous?.remaining ?? action.duration})` });
}

function executeAction(ctx: CombatContext, action: ActionDefinition, options: ActionContext, target: Combatant): 'miss' | void {
  if (target.hp <= 0) return;
  if (action.type === 'damage') return dealDamage(ctx, action, options, target);
  if (action.type === 'status') return applyStatus(ctx, action, options.source, target);
  const amount = actionAmount(ctx, action, options);
  if (target.hp <= 0) return;
  if (action.type === 'shield') {
    addShield(ctx, options.source, target, amount, action.duration);
    return;
  }
  applyHealing(ctx, options.source, target, amount);
}

export function runActions(ctx: CombatContext, actions: ActionDefinition[], options: ActionContext): void {
  const selected = new Map<TargetSelector, Combatant[]>();
  const missedTargets = new Set<string>();
  for (const action of actions) {
    if (options.origin !== 'status' && options.source.hp <= 0) break;
    if (options.origin === 'attack' && options.source.body && !canBodyAct(options.source.body)) break;
    const selector = action.target ?? options.target;
    if (!selected.has(selector)) selected.set(selector, options.bearer && selector === 'self' ? [options.bearer] : selectTargets(ctx, options.source, selector, options.event));
    const targets = selected.get(selector)!;
    for (const target of targets) {
      if (missedTargets.has(target.id)) continue;
      if (executeAction(ctx, action, options, target) === 'miss') missedTargets.add(target.id);
    }
  }
}
