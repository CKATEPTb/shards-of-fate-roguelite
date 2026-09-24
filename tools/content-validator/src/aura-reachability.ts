import type { ActionDefinition, GameContent, TargetSelector } from '@shards/shared';

type Relation = 'ally' | 'enemy';
export interface AuraReachabilityOptions {
  /** Actual world/starting-roster roots supplied by the expedition audit. */
  unitIds?: ReadonlySet<string>;
  /** Obtainable learned skills; native skills come from the reachable units. */
  skillIds?: ReadonlySet<string>;
}
export interface AuraApplicationRoute {
  statusId: string;
  sourceType: 'skill' | 'effect' | 'status' | 'basicAttack';
  sourceId: string;
  rootId: string;
  actionIndex: number;
  application: 'status' | 'onHit';
}
export interface AuraReachability {
  reachableStatusIds: string[];
  unreachableStatusIds: string[];
  routes: AuraApplicationRoute[];
}

const both: readonly Relation[] = ['ally', 'enemy'];
function relations(selector: TargetSelector, self: readonly Relation[], event: readonly Relation[]): readonly Relation[] {
  if (selector === 'self') return self;
  if (selector === 'eventTarget') return event;
  if (['ally', 'allAllies', 'lowestHealthAlly', 'randomAlly'].includes(selector)) return ['ally'];
  if (['enemy', 'allEnemies', 'lowestHealthEnemy', 'randomEnemy'].includes(selector)) return ['enemy'];
  return both;
}
const validDuration = (duration: number | null | undefined) => duration === null || Number.isInteger(duration) && duration! > 0;

/**
 * Structural application coverage, not a substitute for combat execution tests.
 * Rooted at owned native/equippable skills, basic attacks and owned passive effects.
 * Tracks target relations through periodic hooks and rejects impossible relation
 * filters, missing triggers, zero durations and zero-hit on-hit applications.
 */
export function traceAuraReachability(content: GameContent, options: AuraReachabilityOptions = {}): AuraReachability {
  const units = [...content.characters, ...content.enemies].filter(unit => !options.unitIds || options.unitIds.has(unit.id));
  const skillIds = new Set([...units.flatMap(unit => unit.skillIds),
    ...(options.skillIds ?? content.skills.filter(skill => skill.rarity && skill.tags.includes('LEARNABLE')).map(skill => skill.id))]);
  const effectIds = new Set(units.flatMap(unit => unit.effectIds));
  const routes: AuraApplicationRoute[] = [];
  const reached = new Set<string>();
  const queued = new Set<string>();
  const pending: Array<{ id: string; relation: Relation; rootId: string }> = [];
  const statusDefinitions = new Map(content.statuses.map(status => [status.id, status]));

  function scan(actions: readonly ActionDefinition[], target: TargetSelector,
    sourceType: AuraApplicationRoute['sourceType'], sourceId: string, rootId: string,
    self: readonly Relation[] = ['ally'], event: readonly Relation[] = []): void {
    actions.forEach((action, actionIndex) => {
      const possible = relations(action.target ?? target, self, event).filter(relation => !action.targetRelation || action.targetRelation === relation);
      if (!possible.length) return;
      const application = action.type === 'status' && validDuration(action.duration) ? 'status'
        : action.type === 'damage' && (action.hits ?? 1) > 0 && validDuration(action.onHitDuration ?? null) ? 'onHit' : undefined;
      const statusId = application === 'status' ? action.statusId : application === 'onHit' ? action.onHitStatusId : undefined;
      if (!application || !statusId || !statusDefinitions.has(statusId)) return;
      reached.add(statusId);
      routes.push({ statusId, sourceType, sourceId, rootId, actionIndex, application });
      for (const relation of possible) {
        const key = `${statusId}:${relation}`;
        if (queued.has(key)) continue;
        queued.add(key);
        pending.push({ id: statusId, relation, rootId });
      }
    });
  }

  for (const skill of content.skills) if (skillIds.has(skill.id)) scan(skill.actions, skill.target, 'skill', skill.id, skill.id);
  for (const unit of units) scan([unit.basicAttack], 'enemy', 'basicAttack', unit.id, unit.id);
  for (const effect of content.effects) {
    if (!effectIds.has(effect.id)) continue;
    // Ownership/ally conditions are satisfiable in a party. Event-target actions
    // need a target-bearing event; lifecycle events cannot supply one.
    const hasTarget = !['COMBAT_STARTED', 'COMBAT_ENDED', 'ROUND_STARTED', 'TURN_STARTED', 'TURN_ENDED', 'SKILL_USED', 'DICE_ROLLED', 'FLEE_SUCCEEDED', 'FLEE_FAILED'].includes(effect.trigger);
    const event = !hasTarget ? [] : effect.conditions.includes('targetIsOwner') || effect.conditions.includes('targetIsAlly') ? ['ally'] as const : both;
    if (!hasTarget && (effect.conditions.includes('targetIsOwner') || effect.conditions.includes('targetIsAlly'))) continue;
    scan(effect.actions, effect.target, 'effect', effect.id, effect.id, ['ally'], event);
  }
  for (let index = 0; index < pending.length; index++) {
    const next = pending[index], definition = statusDefinitions.get(next.id)!;
    if (definition.trigger !== 'TURN_STARTED' && definition.trigger !== 'TURN_ENDED') continue;
    scan(definition.actions, 'self', 'status', definition.id, next.rootId, [next.relation]);
  }
  return {
    reachableStatusIds: [...reached].sort(),
    unreachableStatusIds: content.statuses.filter(status => !reached.has(status.id)).map(status => status.id).sort(),
    routes,
  };
}
