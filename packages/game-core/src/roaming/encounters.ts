import type { RoamingEncounter, RoamingGroup, RoamingMob, WorldActor, WorldChunk } from '@shards/shared';
import { distanceSquared, inRoamingRange, sameRoamingRegion } from './navigation';
import { isBodyAlive } from '../anatomy';

export const ROAMING_COMBAT_RADIUS = 1;
export const ROAMING_AGGRO_RADIUS = 5;
export const ROAMING_REINFORCEMENT_RADIUS = 5;
export const ROAMING_SPECIAL_DETECTION_RADIUS = 8;

interface Initiator { group: RoamingGroup; mob: RoamingMob; hero: WorldActor }

function collectEncounter(chunk: WorldChunk, groups: RoamingGroup[], { group, mob, hero }: Initiator, includePursuers = true): RoamingEncounter {
  // Pursuing packs are already engaged. Only the original mob and hero recruit
  // nearby patrols; neither pursuers nor those recruits extend the search.
  const joined = groups.filter(candidate => candidate.id === group.id || (includePursuers && candidate.mode === 'chase') || candidate.members.some(member =>
    inRoamingRange(chunk, member.position, mob.position, ROAMING_REINFORCEMENT_RADIUS)
    || inRoamingRange(chunk, member.position, hero.position, ROAMING_REINFORCEMENT_RADIUS)));
  return { groupIds: joined.map(candidate => candidate.id), mobId: mob.id, actorId: hero.id,
    enemyIds: joined.flatMap(candidate => candidate.members.map(member => member.definitionId)) };
}

/** Optional rules validate saved battles without changing their original roster. */
export function findRoamingEncounter(chunk: WorldChunk, groups: RoamingGroup[], heroes: WorldActor[], radius = ROAMING_COMBAT_RADIUS, includePursuers = true): RoamingEncounter | null {
  let initiator: Initiator | undefined;
  let nearest = Infinity;
  for (const group of groups) for (const mob of group.members) for (const hero of heroes) {
    if (hero.body && !isBodyAlive(hero.body)) continue;
    const distance = distanceSquared(mob.position, hero.position);
    if (distance < nearest && inRoamingRange(chunk, mob.position, hero.position, radius)) {
      initiator = { group, mob, hero }; nearest = distance;
    }
  }
  return initiator ? collectEncounter(chunk, groups, initiator, includePursuers) : null;
}

/** Preview includes the same pursuing packs and nearby patrols as a new battle. */
export function previewRoamingEncounter(chunk: WorldChunk, groups: RoamingGroup[], heroes: WorldActor[], groupId: string): RoamingEncounter | null {
  const group = groups.find(candidate => candidate.id === groupId);
  if (!group) return null;
  let initiator: Initiator | undefined;
  let nearest = Infinity;
  for (const mob of group.members) for (const hero of heroes) {
    if (hero.body && !isBodyAlive(hero.body)) continue;
    // Prefer the region from which this group can actually be approached.
    const distance = distanceSquared(mob.position, hero.position)
      + (sameRoamingRegion(chunk, mob.position, hero.position) ? 0 : chunk.size ** 2 * 3);
    if (distance < nearest) { initiator = { group, mob, hero }; nearest = distance; }
  }
  return initiator ? collectEncounter(chunk, groups, initiator) : null;
}
