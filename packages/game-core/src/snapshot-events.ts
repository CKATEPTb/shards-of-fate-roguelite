import { BODY_PARTS, type CombatEventType, type GameContent } from '@shards/shared';
import { array, fail, finite, integer, oneOf, record, string } from './snapshot-values';
import { MAX_DICE_SIDES, MIN_DICE_SIDES } from './dice';

const EVENT_TYPES: readonly CombatEventType[] = ['COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'SKILL_USED', 'ATTACK_STARTED', 'DICE_ROLLED', 'HIT', 'MISS', 'CRIT', 'BLOCKED', 'DAMAGE', 'HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'SHIELD_UPDATED', 'SHIELD_BROKEN', 'STATUS_APPLIED', 'STATUS_UPDATED', 'STATUS_EXPIRED', 'FLEE_SUCCEEDED', 'FLEE_FAILED', 'ENTITY_DIED', 'TURN_ENDED', 'COMBAT_ENDED'];

export function validateEvents(value: unknown, units: string[], round: number, turn: number, content: GameContent, firstSequence = 1): Record<string, unknown>[] {
  let previousTurn = 0;
  let previousRound = 0;
  return array(value, 'events').map((entry, index) => {
    const path = `events[${index}]`;
    const event = record(entry, path, ['sequence', 'turn', 'round', 'type', 'actorId', 'targetId', 'skillId', 'statusId', 'statusInstanceId', 'statusRemaining', 'statusStacks', 'bodyPart', 'attackHand', 'attackSlot', 'amount', 'shieldAfter', 'shieldLayersAfter', 'rolls', 'sides', 'modifier', 'rollReason', 'message']);
    if (integer(event.sequence, `${path}.sequence`, 1) !== firstSequence + index) fail(path, 'event sequences must be contiguous');
    previousTurn = integer(event.turn, `${path}.turn`, previousTurn, turn);
    previousRound = integer(event.round, `${path}.round`, previousRound, round);
    const type = oneOf(event.type, EVENT_TYPES, `${path}.type`);
    string(event.message, `${path}.message`, 2048);
    for (const key of ['actorId', 'targetId']) if (event[key] !== undefined && !units.includes(string(event[key], `${path}.${key}`))) fail(path, `unknown ${key}`);
    if (event.skillId !== undefined && !content.skills.some(skill => skill.id === event.skillId)) fail(path, 'unknown skill');
    if (event.statusId !== undefined && !content.statuses.some(status => status.id === event.statusId)) fail(path, 'unknown status');
    if (event.statusInstanceId !== undefined) string(event.statusInstanceId, `${path}.statusInstanceId`);
    if (event.statusRemaining !== undefined && event.statusRemaining !== null) integer(event.statusRemaining, `${path}.statusRemaining`, 0, 1_000_000);
    if (event.statusStacks !== undefined) integer(event.statusStacks, `${path}.statusStacks`, 0, 1_000_000);
    if (event.rollReason !== undefined) string(event.rollReason, `${path}.rollReason`);
    if (event.bodyPart !== undefined) oneOf(event.bodyPart, BODY_PARTS, `${path}.bodyPart`);
    if (event.attackHand !== undefined) oneOf(event.attackHand, ['right', 'left'], `${path}.attackHand`);
    // Older events recorded a loadout position; the animation hand is anatomical.
    if (event.attackSlot === 'mainHand' || event.attackSlot === 'offHand') {
      event.attackSlot = event.attackHand === 'left' || event.attackHand === undefined && event.attackSlot === 'offHand' ? 'leftHand' : 'rightHand';
    }
    if (event.attackSlot !== undefined) oneOf(event.attackSlot, ['rightHand', 'leftHand'], `${path}.attackSlot`);
    if (event.amount !== undefined) finite(event.amount, `${path}.amount`);
    if (event.shieldAfter !== undefined) integer(event.shieldAfter, `${path}.shieldAfter`);
    if (event.shieldLayersAfter !== undefined) {
      let capacity = 0;
      array(event.shieldLayersAfter, `${path}.shieldLayersAfter`, 1024).forEach((entry, i) => {
        const layerPath = `${path}.shieldLayersAfter[${i}]`;
        const layer = record(entry, layerPath, ['sourceId', 'capacity', 'remaining', 'appliedTurn']);
        if (!units.includes(string(layer.sourceId, `${layerPath}.sourceId`))) fail(layerPath, 'unknown shield source');
        capacity += finite(layer.capacity, `${layerPath}.capacity`, Number.MIN_VALUE);
        integer(layer.remaining, `${layerPath}.remaining`, 1, 1_000_000);
        integer(layer.appliedTurn, `${layerPath}.appliedTurn`, 0, previousTurn);
      });
      if (capacity > integer(event.shieldAfter, `${path}.shieldAfter`)) fail(path, 'timed capacity exceeds shield');
    }
    if (event.rolls !== undefined) {
      const sides = integer(event.sides, `${path}.sides`, MIN_DICE_SIDES, MAX_DICE_SIDES);
      const rolls = array(event.rolls, `${path}.rolls`, 1000);
      if (!rolls.length) fail(path, 'dice roll must have results');
      rolls.forEach((roll, i) => integer(roll, `${path}.rolls[${i}]`, 1, sides));
      integer(event.modifier, `${path}.modifier`, -1_000_000, 1_000_000);
    }
    if (type === 'DICE_ROLLED' && event.rolls === undefined) fail(path, 'dice event is missing results');
    return event;
  });
}
