import type { CoopState, GameContent, WorldChunk, WorldGraph } from '@shards/shared';
import { generateWorld } from '../world/graph';
import { generateChunk } from '../world/chunk';
import { generateRoamingGroups } from '../roaming/generation';

const worlds = new Map<string, { graph: WorldGraph; chunks: Map<string, WorldChunk> }>();

/** Immutable geometry has one identity for the lifetime of a room seed. */
export function coopGraph(seed: string, structureVersion: 1 | 2 | 3 = 3): WorldGraph {
  let cached = worlds.get(`${structureVersion}:${seed}`);
  if (!cached) {
    cached = { graph: generateWorld(seed, { structureVersion }), chunks: new Map() };
    worlds.set(`${structureVersion}:${seed}`, cached);
  }
  return cached.graph;
}

export function coopChunk(seed: string, chunkId: string, structureVersion: 1 | 2 | 3 = 3): WorldChunk {
  const graph = coopGraph(seed, structureVersion);
  const cache = worlds.get(`${structureVersion}:${seed}`)!.chunks;
  let chunk = cache.get(chunkId);
  if (!chunk) { chunk = generateChunk(graph, chunkId); cache.set(chunkId, chunk); }
  return chunk;
}

/** Entering an already occupied chunk must not teleport mobs or erase pursuit. */
export function ensureCoopChunk(state: CoopState, chunkId: string, content: GameContent): CoopState {
  if (state.groups[chunkId]) return state;
  const killed = new Set(state.killedEnemyIds);
  const groups = generateRoamingGroups(state.seed, coopChunk(state.seed, chunkId, state.worldVersion ?? 2), content, state.difficultyId)
    .map(group => ({ ...group, members: group.members.filter(mob => !killed.has(mob.id)) }))
    .filter(group => group.members.length);
  return { ...state, groups: { ...state.groups, [chunkId]: groups } };
}

export const compareCoopIds = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
