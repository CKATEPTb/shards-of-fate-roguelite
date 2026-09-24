import { BODY_PARTS, weaponAttackBonusMultiplier, type ActionDefinition, type CombatChoice, type CombatState, type Combatant, type DiceCheck, type GameContent, type Modifiers, type SkillDefinition, type TargetSelector } from '@shards/shared';
import { bodyPartArmor, canBodyAct, healableHealthRatio } from './anatomy';
import { compareIds, definitionFor, type CombatContext } from './context';
import { getDifficultyProfile } from './difficulty';
import { damageReductionFor, modifiersFor, modifierSourcesFor } from './modifiers';
import { eligibleTargets, forcedTauntTarget, isRandomTargetSelector, matchesTargetRelation } from './targets';
import { weaponAttacksFor, weaponPowerFor } from './weapon-attacks';

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const alive = (unit: Combatant) => unit.hp > 0 && !unit.escaped;

/** Expectations use only authored dice expressions, never a seed or future face. */
function diceMean(expression?: string): number {
  if (!expression) return 0;
  const match = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(expression.replace(/\s/g, ''));
  return match ? Number(match[1] || 1) * (Number(match[2]) + 1) / 2 + Number(match[3] || 0) : 0;
}

function checkChance(check?: DiceCheck): number {
  if (!check) return 0;
  const match = /^(\d*)d(\d+)$/i.exec(check.dice);
  if (!match) return 0;
  const count = Number(match[1] || 1), sides = Number(match[2]);
  if (count === 1) return clamp((sides - Math.ceil(check.atLeast) + 1) / sides, 0, 1);
  // Authored repeat/preservation checks are small; exact convolution is still pure.
  if (count > 20 || count * sides > 400) return clamp((count * sides - check.atLeast + 1) / (count * (sides - 1) + 1), 0, 1);
  let probabilities = [1];
  for (let die = 0; die < count; die++) {
    const next = new Array(probabilities.length + sides).fill(0) as number[];
    probabilities.forEach((probability, total) => { for (let face = 1; face <= sides; face++) next[total + face] += probability / sides; });
    probabilities = next;
  }
  return probabilities.reduce((sum, probability, total) => sum + (total >= check.atLeast ? probability : 0), 0);
}

function missingHealth(unit: Combatant): number {
  return unit.body ? BODY_PARTS.reduce((sum, part) => sum + (unit.body![part].lost ? 0 : Math.max(0, unit.body![part].max - unit.body![part].current)), 0)
    : Math.max(0, unit.stats.maxHp - unit.hp);
}

export interface SimulationDecision { choice: CombatChoice; score: number }

/** A small, deterministic expected-value heuristic, not a combat rollout or optimal-play oracle. */
class Evaluation {
  readonly ctx: CombatContext;
  readonly allies: Combatant[];
  readonly enemies: Combatant[];
  readonly horizon: number;
  private readonly modifiers = new Map<string, ReturnType<typeof modifiersFor>>();
  private readonly attacks = new Map<string, number>();
  private readonly incomingDamage = new Map<string, number>();
  private readonly reductions = new Map<string, number>();

  constructor(readonly state: CombatState, readonly content: GameContent, readonly actor: Combatant) {
    this.ctx = { state, content, depth: 0, eventCount: 0, emit: () => { throw new Error('Simulation decisions cannot emit combat events'); } };
    this.allies = state.units.filter(unit => alive(unit) && unit.team === actor.team);
    this.enemies = state.units.filter(unit => alive(unit) && unit.team !== actor.team);
    const partyDamage = this.allies.reduce((sum, ally) => sum + this.averageAttack(ally), 0);
    this.horizon = clamp(this.enemies.reduce((sum, enemy) => sum + enemy.hp + enemy.shield, 0) / Math.max(1, partyDamage), .5, 4);
  }

  mods(unit: Combatant) {
    if (!this.modifiers.has(unit.id)) this.modifiers.set(unit.id, modifiersFor(this.ctx, unit));
    return this.modifiers.get(unit.id)!;
  }

  reduction(unit: Combatant): number {
    // One Evaluation sees one immutable decision state; party auras cannot change between candidates.
    if (!this.reductions.has(unit.id)) this.reductions.set(unit.id, damageReductionFor(this.ctx, unit));
    return this.reductions.get(unit.id)!;
  }

