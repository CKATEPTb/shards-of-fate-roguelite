import { BODY_PARTS, occupiedHandSlots, type AdventureReward, type HeroBody, type HeroProgress, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { bodyPartArmor, bodyPartLossThreshold, previewEquipmentChoice, startHeroBody } from '@shards/game-core';
import { applyEquipmentToHero, equipItem, EQUIPMENT_ITEMS, EQUIPMENT_SETS } from '@shards/game-data';
import { canFitReward, fitReward, type RewardDraft, type RewardTarget } from './rewardFitting';
import { equipmentStats } from './rewardPresentation';

/** The same health conversion used on confirmation, including disabled and lost limbs. */
export function replacementBody(definition: UnitDefinition, current?: HeroBody): HeroBody {
  const fresh = startHeroBody(definition);
  if (!current) return fresh;
  for (const part of BODY_PARTS) {
    const resource = current[part], max = fresh[part].max;
    fresh[part] = { max, lost: resource.lost ?? false, current: resource.lost ? bodyPartLossThreshold(max)
      : Math.max(bodyPartLossThreshold(max) + 1, Math.min(max, Math.floor(resource.current / resource.max * max))) };
  }
  return fresh;
}

/** One read-only selection model drives both the visible hero attributes and item details. */
export function compareRewardEquipment(hero: UnitDefinition, progress: HeroProgress, reward: AdventureReward, target: RewardTarget, body?: HeroBody,
  fitting?: { equipment: StarterEquipment[]; draft: RewardDraft }) {
  if (reward.kind !== 'equipment' || target === 'skill0' || target === 'skill1' || !canFitReward(reward, target)) return null;
  const saved = progress.equipment.map(entry => equipItem(entry.itemId, entry.slot));
  const equipped = fitting?.equipment ?? saved;
  // Replay the candidate draft from the saved outfit, just like a real drop.
  // Moving a fitted ring/weapon must restore its old slot instead of duplicating it.
  const candidate = fitting ? previewEquipmentChoice(saved,
    progress.rewards.filter(entry => entry.kind === 'equipment').map(entry => ({ id: entry.id, itemId: entry.definitionId })),
    fitReward(fitting.draft, progress.rewards, reward.id, target).equipment, EQUIPMENT_ITEMS)
    : previewEquipmentChoice(saved, [{ id: reward.id, itemId: reward.definitionId }], [{ rewardId: reward.id, slot: target }], EQUIPMENT_ITEMS);
  const wantedHands = occupiedHandSlots({ slot: target, weapon: EQUIPMENT_ITEMS[reward.definitionId].weapon });
  const sameItem = (first: StarterEquipment, second: StarterEquipment) => first.slot === second.slot && first.id === second.id;
  const preview = { ...candidate, removed: equipped.filter(item => item.slot === target
    || occupiedHandSlots(item).some(hand => wantedHands.includes(hand)) || !candidate.equipment.some(next => sameItem(item, next))) };
  const beforeDefinition = applyEquipmentToHero(hero, equipped), afterDefinition = applyEquipmentToHero(hero, preview.equipment);
  const beforeBody = fitting ? replacementBody(beforeDefinition, body) : body ?? startHeroBody(beforeDefinition), afterBody = replacementBody(afterDefinition, body);
  const before = equipmentStats(hero, equipped, beforeBody), after = equipmentStats(hero, preview.equipment, afterBody);
  const armor = (definition: UnitDefinition, current: HeroBody, stats: ReturnType<typeof equipmentStats>, part: typeof BODY_PARTS[number]) => current[part].lost ? 0
    : Math.max(0, Math.floor(bodyPartArmor(definition, current, part) + (definition.modifiers.armorBonus ?? 0)
      + stats.groups.reduce((sum, set) => sum + set.bonuses.reduce((total, bonus) => total + (bonus.aura?.modifiers.armorBonus ?? 0), 0), 0)));
  const parts = BODY_PARTS.map(part => ({ part, lost: !!beforeBody[part].lost, beforeMax: beforeBody[part].max, afterMax: afterBody[part].max,
    beforeArmor: armor(beforeDefinition, beforeBody, before, part), afterArmor: armor(afterDefinition, afterBody, after, part) }))
    .filter(part => part.beforeMax !== part.afterMax || part.beforeArmor !== part.afterArmor);
  const added = preview.equipment.find(item => item.id === reward.definitionId && item.slot === target)!;
  const restored = preview.equipment.filter(item => item !== added && !equipped.some(current => sameItem(item, current)));
  const inspectedSets = new Set([...preview.removed, added].flatMap(item => item.setId ? [item.setId] : []));
  const setIds = new Set([...equipped, ...preview.equipment].flatMap(item => item.setId ? [item.setId] : []));
  const sets = [...setIds].flatMap(id => {
    const set = EQUIPMENT_SETS[id];
    if (!set?.bonuses?.length) return [];
    const old = before.groups.find(group => group.setId === id), next = after.groups.find(group => group.setId === id);
    const oldPieces = old?.equippedPieces ?? 0, nextPieces = next?.equippedPieces ?? 0;
    const bonuses = set.bonuses.map(bonus => ({ bonus, before: !!old?.bonuses.some(entry => entry.pieces === bonus.pieces), after: !!next?.bonuses.some(entry => entry.pieces === bonus.pieces) }));
    if (!inspectedSets.has(id) && oldPieces === nextPieces && bonuses.every(entry => entry.before === entry.after)) return [];
    return [{ set, oldPieces, nextPieces, bonuses }];
  });
  return { preview, before, after, beforeBody, afterBody, parts, sets, added, restored };
}

export type RewardEquipmentComparison = ReturnType<typeof compareRewardEquipment>;
