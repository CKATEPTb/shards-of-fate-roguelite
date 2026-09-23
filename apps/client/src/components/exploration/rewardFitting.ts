import { EQUIPMENT_ITEMS } from '@shards/game-data';
import { canEquipInSlot, occupiedHandSlots,
  type AdventureReward, type EquipmentItemDefinition, type EquipmentSlot, type HeroProgress } from '@shards/shared';

export type RewardDraft = {
  equipment: { rewardId: string; slot: EquipmentSlot }[];
  skills: { rewardId: string; slot: 0 | 1 }[];
};
export type RewardTarget = EquipmentSlot | 'skill0' | 'skill1';

/** Treat this value as an initial state; every operation returns its own arrays and entries. */
export const EMPTY_REWARD_DRAFT: RewardDraft = { equipment: [], skills: [] };

const isSkillTarget = (target: RewardTarget): target is 'skill0' | 'skill1' => target === 'skill0' || target === 'skill1';

function equipmentFor(reward: AdventureReward | undefined): EquipmentItemDefinition | undefined {
  return reward?.kind === 'equipment' && Object.hasOwn(EQUIPMENT_ITEMS, reward.definitionId)
    ? EQUIPMENT_ITEMS[reward.definitionId] : undefined;
}

export function canFitReward(reward: AdventureReward, target: RewardTarget): boolean {
  if (isSkillTarget(target)) return reward.kind === 'skill';
  const item = equipmentFor(reward);
  return !!item && canEquipInSlot([], item, target);
}

export function removeFittedReward(draft: RewardDraft, rewardId: string): RewardDraft {
  return {
    equipment: draft.equipment.filter(entry => entry.rewardId !== rewardId).map(entry => ({ ...entry })),
    skills: draft.skills.filter(entry => entry.rewardId !== rewardId).map(entry => ({ ...entry })),
  };
}

/** Replaced preview entries remain in the external reward pool; nothing is consumed here. */
function placeReward(draft: RewardDraft, rewards: ReadonlyMap<string, AdventureReward>, reward: AdventureReward, target: RewardTarget): RewardDraft {
  const next = removeFittedReward(draft, reward.id);
  if (isSkillTarget(target)) {
    const slot = target === 'skill0' ? 0 : 1;
    next.skills = next.skills.filter(entry => entry.slot !== slot
      && rewards.get(entry.rewardId)?.definitionId !== reward.definitionId);
    next.skills.push({ rewardId: reward.id, slot });
    return next;
  }
  const item = equipmentFor(reward)!;
  const wantedHands = occupiedHandSlots({ slot: target, weapon: item.weapon });
  next.equipment = next.equipment.filter(entry => {
    if (entry.slot === target) return false;
    const existing = equipmentFor(rewards.get(entry.rewardId));
    return !occupiedHandSlots({ slot: entry.slot, weapon: existing?.weapon }).some(hand => wantedHands.includes(hand));
  });
  next.equipment.push({ rewardId: reward.id, slot: target });
  return next;
}

/** Drop vanished/invalid rewards and resolve stale slot conflicts with the latest choice winning. */
export function sanitizeRewardDraft(draft: RewardDraft, rewards: AdventureReward[]): RewardDraft {
  const available = new Map(rewards.map(reward => [reward.id, reward]));
  let result: RewardDraft = { equipment: [], skills: [] };
  for (const entry of draft.equipment) {
    const reward = available.get(entry.rewardId);
    if (reward?.kind === 'equipment' && canFitReward(reward, entry.slot)) result = placeReward(result, available, reward, entry.slot);
  }
  for (const entry of draft.skills) {
    if (entry.slot !== 0 && entry.slot !== 1) continue;
    const reward = available.get(entry.rewardId);
    const target = entry.slot === 0 ? 'skill0' : 'skill1';
    if (reward?.kind === 'skill' && canFitReward(reward, target)) result = placeReward(result, available, reward, target);
  }
  return result;
}

/** Fitting is reversible; only the eventual core confirmation destroys replaced equipment. */
export function fitReward(draft: RewardDraft, rewards: AdventureReward[], rewardId: string, target: RewardTarget): RewardDraft {
  const next = sanitizeRewardDraft(draft, rewards);
  const available = new Map(rewards.map(reward => [reward.id, reward]));
  const reward = available.get(rewardId);
  return reward && canFitReward(reward, target) ? placeReward(next, available, reward, target) : next;
}

/** The caller checks duplicate final skills; preview never silently unequips an existing skill. */
export function previewRewardSkills(progress: HeroProgress, draft: RewardDraft): [string | null, string | null] {
  const skills: [string | null, string | null] = [...progress.skills];
  const available = new Map(progress.rewards.map(reward => [reward.id, reward]));
  for (const entry of sanitizeRewardDraft(draft, progress.rewards).skills) {
    const reward = available.get(entry.rewardId);
    if (reward?.kind === 'skill') skills[entry.slot] = reward.definitionId;
  }
  return skills;
}
