import { weaponAttackBonusMultiplier, type ActionDefinition, type AttackHand, type AttackSlot, type BodyPart, type Combatant, type CombatEvent, type TargetSelector } from '@shards/shared';
import { definitionFor, type CombatContext } from './context';
import { damageReductionFor, modifiersFor, modifierSourcesFor } from './modifiers';
import { matchesTargetRelation, selectTargets } from './targets';
import { bodyPartArmor, bodyPartForRoll, canBodyAct, damageBody, isBodyPartPresent, syncBodyCombatant } from './anatomy';
import { rollFor } from './combat-rolls';
import { applyHealing } from './healing';
import { absorbDamage, addShield } from './shields';
import { getDifficultyProfile } from './difficulty';
import { weaponAttacksFor, weaponPowerFor } from './weapon-attacks';
import { rollArmorDefense, rollCritical } from './combat-attributes';

export { rollFor } from './combat-rolls';

export interface ActionContext {
  source: Combatant;
  target: TargetSelector;
  targetId?: string;
  /** Already resolved skill selectors, including a random target, shared by every strike. */
  selectedTargets?: ReadonlyMap<TargetSelector, readonly Combatant[]>;
  origin: 'attack' | 'effect' | 'status';
  event?: CombatEvent;
  skillId?: string;
  statusId?: string;
  remaining?: number | null;
  stacks?: number;
  bearer?: Combatant;
  /** Only basic attacks expand into the equipped weapon sequence; skills run once. */
  basicWeaponAttack?: boolean;
  attackHand?: AttackHand;
  attackSlot?: AttackSlot;
  weaponPower?: number;
  /** Bonus contribution for one basic strike; never repeats on-hit effects or skills. */
  weaponBonusMultiplier?: 1 | 2;
}

function actionAmount(ctx: CombatContext, action: ActionDefinition, options: ActionContext): number {
  if (action.damagePerStack !== undefined) return Math.max(0, Math.floor(action.damagePerStack * (options.stacks ?? 1)));
  const modifiers = modifiersFor(ctx, options.source);
  // Legacy scaling:healing is only an alias; every scaled action uses the same Power.
  // The per-hand override exists solely for basic weapon strikes, never for a skill.
  const stat = action.scaling ? Math.max(0, (options.weaponPower ?? options.source.stats.power) + modifiers.powerBonus) : 0;
  const bonusMultiplier = options.weaponBonusMultiplier ?? 1;
  const scaling = bonusMultiplier * (Math.floor(stat * (action.factor ?? 1)) + (action.type === 'damage' ? modifiers.damageBonus : 0));
  let amount = action.dice ? rollFor(ctx, options.source, action.dice, action.type, scaling, attackIdentity(options)) : scaling;
  // Each independent blessing contributes its own die; buffs never disappear through reduction into one string.
  if (action.type === 'damage' && options.origin === 'attack') {
    for (const modifier of modifierSourcesFor(ctx, options.source)) if (modifier.damageBonusDice) {
      for (let contribution = 0; contribution < bonusMultiplier; contribution++) {
        amount += rollFor(ctx, options.source, modifier.damageBonusDice, 'бонус к урону', 0, attackIdentity(options));
      }
    }
  }
  const duration = action.scaleWithRemainingDuration ? options.remaining ?? 1 : 1;
  return Math.max(0, Math.floor(amount * duration));
}

function attackIdentity(options: ActionContext): Pick<CombatEvent, 'attackHand' | 'attackSlot'> {
  return options.attackHand ? { attackHand: options.attackHand, attackSlot: options.attackSlot } : {};
}

function canContinueAttack(ctx: CombatContext, options: ActionContext, target: Combatant): boolean {
  if (target.hp <= 0 || target.escaped) return false;
  if (options.origin !== 'attack') return true;
  if (options.source.hp <= 0 || options.source.escaped || options.source.body && !canBodyAct(options.source.body)) return false;
  return !options.attackSlot || !!weaponAttacksFor(ctx, options.source)?.some(attack => attack.attackSlot === options.attackSlot && attack.attackHand === options.attackHand);
}