  hitChance(source: Combatant, target: Combatant): number {
    return clamp((20 - Math.floor(target.stats.evasion + this.mods(target).evasionBonus - (source.stats.accuracy ?? 0) - this.mods(source).accuracyBonus)) / 20, .05, .95);
  }

  amount(action: ActionDefinition, source: Combatant, power = source.stats.power): number {
    const modifiers = this.mods(source);
    return Math.max(0, diceMean(action.dice) + (action.scaling ? Math.floor(Math.max(0, power + modifiers.powerBonus) * (action.factor ?? 1)) : 0)
      + (action.type === 'damage' ? modifiers.damageBonus : 0));
  }

  damage(action: ActionDefinition, source: Combatant, target: Combatant, periodic = false, power?: number, bonusMultiplier: 1 | 2 = 1): number {
    if (this.mods(target).invulnerable) return 0;
    const defense = this.mods(target), offense = this.mods(source);
    const armorMean = (armor: number) => { const value = Math.max(0, Math.floor(armor)); return Math.floor(value / 20) * 10.5 + (value % 20 ? (value % 20 + 1) / 2 : 0); };
    const weights = { torso: .55, head: .05, leftArm: .1, rightArm: .1, leftLeg: .1, rightLeg: .1 };
    const armor = !target.body ? armorMean(target.stats.armor + defense.armorBonus) : periodic
      ? armorMean(bodyPartArmor(definitionFor(this.ctx, target.definitionId), target.body, 'torso') + defense.armorBonus)
      : BODY_PARTS.reduce((sum, part) => sum + weights[part] * armorMean(bodyPartArmor(definitionFor(this.ctx, target.definitionId), target.body!, target.body![part].lost ? 'torso' : part) + defense.armorBonus), 0);
    const guard = periodic ? 0 : this.state.units.filter(unit => unit.team === target.team && alive(unit)).reduce((sum, unit) => sum + diceMean(this.mods(unit).partyGuardDice), 0);
    const protection = (action.bypassArmor ? 0 : armor + this.reduction(target)) + guard;
    const bonuses = periodic ? 0 : modifierSourcesFor(this.ctx, source).reduce((sum, modifiers) => sum + diceMean(modifiers.damageBonusDice), 0);
    const difficulty = source.team === 'enemies' && action.damagePerStack === undefined ? getDifficultyProfile(this.content, this.state.difficultyId).enemyDamageMultiplier : 1;
    const powerContribution = action.scaling ? Math.floor(Math.max(0, (power ?? source.stats.power) + offense.powerBonus) * (action.factor ?? 1)) : 0;
    // The two-handed strike keeps its native weapon dice and one hit/critical roll.
    // Skills and periodic actions keep their existing, unmultiplied estimate.
    const amount = bonusMultiplier === 1 ? this.amount(action, source, power) + bonuses
      : Math.max(0, diceMean(action.dice) + bonusMultiplier * (powerContribution + offense.damageBonus + bonuses));
    const raw = (action.damagePerStack ?? amount) * difficulty;
    const critical = periodic ? 0 : offense.guaranteedCrit ? 1 : clamp((21 - Math.ceil(20 - source.stats.crit - offense.critBonus + (target.stats.resilience ?? 0) + defense.resilienceBonus)) / 20, .05, 1);
    return (periodic ? 1 : this.hitChance(source, target)) * ((1 - critical) * Math.max(0, raw - protection) + critical * Math.max(0, raw * 2 - protection));
  }

  basicDamage(source: Combatant, target: Combatant): number {
    const key = `${source.id}:${target.id}`;
    if (this.attacks.has(key)) return this.attacks.get(key)!;
    const action = definitionFor(this.ctx, source.definitionId).basicAttack;
    const weapons = weaponAttacksFor(this.ctx, source);
    const value = source.body && !canBodyAct(source.body) ? 0 : weapons === undefined
      ? this.damage(action, source, target) * (action.hits ?? 1)
      : weapons.reduce((sum, attack) => sum + this.damage({ ...action, dice: attack.item.weapon!.damage }, source, target, false,
        weaponPowerFor(this.ctx, source, attack), weaponAttackBonusMultiplier(attack.item.weapon)), 0);
    this.attacks.set(key, value);
    return value;
  }

  averageAttack(source: Combatant): number {
    const enemies = this.state.units.filter(unit => alive(unit) && unit.team !== source.team);
    return enemies.length ? enemies.reduce((sum, target) => sum + this.basicDamage(source, target), 0) / enemies.length : 0;
  }

