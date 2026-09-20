import type { GridPoint, RoamingGroup, RoamingMob, WorldActor, WorldChunk } from '@shards/shared';
import { samePoint, tileIndex } from '../world/grid';
import { advanceActor } from '../world/movement';
import { createMovementState } from '../world/movement-speed';
import { findPath } from '../world/pathfinding';
import { ROAMING_AGGRO_RADIUS, ROAMING_SPECIAL_DETECTION_RADIUS } from './encounters';
import { distanceSquared, formationPoints, inRoamingRange, roamingNavigation, sameRoamingRegion } from './navigation';
import { roamingRandom, shuffled } from './random';
import { isBodyAlive } from '../anatomy';

function routeMember(member: RoamingMob, chunk: WorldChunk, target: GridPoint): RoamingMob {
  if (member.path.length && samePoint(member.path[member.path.length - 1], target)) return member;
  if (!member.path.length && samePoint(member.position, target)) return member;
  const path = findPath(chunk, member.position, target, member);
  const previous = member.movement ?? createMovementState();
  const keepProgress = member.path[0] && path[0] && samePoint(member.path[0], path[0]);
  return { ...member, path, movement: keepProgress ? previous : { ...previous, elapsedMs: 0 } };
}

/** Initial detection needs sight; an alerted pack tracks accessible heroes across the chunk. */
function nearestHero(group: RoamingGroup, chunk: WorldChunk, heroes: WorldActor[]): WorldActor | undefined {
  let target: WorldActor | undefined;
  let nearest = Infinity;
  for (const member of group.members) for (const hero of heroes) {
    const distance = distanceSquared(member.position, hero.position);
    const preferred = distance < nearest || distance === nearest && hero.id === group.targetActorId;
    if (!preferred) continue;
    const reachable = group.mode === 'chase' ? sameRoamingRegion(chunk, member.position, hero.position)
      : inRoamingRange(chunk, member.position, hero.position, group.chases ? ROAMING_SPECIAL_DETECTION_RADIUS : ROAMING_AGGRO_RADIUS);
    if (reachable) {
      target = hero; nearest = distance;
    }
  }
  return target;
}

function patrolRoute(group: RoamingGroup, chunk: WorldChunk, seed: string): RoamingGroup {
  const leader = group.members[0];
  if (!leader) return group;
  const random = roamingRandom(seed, `patrol:${group.id}:${group.decision}`);
  const candidates = shuffled(formationPoints(chunk, leader.position, 4), random)
    .filter(point => !samePoint(point, leader.position) && distanceSquared(point, group.home) <= 49);
  const returnPath = candidates.length ? [] : findPath(chunk, leader.position, group.home, leader);
  const anchor = candidates[0] ?? returnPath[Math.min(3, returnPath.length - 1)] ?? leader.position;
  const slots = formationPoints(chunk, anchor, 2);
  const members = group.members.map((member, index) => {
    const slotIndex = index === 0 ? 0 : slots.reduce((nearest, point, candidate) =>
      distanceSquared(point, member.position) < distanceSquared(slots[nearest], member.position) ? candidate : nearest, 0);
    const target = slots.splice(slotIndex, 1)[0] ?? anchor;
    return routeMember(member, chunk, target);
  });
  return { ...group, members, decision: group.decision + 1, pauseMs: 0 };
}

function chaseRoute(group: RoamingGroup, chunk: WorldChunk, heroes: WorldActor[]): RoamingGroup {
  const target = heroes.find(hero => hero.id === group.targetActorId);
  if (!target || !group.members.some(member => sameRoamingRegion(chunk, member.position, target.position))) {
    return { ...group, members: group.members.map(member => ({ ...member, path: [],
    movement: { ...(member.movement ?? createMovementState()), elapsedMs: 0 } })), pauseMs: 320 };
  }
  const { gates } = roamingNavigation(chunk);
  const destination = gates.has(tileIndex(target.position, chunk.size))
    ? formationPoints(chunk, target.position, 1).find(point => !gates.has(tileIndex(point, chunk.size))) : target.position;
  const members = group.members.map(member => destination && sameRoamingRegion(chunk, member.position, destination)
    ? routeMember(member, chunk, destination) : member);
  return { ...group, members, pauseMs: 320 };
}

function stepGroup(initial: RoamingGroup, chunk: WorldChunk, heroes: WorldActor[], elapsedMs: number, seed: string): RoamingGroup {
  let group = initial;
  const target = nearestHero(group, chunk, heroes);
  if (target && (group.mode !== 'chase' || group.targetActorId !== target.id)) {
    group = { ...group, mode: 'chase', targetActorId: target.id, pauseMs: 0 };
  }
  if (group.mode === 'chase' && !target) return chaseRoute(group, chunk, heroes);
  if (group.mode === 'patrol' && group.pauseMs > 0) return { ...group, pauseMs: Math.max(0, group.pauseMs - elapsedMs) };
  if (group.mode === 'chase') {
    group = { ...group, pauseMs: Math.max(0, group.pauseMs - elapsedMs) };
    if (!group.pauseMs || group.members.every(member => !member.path.length)) group = chaseRoute(group, chunk, heroes);
  } else if (group.members.every(member => !member.path.length)) group = patrolRoute(group, chunk, seed);
  const members = group.members.map(member => advanceActor(member, chunk, elapsedMs) as RoamingMob);
  if (group.mode === 'patrol' && members.every(member => !member.path.length)) {
    const random = roamingRandom(seed, `pause:${group.id}:${group.decision}`);
    return { ...group, members, pauseMs: 500 + Math.floor(random() * 1400) };
  }
  return { ...group, members };
}

/** Pure clocks and saved decision counters make pause/save/load deterministic. */
export function stepRoamingGroups(groups: RoamingGroup[], chunk: WorldChunk, heroes: WorldActor[], elapsedMs: number, seed: string): RoamingGroup[] {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Invalid roaming elapsed time');
  if (!elapsedMs || !groups.length) return groups;
  heroes = heroes.filter(hero => !hero.body || isBodyAlive(hero.body));
  return groups.map(group => stepGroup(group, chunk, heroes, elapsedMs, seed));
}