function dealDamage(ctx: CombatContext, action: ActionDefinition, options: ActionContext, target: Combatant): 'miss' | void {
  const source = options.source;
  const identity = attackIdentity(options);
  let critical = false;
  let bodyPart: BodyPart | undefined;
  if (options.origin === 'attack') {
    ctx.emit({ type: 'ATTACK_STARTED', actorId: source.id, targetId: target.id, skillId: options.skillId, ...identity, message: `${source.name} атакует${options.attackHand ? ` ${options.attackHand === 'right' ? 'правой' : 'левой'} рукой` : ''}: ${target.name}` });
    if (!canContinueAttack(ctx, options, target)) return;
  }
  if (target.body) {
    const selected = options.origin === 'status' ? 'torso' : bodyPartForRoll(rollFor(ctx, source, 'd20', 'body', 0, identity));
    if (!canContinueAttack(ctx, options, target)) return;
    // Location never makes an otherwise guaranteed hit miss. An absent limb is
    // redirected before defence, so the torso's armour protects the actual target.
    bodyPart = selected && isBodyPartPresent(target.body, selected) ? selected : 'torso';
  }
  if (options.origin === 'attack') {
    const bonuses = modifiersFor(ctx, source);
    const accuracy = (source.stats.accuracy ?? 0) + bonuses.accuracyBonus;
    const face = rollFor(ctx, source, '1d20', 'accuracy', 0, identity);
    if (!canContinueAttack(ctx, options, target)) return;
    const evasion = target.stats.evasion + modifiersFor(ctx, target).evasionBonus;
    const threshold = evasion - accuracy;
    const detail = ` (d20: ${face}; попадание выше ${threshold}; уклонение ${evasion}, точность ${accuracy >= 0 ? '+' : ''}${accuracy})`;
    if (face === 1 || face !== 20 && face <= threshold) {
      ctx.emit({ type: 'MISS', actorId: source.id, targetId: target.id, bodyPart, ...identity, message: `${source.name}: промах по цели ${target.name}${detail}` });
      return 'miss';
    }
    ctx.emit({ type: 'HIT', actorId: source.id, targetId: target.id, bodyPart, ...identity, message: `${source.name}: попадание по цели ${target.name}${detail}` });
    if (!canContinueAttack(ctx, options, target)) return;
    critical = rollCritical(ctx, source, target, 'damage', identity);
    if (!canContinueAttack(ctx, options, target)) return;
    if (critical) ctx.emit({ type: 'CRIT', actorId: source.id, targetId: target.id, skillId: options.skillId, bodyPart, ...identity, message: `${source.name}: критическое попадание, итоговый урон ×2` });
  }
  if (!canContinueAttack(ctx, options, target)) return;
  const modifiers = modifiersFor(ctx, source);
  const difficulty = source.team === 'enemies' && action.damagePerStack === undefined ? getDifficultyProfile(ctx.content, ctx.state.difficultyId).enemyDamageMultiplier : 1;
  const amount = actionAmount(ctx, action, options);
  const raw = Math.max(0, Math.floor(amount * (critical ? 2 : 1) * difficulty));
  if (!canContinueAttack(ctx, options, target)) return;
  const localArmor = target.body && bodyPart ? bodyPartArmor(definitionFor(ctx, target.definitionId), target.body, bodyPart) : target.stats.armor;
  const armor = action.bypassArmor || raw === 0 ? 0 : rollArmorDefense(ctx, target, localArmor + modifiersFor(ctx, target).armorBonus);
  if (!canContinueAttack(ctx, options, target)) return;
  let damage = Math.max(0, Math.floor(raw - armor - (action.bypassArmor ? 0 : damageReductionFor(ctx, target))));
  let guarded = Math.min(raw, armor);
  if (modifiersFor(ctx, target).invulnerable) {
    guarded += damage;
    damage = 0;
  } else if (options.origin === 'attack' && damage > 0) {
    for (const guardian of ctx.state.units.filter(unit => unit.team === target.team && unit.hp > 0 && !unit.escaped)) {
      const guardDice = modifiersFor(ctx, guardian).partyGuardDice;
      if (!guardDice || damage <= 0) continue;
      const protection = Math.min(damage, Math.max(0, rollFor(ctx, guardian, guardDice, 'защита союзника')));
      if (!canContinueAttack(ctx, options, target)) return;
      damage -= protection;
      guarded += protection;
    }
  }
  if (guarded > 0) ctx.emit({ type: 'BLOCKED', actorId: source.id, targetId: target.id, amount: guarded, ...identity,
    message: `${target.name}: защита блокирует ${guarded} урона${damage === 0 ? ' полностью' : ''}` });
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
  ctx.emit({ type: 'DAMAGE', actorId: source.id, targetId: target.id, skillId: options.skillId, statusId: options.statusId, bodyPart, ...identity, amount: actual, shieldAfter: target.shield, shieldLayersAfter: structuredClone(target.shieldLayers ?? []), message: `${target.name}${bodyPart ? `, ${parts[bodyPart]}` : ''}: −${actual}${absorbed ? ` (щит поглотил ${absorbed})` : ''}` });
  if (previousShield > 0 && target.shield === 0) ctx.emit({ type: 'SHIELD_BROKEN', actorId: source.id, targetId: target.id, shieldAfter: 0, shieldLayersAfter: [], message: `${target.name}: щит разрушен` });
  if (died) ctx.emit({ type: 'ENTITY_DIED', actorId: source.id, targetId: target.id, message: `${target.name}: поражён` });
  if (action.onHitStatusId && target.hp > 0 && !target.escaped) applyStatus(ctx,
    { type: 'status', statusId: action.onHitStatusId, duration: action.onHitDuration ?? null }, source, target);
  if (options.origin === 'attack' && source.team !== target.team && source.hp > 0 && !source.escaped && actual > 0 && modifiers.vampirismDice) {
    applyHealing(ctx, source, source, Math.min(actual, rollFor(ctx, source, modifiers.vampirismDice, 'вампиризм')));
  }
}

