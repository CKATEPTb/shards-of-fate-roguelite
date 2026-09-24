import { COMMON_NATIVE_SKILL_RARITIES, NPC_EQUIPMENT_UPGRADE_PRICES, NPC_SET_PRICES, NPC_SKILL_PRICES, NPC_SKILL_UPGRADE_PRICES,
  REWARD_RARITIES, listHeroAbilityUpgrades, nextEquipmentUpgrade, resolveEquipmentItem,
  type AdventureReward, type CoopCommand, type CoopState, type GameContent, type NpcOffer } from '@shards/shared';
import { isBodyAlive } from '../anatomy';
import { hashString } from '../random';
import { samePoint } from '../world/grid';
import { getCoopBattle } from './battles';
import { applyHeroLoadout } from './progression';
import { coopRewardId } from './rewards';
import { coopChunk } from './world';

type ServiceCommand = Extract<CoopCommand, { type: 'npc-buy' | 'npc-upgrade-equipment' | 'npc-upgrade-skill' }>;

/** Fixed private generation: visiting a shop never consumes anybody's combat dice. */
export function merchantOffers(seed: string, poiId: string, content: GameContent): NpcOffer[] {
  const ranked = <T extends { id: string }>(entries: T[], salt: string) => entries.sort((a, b) =>
    hashString(`${seed}:merchant:${poiId}:${salt}:${a.id}`) - hashString(`${seed}:merchant:${poiId}:${salt}:${b.id}`)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return REWARD_RARITIES.flatMap(rarity => {
    const sets = ranked(Object.values(content.equipmentCatalog?.sets ?? {}).filter(set => set.rarity === rarity && set.itemIds.length), `set:${rarity}`).slice(0, 1);
    const skills = ranked(content.skills.filter(skill => skill.rarity === rarity && skill.tags.includes('LEARNABLE') && !skill.tags.includes('UPGRADED')), `skill:${rarity}`).slice(0, 2);
    return [...sets.map(set => ({ id: `set:${set.id}`, kind: 'set' as const, definitionId: set.id, rarity, price: NPC_SET_PRICES[rarity] })),
      ...skills.map(skill => ({ id: `skill:${skill.id}`, kind: 'skill' as const, definitionId: skill.id, rarity, price: NPC_SKILL_PRICES[rarity] }))];
  });
}

/** Both host commands and peer event replay use this same atomic transaction. */
export function applyNpcService(state: CoopState, actorId: string, command: ServiceCommand, content: GameContent): CoopState {
  const actor = state.actors.find(hero => hero.id === actorId), old = state.progression?.heroes[actorId];
  if (!actor || !old || state.failed || state.completed || actor.body && !isBodyAlive(actor.body) || getCoopBattle(state, actorId)) throw new Error('Сейчас услуги NPC недоступны.');
  if (actor.chunkId !== command.chunkId || actor.path.length) throw new Error('Сначала подойдите к NPC.');
  const poi = coopChunk(state.seed, command.chunkId, state.worldVersion ?? 2).pois.find(poi => poi.id === command.poiId);
  const kind = command.type === 'npc-buy' ? 'merchant' : command.type === 'npc-upgrade-equipment' ? 'blacksmith' : 'scribe';
  if (!poi || poi.kind !== 'npc' || poi.npcKind !== kind || !samePoint(actor.position, poi.position)) throw new Error('Сначала подойдите к нужному NPC.');
  const afford = (price: number) => { if (old.coins < price) throw new Error('Недостаточно монет.'); };

  if (command.type === 'npc-buy') {
    const offer = merchantOffers(state.seed, poi.id, content).find(offer => offer.id === command.offerId);
    if (!offer) throw new Error('Этого товара нет у торговца.');
    const purchaseId = `${poi.id}:${offer.id}`;
    if (old.npcPurchases?.includes(purchaseId)) return state;
    afford(offer.price);
    const kind = offer.kind === 'set' ? 'equipment' : 'skill';
    const definitions = offer.kind === 'set' ? content.equipmentCatalog!.sets[offer.definitionId].itemIds : [offer.definitionId];
    const rewards: AdventureReward[] = definitions.map((definitionId, index) => {
      const definition = kind === 'equipment' ? resolveEquipmentItem(content.equipmentCatalog?.items, definitionId) : content.skills.find(skill => skill.id === definitionId);
      if (!definition) throw new Error('Предложение торговца больше не доступно.');
      return { id: `npc:${actorId}:${purchaseId}:${index}`, kind, definitionId, rarity: definition.rarity ?? 'common', source: `merchant:${poi.id}`, luckRolls: [] };
    });
    const next = applyHeroLoadout(state, actorId, { ...old, coins: old.coins - offer.price,
      inventory: [...(old.inventory ?? []), ...rewards], npcPurchases: [...(old.npcPurchases ?? []), purchaseId] }, content,
      { optimizeEquipment: true });
    return { ...next,
      removedRewardIds: [...new Set([...next.removedRewardIds, ...rewards.map(reward => coopRewardId(`${actorId}:${reward.kind}`, reward.definitionId))])] };
  }
  if (command.type === 'npc-upgrade-equipment') {
    const equipped = old.equipment.find(item => item.slot === command.slot);
    const next = nextEquipmentUpgrade(content.equipmentCatalog?.items, command.expectedItemId);
    if (equipped && next && equipped.itemId === next.id) return state;
    if (!equipped || equipped.itemId !== command.expectedItemId) throw new Error('Экипировка уже изменилась. Выберите предмет заново.');
    if (!next) throw new Error('Предмет уже легендарный.');
    const price = NPC_EQUIPMENT_UPGRADE_PRICES[next.rarity ?? 'common'];
    afford(price);
    return applyHeroLoadout(state, actorId, { ...old, coins: old.coins - price,
      equipment: old.equipment.map(item => item === equipped ? { ...item, itemId: next.id } : item) }, content, { optimizeEquipment: true });
  }
  const definition = content.characters.find(hero => hero.id === actorId)!;
  const ability = listHeroAbilityUpgrades(definition, old, content).find(ability => ability.slot === command.slot);
  if (!ability?.current || ability.current.id !== command.expectedId || ability.current.rarity !== command.expectedRarity) throw new Error('Способность уже изменилась. Выберите её заново.');
  if (!ability.next) throw new Error('Способность уже легендарная.');
  const price = NPC_SKILL_UPGRADE_PRICES[ability.next.rarity];
  afford(price);
  const hero = { ...old, coins: old.coins - price };
  if (command.slot === 'skill0' || command.slot === 'skill1') {
    hero.skills = [...old.skills];
    hero.skills[command.slot === 'skill0' ? 0 : 1] = ability.next.id;
  } else hero.nativeSkillRarities = { ...(old.nativeSkillRarities ?? COMMON_NATIVE_SKILL_RARITIES), [command.slot]: ability.next.rarity };
  return applyHeroLoadout(state, actorId, hero, content);
}
