import type { CoopState, GameContent, RoamingGroup } from '@shards/shared';
import { isBodyAlive } from '../anatomy/body';
import { createEntityRng } from '../random';
import { drawDie } from '../dice';
import { createMovementState } from '../world/movement-speed';
import { coopChunk } from './world';
import { enterCoopChunk, stopCoopActor } from './movement';
import { awardAdventureLoot, adventureDistance } from './rewards';
import { getCoopBattle, startCoopBattle } from './battles';
import { withinCoopBattleReach } from './battle-reach';
import { initialProgress } from './progression';
import { summonSeasonBoss } from './bosses';

export function interactAdventure(state: CoopState, actorId: string, chunkId: string, poiId: string, content: GameContent): CoopState {
  const actor = state.actors.find(hero => hero.id === actorId);
  if (!actor || actor.chunkId !== chunkId || getCoopBattle(state, actorId)) throw new Error('Герой сейчас не может взаимодействовать.');
  const chunk = coopChunk(state.seed, chunkId, state.worldVersion ?? 2);
  const poi = chunk.pois.find(poi => poi.id === poiId);
  if (!poi || !['altar', 'portal', 'stairs-down', 'stairs-up', 'chest', 'well'].includes(poi.kind)) throw new Error('Здесь нет доступного объекта.');
  const same = actor.position.x === poi.position.x && actor.position.y === poi.position.y;
  // Clicking an object queues an approach; only the completed movement can use it.
  if (actor.path.length || !same) throw new Error('Дождитесь, пока герой подойдёт к объекту.');
  if (poi.kind === 'altar') return summonSeasonBoss(state, content, { actorId, season: poi.bossSeason ?? chunk.season, poiId: poi.id });
  if (poi.destination) {
    const destination = coopChunk(state.seed, poi.destination.chunkId, state.worldVersion ?? 2);
    const target = destination.pois.find(item => item.id === poi.destination!.poiId);
    if (!target) throw new Error('Переход недоступен.');
    return enterCoopChunk(state, actorId, destination.id, target.position, content);
  }
  const progression = state.progression ?? initialProgress(content, state.characterIds);
  const hero = progression.heroes[actorId];
  const source = `${poi.kind}:${poi.id}`;
  if (hero.claimedSources.includes(source)) throw new Error(poi.kind === 'well' ? 'Вы уже использовали этот колодец.' : 'Вы уже открыли этот сундук.');
  state = { ...state, progression, actors: state.actors.map(hero => hero.id === actorId ? stopCoopActor(hero) : hero) };
  if (poi.kind === 'chest') return awardAdventureLoot(state, actorId, source, chunkId, content);
  const owner = `hero:${actorId}`, index = state.diceCounters?.[owner] ?? 0;
  const rng = createEntityRng(state.seed, owner, index);
  const outcome = drawDie(4, rng, 'EVENT');
  state = { ...state, diceIndex: state.diceIndex + 1, diceCounters: { ...state.diceCounters, [owner]: rng.diceIndex } };
  if (outcome !== 1) return awardAdventureLoot(state, actorId, source, chunkId, content);
  const tier = adventureDistance(state, chunkId) < 4 ? 1 : adventureDistance(state, chunkId) < 10 ? 2 : adventureDistance(state, chunkId) < 20 ? 3 : adventureDistance(state, chunkId) < 35 ? 4 : 5;
  const aquatic = content.enemies.filter(enemy => enemy.tags.includes('AQUATIC') && enemy.tags.includes(`SEASON_${chunk.season.toUpperCase()}`));
  const preferred = aquatic.filter(enemy => enemy.tags.includes(`TIER_${tier}`));
  const pool = preferred.length ? preferred : aquatic.length ? aquatic : content.enemies;
  const enemy = pool[drawDie(pool.length, rng, 'EVENT') - 1];
  const mobId = `${poi.id}:water:${actorId}`;
  const group: RoamingGroup = { id: mobId, category: 'normal', chases: true, home: poi.position, mode: 'chase', targetActorId: actorId,
    decision: 0, pauseMs: 0, members: [{ id: mobId, definitionId: enemy.id, position: { ...poi.position }, path: [], movement: createMovementState(enemy.movementSpeed ?? 100) }] };
  state = { ...state, diceIndex: state.diceIndex + 1, diceCounters: { ...state.diceCounters, [owner]: rng.diceIndex },
    progression: { ...progression, heroes: { ...progression.heroes, [actorId]: { ...hero, claimedSources: [...hero.claimedSources, source] } } },
    groups: { ...state.groups, [chunkId]: [...(state.groups[chunkId] ?? []), group] } };
  const actorIds = state.actors.filter(hero => hero.chunkId === chunkId && (!hero.body || isBodyAlive(hero.body)) && !getCoopBattle(state, hero.id)
    && withinCoopBattleReach(chunk, hero.position, actor.position, hero)).map(hero => hero.id);
  return startCoopBattle(state, { type: 'battle-start', battleId: `battle:${state.tick}:${mobId}`, chunkId, actorIds, mobIds: [mobId], enemyIds: [enemy.id],
    initiatorActorId: actorId, initiatorMobId: mobId, diceIndex: state.diceIndex }, content);
}
