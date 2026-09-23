import type { MovementState, Terrain, WorldActor } from '@shards/shared';
import { bodyMovementMultiplier, isBodyPartFunctional } from '../anatomy';

/** Enemy definitions identify roaming mobs; heroes keep ordinary terrain penalties. */
export type MovementActor = Pick<WorldActor, 'movement' | 'body'> & { definitionId?: string };

/** At 100%, actors cover one tile in 280 ms, half the original exploration pace. */
export const BASE_MOVEMENT_STEP_MS = 280;
export const MOVEMENT_TICK_MS = 40;

export function createMovementState(baseSpeed = 100): MovementState {
  if (!Number.isFinite(baseSpeed) || baseSpeed < 10 || baseSpeed > 300) throw new Error('Invalid base movement speed');
  return { baseSpeed, bonusPercent: 0, elapsedMs: 0 };
}

/** Equipment and temporary bonuses affect exploration without changing initiative. */
export function effectiveMovementSpeed(actor: Pick<WorldActor, 'movement' | 'body'>): number {
  const baseSpeed = actor.movement?.baseSpeed ?? 100;
  const feet = actor.body ? (Number(isBodyPartFunctional(actor.body, 'leftLeg')) + Number(isBodyPartFunctional(actor.body, 'rightLeg'))) / 2 : 1;
  const bonusPercent = (actor.movement?.bonusPercent ?? 0) - (actor.movement?.bootsBonusPercent ?? 0) * (1 - feet);
  const healthySpeed = Math.max(10, Math.min(300, baseSpeed * (1 + bonusPercent / 100)));
  return healthySpeed * (actor.body ? bodyMovementMultiplier(actor.body) : 1);
}

/** The destination terrain determines the cost of entering the next tile. */
export function terrainMovementCost(terrain?: Terrain, actor?: MovementActor): number {
  return terrain === 'bush' && actor?.definitionId === undefined ? 2 : 1;
}

export function movementStepMs(actor: MovementActor, terrain?: Terrain): number {
  return BASE_MOVEMENT_STEP_MS * 100 / effectiveMovementSpeed(actor) * terrainMovementCost(terrain, actor);
}

export function validateMovementBonus(bonusPercent: number): void {
  if (!Number.isFinite(bonusPercent) || bonusPercent < -100 || bonusPercent > 1000) throw new Error('Invalid movement bonus');
}

/** Change equipment bonuses without losing progress or completing a tile early. */
export function withMovementBonus(actor: WorldActor, bonusPercent: number, terrain?: Terrain, bootsBonusPercent = actor.movement?.bootsBonusPercent ?? 0): WorldActor {
  validateMovementBonus(bonusPercent);
  validateMovementBonus(bootsBonusPercent);
  if (actor.movement?.bonusPercent === bonusPercent && (actor.movement.bootsBonusPercent ?? 0) === bootsBonusPercent) return actor;
  const previous = actor.movement ?? createMovementState();
  const duration = movementStepMs(actor, terrain);
  const progress = Number.isFinite(duration) ? Math.max(0, Math.min(1 - Number.EPSILON, previous.elapsedMs / duration)) : 0;
  const movement = { ...previous, bonusPercent, ...(bootsBonusPercent || previous.bootsBonusPercent !== undefined ? { bootsBonusPercent } : {}) };
  const nextDuration = movementStepMs({ ...actor, movement }, terrain);
  return { ...actor, movement: { ...movement, elapsedMs: Number.isFinite(nextDuration) ? progress * nextDuration : 0 } };
}
