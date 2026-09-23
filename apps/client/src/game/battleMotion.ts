import type { CombatEvent, Combatant } from '@shards/shared';
import type { UnitMotion } from '../art/unitPose';

/** A lethal or damaging reaction must win over another action in the same resolved turn. */
export function battleMotion(unit: Pick<Combatant, 'id' | 'hp'>, events: readonly CombatEvent[]): UnitMotion | undefined {
  if (unit.hp <= 0) return 'death';
  if (events.some((event) => event.type === 'DAMAGE' && event.targetId === unit.id && (event.amount ?? 0) > 0)) return 'hit';
  if (events.some((event) => event.type === 'BLOCKED' && event.targetId === unit.id)) return 'block';
  if (events.some((event) => event.actorId === unit.id && event.type === 'SKILL_USED')) return 'cast';
  const attack = events.find((event) => event.actorId === unit.id && event.type === 'ATTACK_STARTED');
  if (attack) return attack.skillId === 'mage_ignite' ? 'cast' : attack.attackSlot === 'leftHand' ? 'attackLeft' : 'attack';
  return undefined;
}
