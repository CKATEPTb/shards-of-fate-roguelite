import { canEquipInSlot, equipmentBodyPartsForSlot, isHandSlot, occupiedHandSlots,
  type EquipmentItemDefinition, type EquipmentSlot, type StarterEquipment } from '@shards/shared';

export interface EquipmentReward { id: string; itemId: string }
export interface EquipmentChoiceSelection { rewardId: string; slot: EquipmentSlot }
export interface EquipmentChoicePreview {
  equipment: StarterEquipment[];
  removed: StarterEquipment[];
  selectedRewardIds: string[];
}
export interface EquipmentChoiceConfirmation {
  equipment: StarterEquipment[];
  remainingRewards: EquipmentReward[];
  destroyed: StarterEquipment[];
}

const slots: readonly EquipmentSlot[] = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'];

function materialize(item: EquipmentItemDefinition, slot: EquipmentSlot): StarterEquipment {
  const copy = structuredClone(item);
  return { ...copy, slot, bodyParts: equipmentBodyPartsForSlot(item, slot) };
}

function validateOutfit(equipment: readonly StarterEquipment[]): void {
  const occupied = new Set<EquipmentSlot>();
  const accepted: StarterEquipment[] = [];
  for (const item of equipment) {
    if (!slots.includes(item.slot) || occupied.has(item.slot)) throw new Error(`Duplicate or unknown equipment slot: ${item.slot}`);
    if (!canEquipInSlot(accepted, item, item.slot)) throw new Error(`Incompatible equipment in ${item.slot}`);
    occupied.add(item.slot);
    accepted.push(item);
  }
}

/** A preview has no side effects: every returned item is independent of the inputs and catalogue. */
export function previewEquipmentChoice(
  equipped: readonly StarterEquipment[],
  rewards: readonly EquipmentReward[],
  selections: readonly EquipmentChoiceSelection[],
  items: Readonly<Record<string, EquipmentItemDefinition>>,
): EquipmentChoicePreview {
  validateOutfit(equipped);
  const available = new Map<string, EquipmentReward>();
  for (const reward of rewards) {
    if (!reward.id || available.has(reward.id)) throw new Error(`Duplicate or empty equipment reward ID: ${reward.id}`);
    if (!Object.hasOwn(items, reward.itemId) || !items[reward.itemId] || items[reward.itemId].id !== reward.itemId) {
      throw new Error(`Unknown equipment item: ${reward.itemId}`);
    }
    available.set(reward.id, reward);
  }

  const selectedRewardIds: string[] = [];
  const selectedIds = new Set<string>();
  const selectedSlots = new Set<EquipmentSlot>();
  const additions: StarterEquipment[] = [];
  for (const selection of selections) {
    const reward = available.get(selection.rewardId);
    if (!reward) throw new Error(`Unknown equipment reward: ${selection.rewardId}`);
    if (selectedIds.has(selection.rewardId)) throw new Error(`Equipment reward selected twice: ${selection.rewardId}`);
    if (!slots.includes(selection.slot) || selectedSlots.has(selection.slot)) throw new Error(`Duplicate or unknown selected slot: ${selection.slot}`);
    const item = items[reward.itemId];
    // Validate the entire chosen outfit before removing anything. Conflicting
    // new choices must fail, rather than silently replace another chosen reward.
    if (!canEquipInSlot(additions, item, selection.slot)) throw new Error(`Cannot equip ${item.id} in ${selection.slot}`);
    additions.push(materialize(item, selection.slot));
    selectedIds.add(selection.rewardId);
    selectedSlots.add(selection.slot);
    selectedRewardIds.push(selection.rewardId);
  }

  const selectedHands = new Set(additions.flatMap(occupiedHandSlots));
  const displaced = (item: StarterEquipment): boolean => selectedSlots.has(item.slot)
    || isHandSlot(item.slot) && occupiedHandSlots(item).some(hand => selectedHands.has(hand));
  const removed = equipped.filter(displaced);
  const equipment = [...equipped.filter(item => !displaced(item)), ...additions]
    .sort((left, right) => slots.indexOf(left.slot) - slots.indexOf(right.slot));
  validateOutfit(equipment);
  return structuredClone({ equipment, removed, selectedRewardIds });
}

/** Only chosen rewards are consumed. Replaced gear is destroyed, never returned as a reward. */
export function confirmEquipmentChoice(
  equipped: readonly StarterEquipment[],
  rewards: readonly EquipmentReward[],
  selections: readonly EquipmentChoiceSelection[],
  items: Readonly<Record<string, EquipmentItemDefinition>>,
): EquipmentChoiceConfirmation {
  const preview = previewEquipmentChoice(equipped, rewards, selections, items);
  const consumed = new Set(preview.selectedRewardIds);
  return { equipment: preview.equipment,
    remainingRewards: structuredClone(rewards.filter(reward => !consumed.has(reward.id))),
    destroyed: preview.removed };
}
