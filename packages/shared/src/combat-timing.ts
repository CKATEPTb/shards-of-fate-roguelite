import type { CombatEvent, CombatState } from './model';

export const COMBAT_TURN_MS = 1150;
export const COMBAT_STRIKE_MS = 640;
export const COMBAT_DEATH_TAIL_MS = 200;
export const COMBAT_DIE_MS = 720;
export const COMBAT_DICE_TOTAL_MS = 240;
export const COMBAT_DICE_BONUS_MS = 420;

/** All dice in a roll tumble together, then show their sum and attribute bonus. */
export function combatDiceDuration(event: Pick<CombatEvent, 'rolls' | 'modifier'>): number {
  const count = event.rolls?.length ?? 0;
  if (!count) return 0;
  return COMBAT_DIE_MS + (count > 1 ? COMBAT_DICE_TOTAL_MS : 0)
    + (event.modifier ? COMBAT_DICE_BONUS_MS : 0);
}

export interface CombatPresentationBeat {
  action?: CombatEvent;
  /** Every real roll required by this strike, including reactions from other actors. */
  dice?: CombatEvent[];
  events: CombatEvent[];
  actionDelay: number;
  impact: number;
  duration: number;
}

const VISIBLE_EVENTS = new Set<CombatEvent['type']>([
  'DAMAGE', 'HEALED', 'MISS', 'BLOCKED', 'SHIELD_CREATED', 'SHIELD_UPDATED', 'SHIELD_BROKEN',
  'ENTITY_DIED', 'STATUS_APPLIED', 'STATUS_UPDATED', 'STATUS_EXPIRED', 'FLEE_SUCCEEDED', 'FLEE_FAILED',
]);
const TURN_BOUNDARIES = new Set<CombatEvent['type']>([
  'COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'TURN_ENDED', 'COMBAT_ENDED',
]);
const isInitiative = (event: CombatEvent): boolean => event.type === 'DICE_ROLLED'
  && (event.rollReason === 'initiative' || event.rollReason === 'initiativeTie');

/**
 * Roll all dice belonging to one strike together, then play its result. Events
 * remain contiguous and in their original order: presenting them never draws
 * dice, changes the simulation, or advances a client's log past an unseen hit.
 * Repeated attacks and successive tie-break rounds retain separate beats.
 */
export function combatPresentationBeats(events: readonly CombatEvent[]): CombatPresentationBeat[] {
  const beats: CombatPresentationBeat[] = [];
  let pending: CombatEvent[] = [];
  let action: CombatEvent | undefined;
  let tickingStatus: string | undefined;
  const flush = () => {
    if (!pending.length) return;
    const dice = pending.filter(event => event.type === 'DICE_ROLLED');
    const diceDuration = dice.reduce((longest, event) => Math.max(longest, combatDiceDuration(event)), 0);
    const visible = pending.some(event => VISIBLE_EVENTS.has(event.type));
    const windup = action ? action.type === 'SKILL_USED' ? 400 : 330 : 0;
    const actionDuration = action ? action.type === 'SKILL_USED' ? 790 : COMBAT_STRIKE_MS : visible ? 240 : dice.length ? 40 : 0;
    const impact = diceDuration + windup;
    let duration = diceDuration + actionDuration;
    if (pending.some(event => event.type === 'ENTITY_DIED')) duration = Math.max(duration, impact + 510);
    beats.push({ action, dice: dice.length ? dice : undefined, events: pending,
      actionDelay: action ? diceDuration : 0, impact, duration });
    pending = [];
    action = undefined;
    tickingStatus = undefined;
  };
  for (const event of events) {
    if (isInitiative(event)) {
      if (pending.some(previous => !isInitiative(previous) || previous.rollReason !== event.rollReason
        || previous.actorId === event.actorId)) flush();
    } else {
      if (pending.some(isInitiative)) flush();
      // End-of-turn auras are resolved before TURN_ENDED is emitted. Their
      // first roll (or fixed burn damage) must not become part of the last hit.
      if (event.statusId && ['DICE_ROLLED', 'DAMAGE', 'BLOCKED', 'HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'SHIELD_UPDATED', 'SHIELD_BROKEN'].includes(event.type)) {
        if (tickingStatus !== event.statusId) flush();
        tickingStatus = event.statusId;
      }
      if (event.type === 'ATTACK_STARTED' || event.type === 'SKILL_USED') {
        const firstSkillStrike = event.type === 'ATTACK_STARTED' && action?.type === 'SKILL_USED'
          && action.actorId === event.actorId && action.skillId === event.skillId
          && !pending.some(previous => previous.type === 'ATTACK_STARTED');
        if (!firstSkillStrike) { flush(); action = event; }
      } else if (TURN_BOUNDARIES.has(event.type)) flush();
    }
    pending.push(event);
  }
  flush();
  return beats;
}

/** The server and the client use the same presentation plan for turn pacing. */
export function combatEventsDuration(events: readonly CombatEvent[]): number {
  return Math.max(40, combatPresentationBeats(events).reduce((sum, beat) => sum + beat.duration, 0));
}

/** Presentation budget before the next enemy turn can be resolved. */
export function combatTurnDuration(state: Pick<CombatState, 'events' | 'turn'>): number {
  return Math.max(COMBAT_TURN_MS, combatEventsDuration(state.events.filter(event => event.turn === state.turn)));
}
