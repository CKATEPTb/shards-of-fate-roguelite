import type { CombatEvent, Combatant } from '@shards/shared';
import { combatPresentationBeats, type CombatPresentationBeat } from '@shards/shared';
import { bodyCombatHealth, damageBody, healBody } from '@shards/game-core';

export type BattleBeat = CombatPresentationBeat;

export const battleBeats = combatPresentationBeats;

export function battlePlaybackDuration(events: readonly CombatEvent[], speed = 1): number {
  return battleBeats(events).reduce((sum, beat) => sum + beat.duration, 0) / Math.max(0.1, speed);
}

/** Mutates a private visual copy, never combat state and never the dice stream. */
export function applyPresentedEvent(units: Map<string, Combatant>, event: CombatEvent): void {
  const unit = units.get(event.targetId ?? event.actorId ?? '');
  if (!unit) return;
  const amount = Math.max(0, event.amount ?? 0);
  if (event.type === 'DAMAGE') {
    if (unit.body && event.bodyPart) {
      unit.body = damageBody(unit.body, event.bodyPart, amount).body;
      unit.hp = bodyCombatHealth(unit.body);
    } else unit.hp = Math.max(0, unit.hp - amount);
    if (event.shieldAfter !== undefined) unit.shield = event.shieldAfter;
  } else if (event.type === 'HEALED') {
    if (unit.body) {
      unit.body = healBody(unit.body, amount).body;
      unit.hp = bodyCombatHealth(unit.body);
    } else unit.hp = Math.min(unit.stats.maxHp, unit.hp + amount);
  } else if (event.type === 'SHIELD_CREATED') {
    unit.shield += amount;
    if (event.shieldLayersAfter === undefined && event.statusRemaining != null && amount > 0) (unit.shieldLayers ??= []).push({ sourceId: event.actorId ?? '', capacity: amount, remaining: event.statusRemaining, appliedTurn: event.turn });
  } else if (event.type === 'SHIELD_BROKEN') { unit.shield = 0; unit.shieldLayers = []; }
  else if (event.type === 'ENTITY_DIED') unit.hp = 0;
  else if (event.type === 'FLEE_SUCCEEDED') unit.escaped = true;
  else if (event.type === 'STATUS_EXPIRED') {
    unit.statuses = unit.statuses.filter(status => event.statusInstanceId
      ? status.instanceId !== event.statusInstanceId : status.id !== event.statusId);
  } else if ((event.type === 'STATUS_APPLIED' || event.type === 'STATUS_UPDATED') && event.statusId) {
    const index = unit.statuses.findIndex(status => event.statusInstanceId
      ? status.instanceId === event.statusInstanceId : event.type === 'STATUS_UPDATED' && status.id === event.statusId);
    const existing = index < 0 ? undefined : unit.statuses[index];
    const status = { id: event.statusId, instanceId: event.statusInstanceId ?? existing?.instanceId,
      sourceId: event.type === 'STATUS_APPLIED' ? event.actorId ?? existing?.sourceId ?? '' : existing?.sourceId ?? event.actorId ?? '',
      remaining: event.statusRemaining !== undefined ? event.statusRemaining : existing ? existing.remaining : amount,
      appliedTurn: event.type === 'STATUS_APPLIED' ? event.turn : existing?.appliedTurn ?? event.turn,
      stacks: event.statusStacks ?? existing?.stacks };
    if (index < 0) unit.statuses.push(status);
    else unit.statuses[index] = status;
  }
  if (event.shieldLayersAfter !== undefined) unit.shieldLayers = event.shieldLayersAfter.map(layer => ({ ...layer }));
  if (event.shieldAfter !== undefined) unit.shield = event.shieldAfter;
}
