import { SEASON_BOSS_ORDER, type CoopState, type ExpeditionState, type GridPoint } from '@shards/shared';
import { findPath, getCoopBattle, isBodyAlive } from '@shards/game-core';

export interface PoiApproach {
  poiId: string;
  chunkId: string;
  position: GridPoint;
  transitions: number;
}
type PoiPlan = { type: 'unavailable'; reason: string } | { type: 'interact' | 'approach'; approach: PoiApproach };
const samePosition = (left: GridPoint, right: GridPoint) => left.x === right.x && left.y === right.y;

/** Only an explicit object click schedules use; crossing an object on another route does not. */
export function planPoiApproach(state: ExpeditionState, actorId: string, poiId: string): PoiPlan {
  const actor = state.world.actors.find(candidate => candidate.id === actorId);
  const poi = state.world.chunk.pois.find(candidate => candidate.id === poiId);
  if (!actor || !poi || !['portal', 'chest', 'well', 'stairs-down', 'stairs-up', 'altar'].includes(poi.kind)) {
    return { type: 'unavailable', reason: 'Здесь нет доступного объекта.' };
  }
  if (poi.kind === 'altar') {
    const bosses = state.bosses ?? state.cooperative?.bosses;
    const next = bosses && SEASON_BOSS_ORDER.find(season => !bosses.spawned.some(spawn => spawn.season === season));
    if (!poi.bossSeason || !next) return { type: 'unavailable', reason: 'Все сезонные боссы уже призваны.' };
    if (poi.bossSeason !== next) return { type: 'unavailable', reason: bosses?.spawned.some(spawn => spawn.season === poi.bossSeason)
      ? 'Босс этого сезона уже призван.' : 'Сначала призовите босса предыдущего сезона.' };
  }
  if (state.progression?.heroes[actorId]?.claimedSources.includes(`${poi.kind}:${poi.id}`)) {
    return { type: 'unavailable', reason: poi.kind === 'well' ? 'Вы уже использовали этот колодец.' : 'Вы уже открыли этот сундук.' };
  }
  const approach: PoiApproach = { poiId, chunkId: state.world.currentChunkId, position: { ...poi.position }, transitions: state.world.transitions };
  const arrived = samePosition(actor.position, poi.position);
  if (arrived && !actor.path.length) return { type: 'interact', approach };
  if (!arrived && !findPath(state.world.chunk, actor.position, poi.position, actor).length) {
    return { type: 'unavailable', reason: 'К объекту нет прохода. Нужен другой вход.' };
  }
  return { type: 'approach', approach };
}

/** A guest may finish its predicted route before the host confirms actual arrival. */
export function poiApproachReadiness(approach: PoiApproach, state: ExpeditionState, actorId: string, confirmed?: CoopState | null): 'cancel' | 'wait' | 'ready' {
  const actor = state.world.actors.find(candidate => candidate.id === actorId);
  if (!actor || state.combat || state.failed || state.completed || actor.body && !isBodyAlive(actor.body)
    || state.world.currentChunkId !== approach.chunkId || state.world.transitions !== approach.transitions) return 'cancel';
  const poi = state.world.chunk.pois.find(candidate => candidate.id === approach.poiId);
  if (!poi || !samePosition(poi.position, approach.position)) return 'cancel';
  const destination = actor.path.at(-1);
  if (destination) return samePosition(destination, approach.position) ? 'wait' : 'cancel';
  if (!samePosition(actor.position, approach.position)) return 'cancel';
  if (confirmed === undefined) return 'ready';
  if (!confirmed) return 'wait';
  const authoritativeActor = confirmed.actors.find(candidate => candidate.id === actorId);
  if (!authoritativeActor || authoritativeActor.chunkId !== approach.chunkId) return 'wait';
  if (confirmed.failed || confirmed.completed || getCoopBattle(confirmed, actorId)
    || authoritativeActor.body && !isBodyAlive(authoritativeActor.body)) return 'cancel';
  return !authoritativeActor.path.length && samePosition(authoritativeActor.position, approach.position) ? 'ready' : 'wait';
}