function applyStatus(ctx: CombatContext, action: ActionDefinition, source: Combatant, target: Combatant): void {
  const definition = ctx.content.statuses.find(status => status.id === action.statusId);
  if (!definition || action.duration !== null && (!Number.isInteger(action.duration) || action.duration! < 1)) throw new Error(`Invalid status action: ${action.statusId}`);
  const previous = definition.stacking === 'decay' ? target.statuses.find(status => status.id === definition.id)
    : definition.stacking === 'refresh' ? target.statuses.find(status => status.id === definition.id && status.sourceId === source.id) : undefined;
  if (previous) {
    if (action.duration === null || previous.remaining !== null && action.duration! >= previous.remaining) {
      previous.remaining = action.duration!;
      previous.sourceId = source.id;
      previous.appliedTurn = ctx.state.turn;
    }
  }
  const status = previous ?? { id: definition.id, instanceId: `aura-${ctx.state.nextSequence}`, sourceId: source.id, remaining: action.duration!, appliedTurn: ctx.state.turn, ...(definition.stacking === 'decay' ? { stacks: 0 } : {}) };
  if (definition.stacking === 'decay') {
    status.stacks = (status.stacks ?? 1) + 1;
    status.remaining = null;
    status.sourceId = source.id;
  }
  if (!previous) target.statuses.push(status);
  ctx.emit({ type: 'STATUS_APPLIED', actorId: source.id, targetId: target.id, statusId: definition.id, statusInstanceId: status.instanceId, statusRemaining: status.remaining, statusStacks: status.stacks, amount: status.remaining ?? undefined,
    message: `${target.name}: ${definition.name} (${status.stacks !== undefined ? `стаков: ${status.stacks}` : status.remaining === null ? 'бессрочно' : `ходов: ${status.remaining}`})` });
}

