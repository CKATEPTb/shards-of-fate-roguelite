import { attackHandForSlot, type AttackHand, type AttackSlot, type Combatant, type StarterEquipment } from '@shards/shared';
import { equipmentCondition, isBodyPartFunctional } from './anatomy';
import { definitionFor, type CombatContext } from './context';

export interface WeaponAttack { item: StarterEquipment; attackHand: AttackHand; attackSlot: AttackSlot }

/** Undefined preserves authored attacks for enemies and content without weapon metadata. */
export function weaponAttacksFor(ctx: CombatContext, actor: Combatant): WeaponAttack[] | undefined {
  const items = definitionFor(ctx, actor.definitionId).anatomy?.equipment ?? [];
  if (!items.some(item => item.weapon)) return undefined;
  const present = (hand: AttackHand) => !actor.body || isBodyPartFunctional(actor.body, `${hand}Arm`);
  const attacks: WeaponAttack[] = [];
  for (const slot of ['rightHand', 'leftHand'] as const) {
    const item = items.find(candidate => candidate.slot === slot);
    if (!item?.weapon?.damage || item.weapon.kind === 'shield') continue;
    const hand = attackHandForSlot(slot);
    // A shared grip needs both arms; a one-handed item remains in its equipped hand.
    if (!present(hand) || item.weapon.hands === 2 && (!present('right') || !present('left'))) continue;
    attacks.push({ item, attackHand: hand, attackSlot: slot });
  }
  return attacks;
}

/** Keep innate/current power, adding only this weapon's contribution to each hit. */
export function weaponPowerFor(ctx: CombatContext, actor: Combatant, attack: WeaponAttack): number {
  const equipment = definitionFor(ctx, actor.definitionId).anatomy?.equipment ?? [];
  const otherPower = equipment.reduce((sum, item) => {
    if (item === attack.item || !item.weapon?.damage || item.weapon.kind === 'shield') return sum;
    const fraction = actor.body ? equipmentCondition(item, actor.body).bonusFraction : 1;
    return sum + (item.bonuses?.power ?? 0) * fraction;
  }, 0);
  return Math.max(0, actor.stats.power - otherPower);
}
