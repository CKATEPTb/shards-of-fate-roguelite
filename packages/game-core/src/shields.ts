import type { Combatant } from '@shards/shared';
import type { CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { rollChance } from './combat-rolls';

export function addShield(ctx: CombatContext, source: Combatant, target: Combatant, amount: number, duration?: number): void {
  if (duration !== undefined && (!Number.isInteger(duration) || duration < 1)) throw new Error('Invalid shield duration');
  target.shield += amount;
  if (amount > 0 && duration !== undefined) {
    (target.shieldLayers ??= []).push({ sourceId: source.id, capacity: amount, remaining: duration, appliedTurn: ctx.state.turn });
  }
  ctx.emit({ type: 'SHIELD_CREATED', actorId: source.id, targetId: target.id, amount, message: `${target.name}: щит +${amount}${duration ? ` (${duration} хода)` : ''}` });
}

/** Spend expiring layers first; a successful source passive absorbs without spending capacity. */
export function absorbDamage(ctx: CombatContext, target: Combatant, damage: number): number {
  let pending = damage;
  for (const layer of [...(target.shieldLayers ?? [])].sort((a, b) => a.remaining - b.remaining)) {
    if (pending <= 0) break;
    const absorbed = Math.min(layer.capacity, pending);
    const source = ctx.state.units.find(unit => unit.id === layer.sourceId);
    const saved = source && source.hp > 0 && rollChance(ctx, source, modifiersFor(ctx, source).preserveShieldChance, 'сохранение щита');
    if (!saved) { layer.capacity -= absorbed; target.shield -= absorbed; }
    pending -= absorbed;
  }
  if (target.shieldLayers) {
    target.shieldLayers = target.shieldLayers.filter(layer => layer.capacity > 0);
    if (!target.shieldLayers.length) delete target.shieldLayers;
  }
  const permanent = Math.max(0, target.shield - (target.shieldLayers ?? []).reduce((sum, layer) => sum + layer.capacity, 0));
  const absorbed = Math.min(permanent, pending);
  target.shield -= absorbed;
  return damage - pending + absorbed;
}

export function expireShields(ctx: CombatContext, actor: Combatant): void {
  if (!actor.shieldLayers) return;
  const before = actor.shield;
  actor.shieldLayers = actor.shieldLayers.filter(layer => {
    if (layer.appliedTurn >= ctx.state.turn || --layer.remaining > 0) return true;
    actor.shield = Math.max(0, actor.shield - layer.capacity);
    return false;
  });
  if (!actor.shieldLayers.length) delete actor.shieldLayers;
  if (before > 0 && actor.shield === 0) ctx.emit({ type: 'SHIELD_BROKEN', actorId: actor.id, targetId: actor.id, message: `${actor.name}: время действия щита истекло` });
}
