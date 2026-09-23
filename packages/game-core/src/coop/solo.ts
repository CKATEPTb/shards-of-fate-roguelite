import type { CoopState, ExpeditionState, GameContent } from '@shards/shared';
import { hashValue } from '../canonical';
import { generateRoamingGroups } from '../roaming/generation';
import { coopView } from './view';
import { coopChunk, ensureCoopChunk } from './world';
import { initialProgress } from './progression';
import { initialSeasonBosses } from './bosses';

/** Upgrade an idle older solo save without changing its geometry or injuries. */
export function upgradeSoloAdventure(saved: ExpeditionState, content: GameContent): ExpeditionState {
  if (saved.cooperative || saved.combat) return saved;
  const ids = saved.world.actors.map(actor => actor.id);
  const version = saved.world.graph.structureVersion ?? 1;
  const seed = saved.world.graph.seed;
  const groups = saved.roaming?.chunks ?? {};
  const killedEnemyIds: string[] = [];
  for (const [chunkId, alive] of Object.entries(groups)) {
    const present = new Set(alive.flatMap(group => group.members.map(mob => mob.id)));
    for (const group of generateRoamingGroups(seed, coopChunk(seed, chunkId, version), content, saved.difficultyId)) {
      for (const mob of group.members) if (!present.has(mob.id)) killedEnemyIds.push(mob.id);
    }
  }
  const cooperative: CoopState = {
    version: 1, worldVersion: version, contentHash: hashValue(content), seed, difficultyId: saved.difficultyId ?? 'normal', characterIds: ids,
    tick: saved.world.tick, diceIndex: Object.values(saved.diceCounters ?? {}).reduce((sum, count) => sum + count, 0), diceCounters: saved.diceCounters ?? {},
    actors: saved.world.actors.map(actor => ({ ...actor, chunkId: saved.world.currentChunkId, visited: saved.world.visited, transitions: saved.world.transitions })),
    groups, battles: [], killedEnemyIds, interactedStructureIds: saved.clearedPoiIds, removedRewardIds: [],
    bosses: initialSeasonBosses(saved.world.tick, content), completed: saved.completed, failed: saved.failed ?? false, progression: initialProgress(content, ids),
  };
  const state = ensureCoopChunk(cooperative, saved.world.currentChunkId, content);
  return { ...coopView(state, ids[0], content), cooperative: state };
}
