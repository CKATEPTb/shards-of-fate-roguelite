import { BODY_PARTS, equipmentBodyPartsForSlot, equipmentItemFitsSlot, type AdventureProgress, type CoopCommand, type CoopState, type GameContent, type HeroBody, type HeroLoadout, type HeroProgress, type InventoryTarget, type RewardResolution, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { coopRewardId } from './rewards';
import { confirmEquipmentChoice } from '../equipment-choice';
import { bodyPartLossThreshold, startHeroBody } from '../anatomy/body';

export function initialProgress(content: GameContent, ids: readonly string[]): AdventureProgress {
  return { heroes: Object.fromEntries(ids.map(id => {
    const hero = content.characters.find(hero => hero.id === id)!;
    return [id, { equipment: (hero.anatomy?.equipment ?? []).flatMap(item => item.id ? [{ itemId: item.id, slot: item.slot }] : []),
      skills: [null, null], coins: 0, rewards: [], inventory: [], claimedSources: [] } satisfies HeroProgress];
  })), campfires: {} };
}

export function equipmentFromLoadout(loadout: HeroLoadout, content: GameContent): StarterEquipment[] {
  return loadout.equipment.map(({ itemId, slot }) => {
    const item = content.equipmentCatalog?.items[itemId];
    if (!item || !equipmentItemFitsSlot(item, slot)) throw new Error('Неизвестный предмет или неподходящий слот.');
    return { ...item, slot, bodyParts: equipmentBodyPartsForSlot(item, slot) };
  });
}

export function equippedHero(hero: UnitDefinition, loadout: HeroLoadout, content: GameContent): UnitDefinition {
  if (!hero.anatomy || !content.equipmentCatalog) return hero;
  const equipment = equipmentFromLoadout(loadout, content);
  const old = hero.anatomy.equipment;
  const stats = { ...hero.stats };
  for (const key of ['power', 'initiative', 'evasion', 'crit', 'agility', 'accuracy', 'resilience', 'luck'] as const) {
    stats[key] = (stats[key] ?? 0) - old.reduce((sum, item) => sum + (item.bonuses?.[key] ?? 0), 0)
      + equipment.reduce((sum, item) => sum + (item.bonuses?.[key] ?? 0), 0);
  }
  stats.maxHp = BODY_PARTS.reduce((sum, part) => sum + hero.anatomy!.base[part] + equipment.reduce((total, item) => total + (item.resources[part] ?? 0), 0), 0);
  const setBonuses = [...new Set(equipment.flatMap(item => item.setId ? [item.setId] : []))].sort().flatMap(setId => {
    const set = content.equipmentCatalog!.sets[setId];
    return set?.bonuses?.length ? [{ setId, name: set.name, bonuses: set.bonuses }] : [];
  });
  return { ...hero, stats, skillIds: [...hero.skillIds.filter(id => !content.skills.find(skill => skill.id === id)?.rarity), ...loadout.skills.filter((id): id is string => !!id)],
    anatomy: { ...hero.anatomy, equipment, ...(setBonuses.length ? { setBonuses } : {}) } };
}

const contentCache = new WeakMap<GameContent, Map<string, GameContent>>();
/** Outfit definitions are local derived data. Only catalogue IDs enter saves and frames. */
export function contentWithLoadouts(content: GameContent, loadouts?: Record<string, HeroLoadout>): GameContent {
  if (!loadouts || !content.equipmentCatalog) return content;
  let cache = contentCache.get(content);
  if (!cache) contentCache.set(content, cache = new Map());
  const key = JSON.stringify(Object.keys(loadouts).sort().map(id => [id, loadouts[id].equipment, loadouts[id].skills]));
  const found = cache.get(key);
  if (found) return found;
  const next = Object.freeze({ ...content, characters: content.characters.map(hero => loadouts[hero.id] ? equippedHero(hero, loadouts[hero.id], content) : hero) });
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(key, next);
  return next;
}

export function adventureContent(state: Pick<CoopState, 'progression'>, content: GameContent): GameContent {
  return contentWithLoadouts(content, state.progression?.heroes);
}

export function battleLoadouts(state: CoopState, ids: readonly string[]): Record<string, HeroLoadout> | undefined {
  if (!state.progression) return undefined;
  return Object.fromEntries(ids.map(id => [id, { equipment: state.progression!.heroes[id].equipment, skills: state.progression!.heroes[id].skills }]));
}

/** Validate the whole fitting before deriving any committed state. */
function resolveRewardChoice(old: HeroProgress, choice: RewardResolution, content: GameContent): HeroProgress {
  const closed = new Set(choice.rewardIds);
  const available = new Map(old.rewards.map(reward => [reward.id, reward]));
  if (closed.size !== choice.rewardIds.length) throw new Error('Награда указана для завершения выбора несколько раз.');
  for (const id of closed) if (!available.has(id)) throw new Error('Одна из наград уже разобрана. Обновите выбор.');
  if (choice.equipment.length > 10 || choice.skills.length > 2) throw new Error('Выбрано слишком много предметов или навыков.');
  const selected = new Set<string>();
  for (const selection of [...choice.equipment, ...choice.skills]) {
    if (!closed.has(selection.rewardId)) throw new Error('Выбранная награда не входит в завершаемый выбор.');
    if (selected.has(selection.rewardId)) throw new Error('Одну награду нельзя выбрать дважды.');
    selected.add(selection.rewardId);
  }
  const skills: HeroProgress['skills'] = [...old.skills];
  const skillSlots = new Set<0 | 1>();
  for (const selection of choice.skills) {
    if (selection.slot !== 0 && selection.slot !== 1 || skillSlots.has(selection.slot)) throw new Error('Для каждого слота навыка выберите одну награду.');
    const reward = available.get(selection.rewardId)!;
    if (reward.kind !== 'skill' || !content.skills.some(skill => skill.id === reward.definitionId && skill.rarity)) throw new Error('Это не изучаемый навык.');
    skills[selection.slot] = reward.definitionId;
    skillSlots.add(selection.slot);
  }
  const learned = skills.filter((id): id is string => id !== null);
  if (new Set(learned).size !== learned.length) throw new Error('Один навык нельзя экипировать в оба слота.');

  let equipment = old.equipment;
  if (choice.equipment.length) {
    if (!content.equipmentCatalog) throw new Error('Каталог экипировки недоступен.');
    for (const selection of choice.equipment) if (available.get(selection.rewardId)!.kind !== 'equipment') throw new Error('Это не предмет экипировки.');
    // This validates every slot and both hands together, then destroys only displaced gear.
    const chosen = confirmEquipmentChoice(equipmentFromLoadout(old, content), old.rewards.filter(reward => reward.kind === 'equipment')
      .map(reward => ({ id: reward.id, itemId: reward.definitionId })), choice.equipment, content.equipmentCatalog.items);
    equipment = chosen.equipment.map(item => ({ itemId: item.id!, slot: item.slot }));
  }
  return { ...old, equipment, skills, rewards: old.rewards.filter(reward => !closed.has(reward.id)) };
}

/** The slot picker and committed command use identical validation and replacement rules. */
export function previewInventoryEquip(old: HeroProgress, inventoryId: string, target: InventoryTarget, content: GameContent, body?: HeroBody): HeroProgress {
  const inventory = old.inventory ?? [];
  const reward = inventory.find(entry => entry.id === inventoryId);
  if (!reward) throw new Error('Этой находки больше нет в инвентаре.');
  let equipment = old.equipment, skills = old.skills;
  if (target === 'skill0' || target === 'skill1') {
    if (reward.kind !== 'skill' || !content.skills.some(skill => skill.id === reward.definitionId && skill.rarity)) throw new Error('Это не изучаемый навык.');
    if (old.skills.includes(reward.definitionId)) throw new Error('Этот навык уже экипирован.');
    skills = [...old.skills];
    skills[target === 'skill0' ? 0 : 1] = reward.definitionId;
  } else {
    if (reward.kind !== 'equipment' || !content.equipmentCatalog) throw new Error('Это не предмет экипировки.');
    const item = content.equipmentCatalog.items[reward.definitionId];
    if (!item || !equipmentItemFitsSlot(item, target)) throw new Error('Предмет не подходит для этого слота.');
    if (body) {
      const parts = equipmentBodyPartsForSlot(item, target);
      // Paired armor still protects the surviving limb. Held weapons require every occupied hand.
      const missing = item.weapon ? parts.some(part => body[part].lost) : parts.length > 0 && parts.every(part => body[part].lost);
      if (missing) throw new Error(item.weapon?.hands === 2 ? 'Для двуручного оружия нужны обе руки.' : 'Нужная для этого предмета часть тела утрачена.');
    }
    const chosen = confirmEquipmentChoice(equipmentFromLoadout(old, content), [{ id: inventoryId, itemId: reward.definitionId }],
      [{ rewardId: inventoryId, slot: target }], content.equipmentCatalog.items);
    equipment = chosen.equipment.map(item => ({ itemId: item.id!, slot: item.slot }));
  }
  // Displaced equipment and skills are destroyed; only untouched bag entries remain available.
  return { ...old, equipment, skills, inventory: inventory.filter(entry => entry.id !== inventoryId) };
}

export function changeLoadout(state: CoopState, actorId: string, command: Extract<CoopCommand, { type: 'equip' | 'learn' | 'discard-reward' | 'resolve-rewards' | 'collect-reward' | 'equip-inventory' }>, content: GameContent): CoopState {
  const progression = state.progression ?? initialProgress(content, state.characterIds);
  const old = progression.heroes[actorId];
  if (!old) throw new Error('Герой не найден.');
  const inventory = old.inventory ?? [];
  let hero: HeroProgress = { ...old, inventory };
  let taken: string[];
  if (command.type === 'collect-reward') {
    // Replayed collection after acknowledgement/consumption cannot recreate an item.
    if (inventory.some(reward => reward.id === command.rewardId) || state.removedRewardIds.includes(command.rewardId)) return state;
    const reward = old.rewards.find(entry => entry.id === command.rewardId);
    if (!reward) throw new Error('Эта награда уже разобрана.');
    hero.inventory = [...inventory, { ...reward }];
    taken = [reward.id];
  } else if (command.type === 'equip-inventory') {
    if (!inventory.some(reward => reward.id === command.inventoryId) && state.removedRewardIds.includes(command.inventoryId)) return state;
    hero = previewInventoryEquip(old, command.inventoryId, command.slot, content, state.actors.find(actor => actor.id === actorId)?.body);
    taken = [command.inventoryId];
  } else if (command.type === 'resolve-rewards') {
    hero = resolveRewardChoice({ ...old, inventory }, command, content);
    if (!command.rewardIds.length) return state;
    taken = command.rewardIds;
  } else if (command.type === 'equip') {
    if (!command.selections.length || !content.equipmentCatalog) throw new Error('Выберите предмет для примерки.');
    const chosen = confirmEquipmentChoice(equipmentFromLoadout(old, content), old.rewards.filter(reward => reward.kind === 'equipment')
      .map(reward => ({ id: reward.id, itemId: reward.definitionId })), command.selections, content.equipmentCatalog.items);
    hero.equipment = chosen.equipment.map(item => ({ itemId: item.id!, slot: item.slot }));
    taken = command.selections.map(selection => selection.rewardId);
  } else {
    const reward = old.rewards.find(reward => reward.id === command.rewardId);
    if (!reward) throw new Error('Эта награда уже разобрана.');
    if (command.type === 'learn') {
      if (reward.kind !== 'skill' || !content.skills.some(skill => skill.id === reward.definitionId && skill.rarity)) throw new Error('Это не изучаемый навык.');
      if (old.skills.includes(reward.definitionId)) throw new Error('Этот навык уже экипирован.');
      hero.skills = [...old.skills]; hero.skills[command.slot] = reward.definitionId;
    }
    taken = [command.rewardId];
  }
  const consumed = new Set(taken);
  hero.rewards = old.rewards.filter(reward => !consumed.has(reward.id));
  const nextProgress = { ...progression, heroes: { ...progression.heroes, [actorId]: hero } };
  const equipmentChanged = hero.equipment !== old.equipment;
  const fresh = equipmentChanged ? startHeroBody(equippedHero(content.characters.find(hero => hero.id === actorId)!, hero, content)) : undefined;
  const actors = state.actors.map(actor => {
    if (actor.id !== actorId || !actor.body || !equipmentChanged) return actor;
    // Preserve health fractions and missing parts: changing outfits cannot heal wounds.
    const body = { ...actor.body };
    for (const part of BODY_PARTS) {
      const resource = actor.body[part], max = fresh![part].max;
      body[part] = { max, lost: resource.lost ?? false, current: resource.lost ? bodyPartLossThreshold(max)
        : Math.max(bodyPartLossThreshold(max) + 1, Math.min(max, Math.floor(resource.current / resource.max * max))) };
    }
    return { ...actor, body };
  });
  const consumedRewards = [...old.rewards, ...(old.inventory ?? [])].filter(reward => consumed.has(reward.id));
  return { ...state, progression: nextProgress, actors, removedRewardIds: [...new Set([...state.removedRewardIds, ...taken,
    ...consumedRewards.map(reward => coopRewardId(`${actorId}:${reward.kind}`, reward.definitionId))])] };
}

/** Catalogue-backed save data: no executable rules or duplicated definitions. */
export function restoreProgress(value: unknown, content: GameContent, ids: readonly string[], tick: number): AdventureProgress {
  if (value === undefined) return initialProgress(content, ids);
  const data = value as AdventureProgress;
  if (!data || typeof data !== 'object' || !data.heroes || !data.campfires) throw new Error('Invalid adventure progress');
  const result = structuredClone(data);
  for (const id of ids) {
    const hero = result.heroes[id];
    if (!hero || !Number.isSafeInteger(hero.coins) || hero.coins < 0 || !Array.isArray(hero.equipment) || hero.equipment.length > 10
      || !Array.isArray(hero.skills) || hero.skills.length !== 2 || !Array.isArray(hero.rewards) || !Array.isArray(hero.claimedSources)
      || hero.inventory !== undefined && !Array.isArray(hero.inventory)) throw new Error('Invalid hero progress');
    hero.inventory ??= [];
    for (const skill of hero.skills) if (skill !== null && !content.skills.some(item => item.id === skill && item.rarity)) throw new Error('Unknown learned skill');
    const learned = hero.skills.filter(skill => skill !== null);
    if (new Set(learned).size !== learned.length) throw new Error('Duplicate learned skill');
    if (content.equipmentCatalog) confirmEquipmentChoice(equipmentFromLoadout(hero, content), [], [], content.equipmentCatalog.items);
    const rewardIds = new Set<string>();
    for (const reward of [...hero.rewards, ...hero.inventory]) {
      if (!reward || typeof reward.id !== 'string' || !reward.id || rewardIds.has(reward.id) || (reward.kind === 'equipment' ? !content.equipmentCatalog?.items[reward.definitionId]
        : reward.kind !== 'skill' || !content.skills.some(skill => skill.id === reward.definitionId && skill.rarity))) throw new Error('Unknown saved reward');
      rewardIds.add(reward.id);
    }
  }
  for (const fire of Object.values(result.campfires)) if (!Number.isSafeInteger(fire.litAtTick) || fire.litAtTick < 0 || fire.litAtTick > tick
    || fire.expiresAtTick !== fire.litAtTick + 4500) throw new Error('Invalid campfire lifetime');
  return result;
}