  incoming(target: Combatant): number {
    if (this.incomingDamage.has(target.id)) return this.incomingDamage.get(target.id)!;
    const opposing = this.state.units.filter(unit => alive(unit) && unit.team !== target.team);
    const friends = this.state.units.filter(unit => alive(unit) && unit.team === target.team);
    const value = opposing.reduce((sum, enemy) => {
      const taunter = forcedTauntTarget(this.ctx, enemy);
      return sum + this.basicDamage(enemy, target) * (taunter ? Number(taunter.id === target.id) : 1 / Math.max(1, friends.length));
    }, 0);
    this.incomingDamage.set(target.id, value);
    return value;
  }

  urgency(target: Combatant): number {
    const ratio = healableHealthRatio(target);
    const criticalVital = target.body && Math.min(target.body.head.current / target.body.head.max, target.body.torso.current / target.body.torso.max) < .25;
    return 1 + Math.max(0, .75 - ratio) * 2.5 + (criticalVital ? 1.25 : 0);
  }

  healingCoverage(target: Combatant): number {
    return target.statuses.reduce((sum, active) => {
      const status = this.content.statuses.find(entry => entry.id === active.id);
      const source = this.state.units.find(unit => unit.id === active.sourceId);
      if (!source || !status?.trigger) return sum;
      return sum + status.actions.filter(action => action.type === 'heal' && (!action.target || action.target === 'self'))
        .reduce((total, action) => total + this.amount(action, source), 0) * Math.min(2, active.remaining ?? 2);
    }, 0);
  }

  healValue(target: Combatant, amount: number, periodic = false): number {
    const useful = Math.min(amount, Math.max(0, missingHealth(target) - (periodic ? this.healingCoverage(target) : 0)));
    return useful * this.urgency(target) * (periodic ? .72 : 1.2) * (target.team === this.actor.team ? 1 : -1.5);
  }

  shieldValue(target: Combatant, amount: number, duration = 3): number {
    const demand = this.incoming(target) * Math.min(duration, Math.max(1, this.horizon));
    return Math.min(amount, Math.max(0, demand - target.shield)) * this.urgency(target) * .9 * (target.team === this.actor.team ? 1 : -1.5);
  }

  damageValue(target: Combatant, amount: number): number {
    if (target.team === this.actor.team) return -Math.min(amount, target.hp + target.shield) * this.urgency(target) * 1.5;
    const remaining = target.hp + target.shield;
    const kill = !target.body && amount >= remaining ? 6 + Math.min(15, this.averageAttack(target)) : 0;
    return Math.min(amount, remaining) + kill + Math.min(1, amount / Math.max(1, remaining)) * 2;
  }

  modifierValue(target: Combatant, modifiers: Modifiers): number {
    const current = this.mods(target), attack = this.averageAttack(target), incoming = this.incoming(target);
    const basic = definitionFor(this.ctx, target.definitionId).basicAttack;
    const weapons = weaponAttacksFor(this.ctx, target);
    const hits = weapons?.length ?? basic.hits ?? 1;
    const bonusApplications = weapons?.reduce((sum, attack) => sum + weaponAttackBonusMultiplier(attack.item.weapon), 0) ?? hits;
    const damaging = attack > 0;
    const offensive = damaging ? bonusApplications * ((basic.scaling ? (modifiers.powerBonus ?? 0) * (basic.factor ?? 1) : 0)
      + (modifiers.damageBonus ?? 0) + diceMean(modifiers.damageBonusDice)) * .85
      + attack * ((modifiers.accuracyBonus ?? 0) * .045 + (modifiers.critBonus ?? 0) * .04
        + (modifiers.guaranteedCrit && !current.guaranteedCrit ? .8 : 0)
        + (modifiers.repeatAttack ? checkChance(modifiers.repeatAttack) - checkChance(current.repeatAttack) : 0)) : 0;
    const opponents = this.state.units.filter(unit => alive(unit) && unit.team !== target.team);
    const friends = this.state.units.filter(unit => alive(unit) && unit.team === target.team);
    const turnsReceivingHits = opponents.length / Math.max(1, friends.length);
    let defensive = incoming * ((modifiers.evasionBonus ?? 0) * .045 + (modifiers.resilienceBonus ?? 0) * .025)
      + turnsReceivingHits * ((modifiers.armorBonus ?? 0) * .5 + (modifiers.damageReduction ?? 0));
    if (modifiers.invulnerable && !current.invulnerable) defensive += incoming;
    if (modifiers.partyGuardDice) defensive += opponents.length * (diceMean(modifiers.partyGuardDice) - diceMean(current.partyGuardDice));
    defensive += opponents.length * (modifiers.partyDamageReduction ?? 0);
    if (modifiers.vampirismDice) defensive += Math.min(missingHealth(target) + incoming, hits * (diceMean(modifiers.vampirismDice) - diceMean(current.vampirismDice))) * .7;
    if (modifiers.taunt && !current.taunt && friends.length > 1 && healableHealthRatio(target) > .35) {
      defensive += friends.filter(ally => ally.id !== target.id).reduce((sum, ally) => sum + this.incoming(ally) * Math.max(0, this.urgency(ally) - this.urgency(target) + .25), 0);
    }
    // Ratings that affect the next initiative or exploration do not buy damage this turn.
    return (offensive + clamp(defensive, -incoming * 2, incoming * 1.4 + opponents.length * 3) * this.urgency(target)) * (target.team === this.actor.team ? 1 : -1);
  }

