import { adventureContent, contentWithLoadouts } from './progression';
import type { CoopState, ExpeditionState, GameContent, WorldActor } from '@shards/shared';
import { getCoopBattle } from './battles';
import { coopChunk, coopGraph } from './world';

/** A render adapter, not a legacy solo snapshot: room battles may contain a subset of the chunk's heroes. */
export function coopView(state: CoopState, actorId: string, _content: GameContent): ExpeditionState {
  const viewer = state.actors.find(actor => actor.id === actorId);
  if (!viewer) throw new Error('Unknown co-op viewer');
  const graph = coopGraph(state.seed, state.worldVersion ?? 2);
  const chunk = coopChunk(state.seed, viewer.chunkId, state.worldVersion ?? 2);
  const battle = getCoopBattle(state, actorId) ?? state.battles.find(battle => (battle.presentationUntilTick ?? 0) > state.tick
    && battle.combat.units.some(unit => unit.definitionId === actorId && unit.escaped));
  const actors: WorldActor[] = state.actors.filter(actor => actor.chunkId === viewer.chunkId).map(({ chunkId: _chunk, visited: _visited, transitions: _transitions, ...actor }) => actor);
  const groupIds = battle ? (state.groups[viewer.chunkId] ?? []).filter(group => group.members.some(mob => battle.mobIds.includes(mob.id))).map(group => group.id) : [];
  return {
    bosses: state.bosses,
    progression: state.progression, content: battle ? contentWithLoadouts(_content, battle.loadouts) : adventureContent(state, _content),
    version: 1, difficultyId: state.difficultyId,
    world: { version: 1, graph, chunk, currentChunkId: viewer.chunkId, actors,
      visited: viewer.visited, tick: state.tick, transitions: viewer.transitions },
    clearedPoiIds: [...state.interactedStructureIds.filter(id => id.endsWith(':altar')),
      ...chunk.pois.filter(poi => poi.kind === 'altar' && state.bosses?.spawned.some(boss => boss.season === (poi.bossSeason ?? chunk.season))).map(poi => poi.id),
      ...(state.progression?.heroes[actorId]?.claimedSources ?? []).filter(id => id.startsWith('chest:') || id.startsWith('well:')).map(id => id.slice(id.indexOf(':') + 1))],
    activePoiId: battle?.initiatorMobId ?? null, combat: battle?.combat ?? null,
    completed: state.completed, failed: state.failed,
    roaming: { version: 1, chunks: state.groups, battleSerial: state.battles.length,
      active: battle ? { groupIds, mobId: battle.initiatorMobId, actorId: battle.initiatorActorId,
        enemyIds: battle.combat.enemyIds ?? [], triggerRadius: 1 } : null },
  };
}
