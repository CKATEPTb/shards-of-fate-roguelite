import { occupiedHandSlots, type AdventureReward, type GameContent, type HeroBody, type HeroProgress, type InventoryTarget } from '@shards/shared';
import { equipmentFromLoadout, previewInventoryEquip } from '@shards/game-core';
import { canFitReward } from './rewardFitting';
import type { LoadoutSlot } from './loadoutModel';

const TARGETS: InventoryTarget[] = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand', 'skill0', 'skill1'];
export const inventoryTargetForSlot = (id: LoadoutSlot['id']): InventoryTarget | null => id === 'helmet' ? 'head'
  : id === 'extra1' ? 'skill0' : id === 'extra2' ? 'skill1'
    : id === 'class' || id === 'characterActive' || id === 'passive' ? null : id;

/** The bag never hides an item because a limb is missing; show the core refusal instead. */
export function inventoryTargetChoices(reward: AdventureReward, progress: HeroProgress, content: GameContent, body?: HeroBody) {
  return TARGETS.filter(target => canFitReward(reward, target)).map(target => {
    let reason = '';
    try { previewInventoryEquip(progress, reward.id, target, content, body); }
    catch (error) { reason = error instanceof Error ? error.message : 'Предмет пока нельзя надеть.'; }
    return { target, reason };
  });
}

export function defaultInventoryTarget(choices: ReturnType<typeof inventoryTargetChoices>, progress: HeroProgress, content: GameContent, preferred?: InventoryTarget | null) {
  if (preferred && choices.some(choice => choice.target === preferred)) return preferred;
  const occupied = new Set<InventoryTarget>(progress.equipment.map(entry => entry.slot));
  for (const item of equipmentFromLoadout(progress, content)) for (const slot of occupiedHandSlots(item)) occupied.add(slot);
  if (progress.skills[0]) occupied.add('skill0');
  if (progress.skills[1]) occupied.add('skill1');
  return choices.find(choice => !choice.reason && !occupied.has(choice.target))?.target
    ?? choices.find(choice => !choice.reason)?.target ?? choices[0]?.target ?? null;
}