  statusValue(target: Combatant, action: ActionDefinition, stacks = 1, depth = 0): number {
    if (!action.statusId || depth > 2) return 0;
    const definition = this.content.statuses.find(status => status.id === action.statusId);
    if (!definition) return 0;
    const existing = target.statuses.filter(status => status.id === definition.id);
    const duration = action.duration ?? definition.defaultDuration ?? 4;
    const future = Math.min(duration, Math.max(0, this.horizon - .35));
    let turns = future;
    if (definition.stacking === 'refresh') {
      const own = existing.find(status => status.sourceId === this.actor.id);
      if (own) turns = Math.max(0, future - Math.min(own.remaining ?? Infinity, future));
    }
    if (!turns) return 0;
    let value = this.modifierValue(target, definition.modifiers) * turns;
    if (definition.trigger) for (const tick of definition.actions) {
      // Status self means its bearer, even when the caster is another unit.
      if (tick.target && tick.target !== 'self') continue;
      const amount = this.amount(tick, this.actor);
      if (tick.type === 'heal') value += this.healValue(target, amount * turns, true);
      if (tick.type === 'shield') value += this.shieldValue(target, amount * turns, tick.duration ?? duration) * .7;
      if (tick.type === 'damage') {
        let ticks = turns;
        if (definition.stacking === 'decay') {
          const before = existing[0]?.stacks ?? 0;
          ticks = 0;
          for (let turn = 0; turn < Math.ceil(turns); turn++) ticks += Math.min(1, turns - turn) * (Math.max(0, before + stacks - turn) - Math.max(0, before - turn));
        }
        value += this.damageValue(target, this.damage(tick, this.actor, target, true) * ticks) * .7;
      }
      if (tick.type === 'status') value += this.statusValue(target, tick, 1, depth + 1) * .5;
    }
    return value;
  }

