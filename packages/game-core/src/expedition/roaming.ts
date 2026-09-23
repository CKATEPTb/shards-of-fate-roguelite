import type { ExpeditionState, GameContent, RoamingEncounter, RoamingGroup } from '@shards/shared';
import { createCombat } from '../create';
import { generateRoamingGroups, prepareRoamingArrival } from '../roaming';
import { hashString } from '../random';
import { resetMovementProgress } from './movement-speeds';
import { generateChunk } from '../world/chunk';
import { partyBodies } from './party-health';
import { expeditionCombatDice } from './dice';

export function roamingBattleSeed(seed: string, chunkId: string, serial: number): string {
  return `roaming:${hashString(seed)}:${chunkId}:${serial}`;
}

/** Upgrade exploration lazily, preserving unfinished legacy battles and cleared chunks. */
export function enableRoaming(state: ExpeditionState, content: GameContent): ExpeditionState {
  if (state.roaming || state.combat) return state;
  const startId = state.world.graph.startId;
  const start = state.world.currentChunkId === startId ? state.world.chunk : generateChunk(state.world.graph, startId);
  const groups = state.clearedPoiIds.includes(`${startId}:encounter`) ? [] : generateRoamingGroups(state.world.graph.seed, start, content, state.difficultyId);
  return enterRoamingChunk({ ...state, roaming: { version: 1, chunks: { [startId]: groups }, battleSerial: 0, active: null } }, content);
}

export function enterRoamingChunk(state: ExpeditionState, content: GameContent): ExpeditionState {
  const { world, roaming } = state;
  if (!roaming) return state;
  const old = roaming.chunks[world.currentChunkId];
  const clearedLegacy = state.clearedPoiIds.includes(`${world.currentChunkId}:encounter`);
  const generated = old ?? (clearedLegacy ? [] : generateRoamingGroups(world.graph.seed, world.chunk, content, state.difficultyId));
  const groups = prepareRoamingArrival(generated, world.chunk, world.actors, world.graph.seed);
  return withRoamingGroups(state, groups);
}

export function withRoamingGroups(state: ExpeditionState, groups: RoamingGroup[]): ExpeditionState {
  const roaming = state.roaming!;
  return { ...state, roaming: { ...roaming, chunks: { ...roaming.chunks, [state.world.currentChunkId]: groups } } };
}

export function beginRoamingBattle(state: ExpeditionState, encounter: RoamingEncounter, content: GameContent): ExpeditionState {
  const roaming = state.roaming!;
  const battleSerial = roaming.battleSerial + 1;
  const world = { ...state.world, actors: state.world.actors.map(actor => ({ ...resetMovementProgress(actor), path: [] })) };
  const groups = roaming.chunks[world.currentChunkId].map(group => ({ ...group,
    members: group.members.map(member => ({ ...resetMovementProgress(member), path: [] })),
  }));
  return {
    ...state, world, activePoiId: encounter.mobId,
    roaming: { ...roaming, battleSerial, active: { ...encounter, triggerRadius: 1, includePursuers: true }, chunks: { ...roaming.chunks, [world.currentChunkId]: groups } },
    combat: expeditionCombatDice(state, createCombat({ seed: world.graph.seed,
      characterIds: world.actors.map(actor => actor.id), heroBodies: partyBodies(world.actors), encounterId: 'roaming', enemyIds: encounter.enemyIds, difficultyId: state.difficultyId }, content),
      encounter.groupIds.flatMap(id => groups.find(group => group.id === id)?.members.map(mob => mob.id) ?? [])),
  };
}
