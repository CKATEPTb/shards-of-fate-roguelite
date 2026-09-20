import { BODY_PARTS, type CombatEventType, type GameContent } from '@shards/shared';
import { array, fail, finite, integer, oneOf, record, string } from './snapshot-values';

const EVENT_TYPES: readonly CombatEventType[] = ['COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'SKILL_USED', 'ATTACK_STARTED', 'DICE_ROLLED', 'HIT', 'MISS', 'CRIT', 'DAMAGE', 'HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'SHIELD_BROKEN', 'STATUS_APPLIED', 'STATUS_EXPIRED', 'ENTITY_DIED', 'TURN_ENDED', 'COMBAT_ENDED'];

export function validateEvents(value: unknown, units: string[], round: number, turn: number, content: GameContent): Record<string, unknown>[] {
  let previousTurn = 0;
  let previousRound = 0;
  return array(value, 'events').map((entry, index) => {
    const path = `events[${index}]`;
    const event = record(entry, path, ['sequence', 'turn', 'round', 'type', 'actorId', 'targetId', 'skillId', 'statusId', 'bodyPart', 'amount', 'rolls', 'sides', 'modifier', 'message']);
    if (integer(event.sequence, `${path}.sequence`, 1) !== index + 1) fail(path, 'event sequences must be contiguous');
    previousTurn = integer(event.turn, `${path}.turn`, previousTurn, turn);
    previousRound = integer(event.round, `${path}.round`, previousRound, round);
    const type = oneOf(event.type, EVENT_TYPES, `${path}.type`);
    string(event.message, `${path}.message`, 2048);
    for (const key of ['actorId', 'targetId']) if (event[key] !== undefined && !units.includes(string(event[key], `${path}.${key}`))) fail(path, `unknown ${key}`);
    if (event.skillId !== undefined && !content.skills.some(skill => skill.id === event.skillId)) fail(path, 'unknown skill');
    if (event.statusId !== undefined && !content.statuses.some(status => status.id === event.statusId)) fail(path, 'unknown status');
    if (event.bodyPart !== undefined) oneOf(event.bodyPart, BODY_PARTS, `${path}.bodyPart`);
    if (event.amount !== undefined) finite(event.amount, `${path}.amount`);
    if (event.rolls !== undefined) {
      const sides = integer(event.sides, `${path}.sides`, 4, 20);
      if (![4, 6, 8, 10, 12, 20].includes(sides)) fail(path, 'unsupported dice sides');
      const rolls = array(event.rolls, `${path}.rolls`, 1000);
      if (!rolls.length) fail(path, 'dice roll must have results');
      rolls.forEach((roll, i) => integer(roll, `${path}.rolls[${i}]`, 1, sides));
      integer(event.modifier, `${path}.modifier`, -1_000_000, 1_000_000);
    }
    if (type === 'DICE_ROLLED' && event.rolls === undefined) fail(path, 'dice event is missing results');
    return event;
  });
}
