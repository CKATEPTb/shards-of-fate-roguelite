import type { AttackSlot, BodyResources, HeroAnatomy } from '@shards/shared';
import { EQUIPMENT_ITEMS, EQUIPMENT_SETS, equipItem } from './equipment';

function starterAnatomy(max: [number, number, number, number], setId: string, handItems: Partial<Record<AttackSlot, string>>): HeroAnatomy {
  const [head, torso, arm, leg] = max;
  const base: BodyResources = { head: head / 4, torso: torso / 4, leftArm: arm / 4, rightArm: arm / 4, leftLeg: leg / 4, rightLeg: leg / 4 };
  const equipment = EQUIPMENT_SETS[setId].itemIds.map(id => {
    const item = EQUIPMENT_ITEMS[id];
    if (item.slot === 'hand') throw new Error('Armor sets cannot contain hand items');
    return equipItem(id, item.slot);
  });
  for (const slot of ['rightHand', 'leftHand'] as const) {
    const itemId = handItems[slot];
    if (itemId) equipment.push(equipItem(itemId, slot));
  }
  return { base, equipment };
}

/** Starting heroes choose ordinary catalogue items; they do not own item types. */
export const STARTER_ANATOMY: Record<string, HeroAnatomy> = {
  guardian: starterAnatomy([28, 64, 40, 44], 'iron-vanguard', { rightHand: 'steel-sword', leftHand: 'riveted-shield' }),
  priest: starterAnatomy([28, 52, 32, 36], 'ivory-pilgrim', { rightHand: 'pilgrim-staff' }),
  mage: starterAnatomy([28, 44, 32, 32], 'ash-weaver', { rightHand: 'ember-wand' }),
  vampire: starterAnatomy([28, 60, 40, 44], 'crimson-oath', { rightHand: 'bloodletting-sickle' }),
  paladin: starterAnatomy([32, 64, 40, 40], 'dawn-forged', { rightHand: 'oath-hammer', leftHand: 'sunward-shield' }),
  druid: starterAnatomy([28, 48, 36, 36], 'wildwood', { rightHand: 'elderbranch-staff' }),
  necromancer: starterAnatomy([28, 48, 32, 36], 'grave-keeper', { rightHand: 'bonewood-staff' }),
  rogue: starterAnatomy([28, 48, 32, 36], 'night-stalker', { rightHand: 'forged-steel-dagger', leftHand: 'worn-steel-dagger' }),
  ranger: starterAnatomy([28, 52, 36, 40], 'greenwood', { leftHand: 'hunting-bow' }),
};