  targets(selector: TargetSelector, primary: TargetSelector, targetId?: string): Combatant[] {
    const candidates = eligibleTargets(this.ctx, this.actor, selector);
    if (isRandomTargetSelector(selector) || ['self', 'allAllies', 'allEnemies', 'eventTarget'].includes(selector)) return candidates;
    if (selector === primary && targetId) return candidates.filter(target => target.id === targetId);
    if (selector === 'ally' || selector === 'lowestHealthAlly') return candidates.sort((a, b) => healableHealthRatio(a) - healableHealthRatio(b) || compareIds(a.id, b.id)).slice(0, 1);
    if (selector === 'lowestHealthEnemy') return candidates.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp || compareIds(a.id, b.id)).slice(0, 1);
    const enemies = candidates.filter(target => target.team !== this.actor.team);
    return (enemies.length ? enemies : candidates).sort((a, b) => b.stats.maxHp - a.stats.maxHp || compareIds(a.id, b.id)).slice(0, 1);
  }

  score(skill: SkillDefinition | undefined, targetId?: string): number {
    const primary = skill?.target ?? 'enemy';
    const actions = skill?.actions ?? [definitionFor(this.ctx, this.actor.definitionId).basicAttack];
    const damage = new Map<string, { target: Combatant; amount: number; weight: number; repeatable: boolean }>();
    let score = 0;
    for (const action of actions) {
      const selector = action.target ?? primary;
      const candidates = this.targets(selector, primary, targetId);
      const weight = isRandomTargetSelector(selector) ? 1 / Math.max(1, candidates.length) : 1;
      for (const target of candidates) {
        if (!matchesTargetRelation(this.actor, target, action.targetRelation)) continue;
        if (action.type === 'heal') score += weight * this.healValue(target, this.amount(action, this.actor));
        if (action.type === 'shield') score += weight * this.shieldValue(target, this.amount(action, this.actor), action.duration ?? 3);
        if (action.type === 'status') score += weight * this.statusValue(target, action);
        if (action.type === 'damage') {
          const amount = skill ? this.damage(action, this.actor, target) * (action.hits ?? 1) : this.basicDamage(this.actor, target);
          const key = `${selector}:${target.id}`;
          damage.set(key, { target, amount: (damage.get(key)?.amount ?? 0) + amount, weight,
            repeatable: selector === primary && (isRandomTargetSelector(primary) || target.id === targetId) });
          if (action.onHitStatusId) {
            const status = this.content.statuses.find(entry => entry.id === action.onHitStatusId);
            const hits = action.hits ?? 1, hit = this.hitChance(this.actor, target);
            const applied = status?.stacking === 'refresh' ? 1 - (1 - hit) ** hits : hits * hit;
            const value = this.statusValue(target, { type: 'status', statusId: action.onHitStatusId, duration: action.onHitDuration ?? null }, applied);
            score += weight * value * (status?.stacking === 'decay' ? 1 : applied);
          }
        }
      }
    }
    const repeat = checkChance(this.mods(this.actor).repeatAttack);
    for (const { target, amount, weight, repeatable } of damage.values()) {
      const repeated = repeatable && amount < target.hp + target.shield ? this.basicDamage(this.actor, target) * repeat : 0;
      score += weight * this.damageValue(target, amount + repeated);
      const sustain = diceMean(this.mods(this.actor).vampirismDice);
      if (sustain && target.team !== this.actor.team) score += weight * this.healValue(this.actor, Math.min(sustain, Math.max(0, amount - target.shield))) * .6;
    }
    // Prefer retaining a cooldown when its useful outcome is indistinguishable from a basic strike.
    return score - (skill ? .15 + Math.max(0, skill.cooldown) * .025 : 0);
  }
}

/** Diagnostics for offline harnesses. Calling this repeatedly has no effect on combat or RNG. */
export function rankSimulationChoices(state: CombatState, content: GameContent): SimulationDecision[] {
  const actor = state.units.find(unit => unit.id === state.pendingActorId && alive(unit) && unit.team === 'heroes');
  if (!actor || state.status !== 'running') throw new Error('Simulation policy requires a pending hero turn');
  if (actor.body && !canBodyAct(actor.body)) return [{ choice: { type: 'flee', actorId: actor.id }, score: 0 }];
  const evaluation = new Evaluation(state, content, actor);
  const definition = definitionFor(evaluation.ctx, actor.definitionId);
  const skills = definition.skillIds.flatMap(id => content.skills.find(skill => skill.id === id) ?? [])
    .filter(skill => (actor.cooldowns[skill.id] ?? 0) <= 0 && (skill.condition !== 'hasOtherAlly' || evaluation.allies.length > 1));
  const decisions: SimulationDecision[] = [];
  for (const skill of [undefined, ...skills]) {
    const selector = skill?.target ?? 'enemy';
    const candidates = eligibleTargets(evaluation.ctx, actor, selector).sort((a, b) => compareIds(a.id, b.id));
    if (!candidates.length) continue;
    const random = isRandomTargetSelector(selector);
    const targets = random || selector === 'allAllies' ? candidates.slice(0, 1) : candidates;
    for (const target of targets) {
      const choice: CombatChoice = { type: skill ? 'skill' : 'attack', actorId: actor.id,
        ...(skill ? { skillId: skill.id } : {}), ...(!random ? { targetId: target.id } : {}) };
      decisions.push({ choice, score: evaluation.score(skill, choice.targetId) });
    }
  }
  return decisions.sort((a, b) => b.score - a.score || compareIds(a.choice.skillId ?? '', b.choice.skillId ?? '') || compareIds(a.choice.targetId ?? '', b.choice.targetId ?? ''));
}

/** Explicit offline policy only; ordinary game turns continue to require manual choices. */
export function simulationPolicy(state: CombatState, content: GameContent): CombatChoice {
  const decision = rankSimulationChoices(state, content)[0];
  if (!decision) throw new Error('Simulation policy could not find a target');
  return decision.choice;
}