function executeAction(ctx: CombatContext, action: ActionDefinition, options: ActionContext, target: Combatant): 'miss' | void {
  if (target.hp <= 0 || target.escaped) return;
  if (action.type === 'damage') {
    const attacks = options.basicWeaponAttack ? weaponAttacksFor(ctx, options.source) : undefined;
    if (attacks === undefined) {
      let landed = false;
      for (let hit = 0; hit < (action.hits ?? 1); hit++) {
        if (!canContinueAttack(ctx, options, target)) break;
        if (dealDamage(ctx, action, options, target) !== 'miss') landed = true;
      }
      return landed ? undefined : 'miss';
    }
    let landed = false;
    let missed = false;
    for (const attack of attacks) {
      const strike: ActionContext = { ...options, attackHand: attack.attackHand, attackSlot: attack.attackSlot,
        weaponPower: weaponPowerFor(ctx, options.source, attack), weaponBonusMultiplier: weaponAttackBonusMultiplier(attack.item.weapon) };
      // The original target remains selected: the second hand never retargets a corpse.
      if (!canContinueAttack(ctx, strike, target)) continue;
      const result = dealDamage(ctx, { ...action, dice: attack.item.weapon!.damage }, strike, target);
      if (result === 'miss') missed = true;
      else landed = true;
    }
    return missed && !landed ? 'miss' : undefined;
  }
  if (action.type === 'status') return applyStatus(ctx, action, options.source, target);
  const critical = action.type === 'heal' && options.origin === 'attack' && rollCritical(ctx, options.source, target, 'heal');
  if (target.hp <= 0 || target.escaped || options.origin === 'attack' && (options.source.hp <= 0 || options.source.escaped)) return;
  if (critical) ctx.emit({ type: 'CRIT', actorId: options.source.id, targetId: target.id, skillId: options.skillId,
    rollReason: 'heal', message: `${options.source.name}: критическое исцеление, итоговое лечение ×2` });
  // Small-party enemies have smaller health pools; leaving their fixed healing
  // and shield dice at full strength can make a solo encounter an endless duel.
  // Read the scale of this spawned enemy: joining heroes do not resize enemies.
  const supportScale = options.source.team === 'enemies'
    ? Math.min(1, options.source.stats.maxHp / (definitionFor(ctx, options.source.definitionId).stats.maxHp
      * getDifficultyProfile(ctx.content, ctx.state.difficultyId).enemyHpMultiplier)) : 1;
  const amount = Math.floor(actionAmount(ctx, action, options) * (critical ? 2 : 1) * supportScale);
  if (target.hp <= 0) return;
  if (action.type === 'shield') {
    addShield(ctx, options.source, target, amount, action.duration);
    return;
  }
  applyHealing(ctx, options.source, target, amount);
}

export function runActions(ctx: CombatContext, actions: ActionDefinition[], options: ActionContext): { attemptedDamageTargets: ReadonlySet<string> } {
  const selected = new Map<TargetSelector, readonly Combatant[]>(options.selectedTargets);
  const missedTargets = new Set<string>();
  const attemptedDamageTargets = new Set<string>();
  for (const action of actions) {
    if (options.origin !== 'status' && (options.source.escaped || options.source.hp <= 0)) break;
    if (options.origin === 'attack' && options.source.body && !canBodyAct(options.source.body)) break;
    const selector = action.target ?? options.target;
    if (!selected.has(selector)) selected.set(selector, options.bearer && selector === 'self' ? [options.bearer]
      : selectTargets(ctx, options.source, selector, options.event, selector === options.target ? options.targetId : undefined));
    const targets = selected.get(selector)!;
    for (const target of targets) {
      if (missedTargets.has(target.id)) continue;
      if (target.hp <= 0 || target.escaped || !matchesTargetRelation(options.source, target, action.targetRelation)) continue;
      if (action.type === 'damage') attemptedDamageTargets.add(target.id);
      if (executeAction(ctx, action, options, target) === 'miss') missedTargets.add(target.id);
    }
  }
  return { attemptedDamageTargets };
}
