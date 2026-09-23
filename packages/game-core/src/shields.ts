import type { Combatant } from '@shards/shared';
import type { CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { rollCheck } from './combat-rolls';

export function addShield(ctx: CombatContext, source: Combatant, target: Combatant, amount: number, duration?: number | null): void {
  if (duration != null && (!Number.isInteger(duration) || duration < 1)) throw new Error('Invalid shield duration');
  target.shield += amount;
  if (amount > 0 && duration != null) {
    (target.shieldLayers ??= []).push({ sourceId: source.id, capacity: amount, remaining: duration, appliedTurn: ctx.state.turn });
  }
  ctx.emit({ type: 'SHIELD_CREATED', actorId: source.id, targetId: target.id, amount, statusRemaining: duration ?? null,
    shieldAfter: target.shield, shieldLayersAfter: structuredClone(target.shieldLayers ?? []),
    message: `${target.name}: щит +${amount}${duration ? ` (${duration} хода)` : ''}` });
}

/** Spend expiring layers first; a successful source passive absorbs without spending capacity. */
export function absorbDamage(ctx: CombatContext, target: Combatant, damage: number): number {
  let pending = damage;
  for (const layer of [...(target.shieldLayers ?? [])].sort((a, b) => a.remaining - b.remaining)) {
    if (pending <= 0) break;
    if (layer.capacity <= 0) continue;
    const absorbed = Math.min(layer.capacity, pending);
    const source = ctx.state.units.find(unit => unit.id === layer.sourceId);
    const saved = source && source.hp > 0 && !source.escaped && rollCheck(ctx, source, modifiersFor(ctx, source).preserveShield, 'сохранение щита');
    if (saved) pending = 0;
    else {
      layer.capacity -= absorbed;
      target.shield -= absorbed;
      pending -= absorbed;
    }
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
  let changed = false;
  actor.shieldLayers = actor.shieldLayers.filter(layer => {
    if (layer.appliedTurn >= ctx.state.turn) return true;
    changed = true;
    if (--layer.remaining > 0) return true;
    actor.shield = Math.max(0, actor.shield - layer.capacity);
    return false;
  });
  if (!actor.shieldLayers.length) delete actor.shieldLayers;
  if (!changed) return;
  const broken = before > 0 && actor.shield === 0;
  ctx.emit({ type: broken ? 'SHIELD_BROKEN' : 'SHIELD_UPDATED', actorId: actor.id, targetId: actor.id,
    shieldAfter: actor.shield, shieldLayersAfter: structuredClone(actor.shieldLayers ?? []),
    message: broken ? `${actor.name}: время действия щита истекло`
      : `${actor.name}: щит ${actor.shield}, оставшиеся ходы слоёв: ${(actor.shieldLayers ?? []).map(layer => layer.remaining).join(', ') || 'бессрочно'}` });
}
