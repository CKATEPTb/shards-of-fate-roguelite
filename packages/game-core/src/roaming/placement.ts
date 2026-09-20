import type { GridPoint, RoamingGroup, WorldActor, WorldChunk } from '@shards/shared';
import { tileIndex } from '../world/grid';
import { createMovementState } from '../world/movement-speed';
import { regionAt } from '../world/regions';
import { ROAMING_SPECIAL_DETECTION_RADIUS } from './encounters';
import { distanceSquared, formationPoints, roamingNavigation } from './navigation';
import { roamingRandom, shuffled } from './random';

export function safeRoamingPoint(point: GridPoint, protectedPoints: GridPoint[]): boolean {
  return protectedPoints.every(other => distanceSquared(point, other) > ROAMING_SPECIAL_DETECTION_RADIUS ** 2);
}

/** Pick a complete, compact formation; never scatter a pack between regions. */
export function placeRoamingFormation(chunk: WorldChunk, candidates: GridPoint[], count: number,
  safe: (point: GridPoint) => boolean, occupied: Set<number> = new Set()): GridPoint[] | null {
  for (const anchor of candidates) {
    if (!safe(anchor) || occupied.has(tileIndex(anchor, chunk.size))) continue;
    const slots = formationPoints(chunk, anchor).filter(point => safe(point) && !occupied.has(tileIndex(point, chunk.size)));
    if (slots.length >= count) return slots.slice(0, count);
  }
  return null;
}

/** Chunks freeze off-screen. Clear pursuit and keep each new arrival out of danger. */
export function prepareRoamingArrival(groups: RoamingGroup[], chunk: WorldChunk, heroes: WorldActor[], seed: string): RoamingGroup[] {
  const { points, regions } = roamingNavigation(chunk);
  const protectedPoints = heroes.map(hero => hero.position);
  const safe = (point: GridPoint) => safeRoamingPoint(point, protectedPoints);
  const occupied = new Set<number>();
  return groups.map(group => {
    let positions = group.members.map(member => member.position);
    let home = group.home;
    if (!positions.every(safe)) {
      const region = regionAt(chunk, regions, positions[0] ?? home);
      const candidates = shuffled(points, roamingRandom(seed, `arrival:${group.id}:${heroes[0]?.position.x}:${heroes[0]?.position.y}`));
      // Preserve the current area when possible. Tiny gate pockets can be too
      // small for a safe arrival, so the fallback places the intact pack elsewhere.
      const ordered = [...candidates.filter(point => regionAt(chunk, regions, point) === region),
        ...candidates.filter(point => regionAt(chunk, regions, point) !== region)];
      const placement = placeRoamingFormation(chunk, ordered, positions.length, safe, occupied);
      if (!placement) throw new Error('No safe roaming arrival formation');
      positions = placement; home = positions[0];
    }
    positions.forEach(point => occupied.add(tileIndex(point, chunk.size)));
    return { ...group, home, mode: 'patrol', targetActorId: null, pauseMs: Math.max(600, group.pauseMs),
      members: group.members.map((member, index) => ({ ...member, position: positions[index], path: [],
        movement: { ...(member.movement ?? createMovementState()), elapsedMs: 0 } })) };
  });
}
