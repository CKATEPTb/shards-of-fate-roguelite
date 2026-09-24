import type { CoopActor, CoopState, GridPoint, WorldChunk, WorldGraph, WorldNode } from '@shards/shared';
import { bodyMovementMultiplier, isBodyAlive } from '../anatomy';
import { parseBasementChunkId } from '../world/chunk-identity';
import { isWalkable, neighbors, samePoint, tileIndex } from '../world/grid';
import { findPath } from '../world/pathfinding';
import { planChunk, type ChunkPlan } from '../world/plan';
import { insidePocketMask } from '../world/pockets';
import { getCoopBattle } from './battles';
import { coopChunk, coopGraph } from './world';

export type CoopFollowPlan =
  | { type: 'move'; chunkId: string; position: GridPoint; fromElapsedMs: number }
  | { type: 'interact'; chunkId: string; poiId: string; position: GridPoint }
  | { type: 'wait'; reason: 'unavailable' | 'nearby' | 'moving' | 'unreachable' };

interface Region { chunkId: string; pocket: boolean }
interface Transition { kind: 'gate' | 'poi'; id: string; target: Region }
interface RouteCache {
  nodes: Map<string, WorldNode>;
  plans: Map<string, ChunkPlan>;
  routes: Map<string, Map<string, Transition | null>>;
}

// Only immutable metadata is cached. A world search never generates remote terrain,
// and subsequent movement toward the same destination reuses the remaining route.
const worlds = new WeakMap<WorldGraph, RouteCache>();
const key = (region: Region): string => `${region.chunkId}#${region.pocket ? 1 : 0}`;

function routeCache(graph: WorldGraph): RouteCache {
  let cache = worlds.get(graph);
  if (!cache) {
    cache = { nodes: new Map(graph.nodes.map(node => [node.id, node])), plans: new Map(), routes: new Map() };
    worlds.set(graph, cache);
  }
  return cache;
}

function chunkPlan(graph: WorldGraph, cache: RouteCache, chunkId: string): ChunkPlan | undefined {
  let plan = cache.plans.get(chunkId);
  const node = cache.nodes.get(chunkId);
  if (!plan && node) { plan = planChunk(graph, node); cache.plans.set(chunkId, plan); }
  return plan;
}

function regionFor(graph: WorldGraph, cache: RouteCache, chunkId: string, point: GridPoint): Region {
  const plan = chunkPlan(graph, cache, chunkId);
  return { chunkId, pocket: insidePocketMask(point, plan?.pocket ?? null) };
}

function transitions(graph: WorldGraph, cache: RouteCache, region: Region): Transition[] {
  const plan = chunkPlan(graph, cache, region.chunkId);
  if (!plan) return [];
  const result: Transition[] = [];
  for (const exit of plan.exits) {
    if (insidePocketMask(exit.position, plan.pocket) !== region.pocket) continue;
    const peer = chunkPlan(graph, cache, exit.targetNodeId)?.exits.find(gate => gate.id === exit.returnGateId);
    if (!peer || peer.returnGateId !== exit.id || peer.targetNodeId !== region.chunkId) continue;
    result.push({ kind: 'gate', id: exit.id, target: regionFor(graph, cache, exit.targetNodeId, peer.position) });
  }
  for (const poi of plan.pois) {
    if (poi.kind !== 'portal' || !poi.destination || insidePocketMask(poi.position, plan.pocket) !== region.pocket) continue;
    const peer = chunkPlan(graph, cache, poi.destination.chunkId)?.pois.find(candidate => candidate.id === poi.destination!.poiId);
    if (!peer || peer.destination?.chunkId !== region.chunkId || peer.destination.poiId !== poi.id) continue;
    result.push({ kind: 'poi', id: poi.id, target: regionFor(graph, cache, poi.destination.chunkId, peer.position) });
  }
  return result;
}

/** Search transit components: a detached entrance is not a route through its chunk. */
function nextTransition(graph: WorldGraph, cache: RouteCache, origin: Region, target: Region, blocked: Set<string>): Transition | undefined {
  const sourceKey = key(origin), targetKey = key(target);
  if (sourceKey === targetKey) return;
  let routes = cache.routes.get(targetKey);
  if (!routes) {
    // A moving leader need not retain an unbounded collection of old destinations.
    if (cache.routes.size >= 8) cache.routes.delete(cache.routes.keys().next().value!);
    routes = new Map(); cache.routes.set(targetKey, routes);
  }
  const cached = routes.get(sourceKey);
  if (routes.has(sourceKey) && (!cached || !blocked.has(cached.id))) return cached ?? undefined;
  const previous = new Map<string, { from: string; transition: Transition }>();
  const seen = new Set([sourceKey]);
  const queue = [origin];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor], currentKey = key(current);
    for (const transition of transitions(graph, cache, current)) {
      if (currentKey === sourceKey && blocked.has(transition.id)) continue;
      const nextKey = key(transition.target);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey); previous.set(nextKey, { from: currentKey, transition });
      if (nextKey === targetKey) {
        for (let step = targetKey; step !== sourceKey;) {
          const edge = previous.get(step)!;
          routes.set(edge.from, edge.transition); step = edge.from;
        }
        return routes.get(sourceKey) ?? undefined;
      }
      queue.push(transition.target);
    }
  }
  routes.set(sourceKey, null);
  return;
}

function movePlan(actor: CoopActor, position: GridPoint, path: GridPoint[]): CoopFollowPlan {
  const keepProgress = path[0] && actor.path[0] && samePoint(path[0], actor.path[0]);
  return { type: 'move', chunkId: actor.chunkId, position: { ...position }, fromElapsedMs: keepProgress ? actor.movement?.elapsedMs ?? 0 : 0 };
}

function approach(actor: CoopActor, chunk: WorldChunk, position: GridPoint, poiId?: string): CoopFollowPlan {
  if (samePoint(actor.position, position)) {
    if (actor.path.length) return movePlan(actor, position, []);
    return poiId ? { type: 'interact', chunkId: chunk.id, poiId, position: { ...position } } : { type: 'wait', reason: 'moving' };
  }
  if (actor.path.length && samePoint(actor.path[actor.path.length - 1], position)) return { type: 'wait', reason: 'moving' };
  const path = findPath(chunk, actor.position, position, actor);
  return path.length ? movePlan(actor, position, path) : { type: 'wait', reason: 'unreachable' };
}

function nearbyPlan(state: CoopState, actor: CoopActor, moving: boolean, chunk: WorldChunk, destination: GridPoint): CoopFollowPlan {
  // A leader's gate route is itself a transition, so the follower can cross it too.
  if (moving && chunk.exits.some(exit => samePoint(exit.position, destination))) return approach(actor, chunk, destination);
  const gates = new Set(chunk.exits.map(exit => tileIndex(exit.position, chunk.size)));
  const occupied = new Set(state.actors.filter(hero => hero.id !== actor.id && hero.chunkId === chunk.id)
    .map(hero => tileIndex(hero.position, chunk.size)));
  const seen = new Set([tileIndex(destination, chunk.size)]);
  const queue = [{ point: destination, steps: 0 }];
  const candidates: GridPoint[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current.steps === 2) continue;
    for (const point of neighbors(current.point, chunk.size)) {
      const index = tileIndex(point, chunk.size);
      if (seen.has(index) || gates.has(index) || !isWalkable(chunk, point)) continue;
      seen.add(index); queue.push({ point, steps: current.steps + 1 });
      if (!occupied.has(index)) candidates.push(point);
    }
  }
  const nearby = candidates.some(point => samePoint(point, actor.position));
  const endpoint = actor.path[actor.path.length - 1];
  if (nearby && !moving) return actor.path.length ? movePlan(actor, actor.position, []) : { type: 'wait', reason: 'nearby' };
  if (endpoint && candidates.some(point => samePoint(point, endpoint))) return { type: 'wait', reason: 'moving' };
  if (nearby) return actor.path.length ? movePlan(actor, actor.position, []) : { type: 'wait', reason: 'nearby' };
  // Prefer the inner ring, then the shortest reachable approach within that ring.
  for (const ring of [1, 2]) {
    let selected: { point: GridPoint; path: GridPoint[] } | undefined;
    for (const point of candidates.filter(point => Math.abs(point.x - destination.x) + Math.abs(point.y - destination.y) === ring)) {
      const path = findPath(chunk, actor.position, point, actor);
      if (path.length && (!selected || path.length < selected.path.length)) selected = { point, path };
    }
    if (selected) return movePlan(actor, selected.point, selected.path);
  }
  return { type: 'wait', reason: 'unreachable' };
}

/** Plan ordinary movement/transport inputs without changing shared simulation state. */
export function planCoopFollow(state: CoopState, followerId: string, targetId: string): CoopFollowPlan {
  const actor = state.actors.find(hero => hero.id === followerId);
  const target = state.actors.find(hero => hero.id === targetId);
  if (!actor || !target || actor.id === target.id || state.completed || state.failed || getCoopBattle(state, actor.id)
    || actor.body && (!isBodyAlive(actor.body) || bodyMovementMultiplier(actor.body) <= 0)) return { type: 'wait', reason: 'unavailable' };
  const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
  const moving = target.path.length > 0 && (!target.body || isBodyAlive(target.body)) && !getCoopBattle(state, target.id);
  // Short lookahead follows a moving friend without racing to their distant goal.
  const destination = moving ? target.path[Math.min(3, target.path.length - 1)] : target.position;
  if (actor.chunkId === target.chunkId) {
    const local = nearbyPlan(state, actor, moving, chunk, destination);
    if (local.type !== 'wait' || local.reason !== 'unreachable' || chunk.layer === 'basement') return local;
  }
  if (chunk.layer === 'basement') {
    const stairs = chunk.pois.find(poi => poi.kind === 'stairs-up' && poi.destination);
    return stairs ? approach(actor, chunk, stairs.position, stairs.id) : { type: 'wait', reason: 'unreachable' };
  }
  const targetBasement = parseBasementChunkId(target.chunkId);
  const graph = coopGraph(state.seed, state.worldVersion ?? 2);
  const cache = routeCache(graph);
  const origin = regionFor(graph, cache, actor.chunkId, actor.position);
  const goal = targetBasement ? { chunkId: targetBasement.surfaceNodeId, pocket: false }
    : regionFor(graph, cache, target.chunkId, destination);
  if (targetBasement && key(origin) === key(goal)) {
    const stairs = chunk.pois.find(poi => poi.kind === 'stairs-down' && poi.destination?.chunkId === target.chunkId);
    return stairs ? approach(actor, chunk, stairs.position, stairs.id) : { type: 'wait', reason: 'unreachable' };
  }
  const blocked = new Set<string>();
  // Validate the immediate step with actual pathfinding before sending a command.
  for (let attempt = 0; attempt < chunk.exits.length + chunk.pois.length; attempt++) {
    const next = nextTransition(graph, cache, origin, goal, blocked);
    if (!next) break;
    const point = next.kind === 'gate' ? chunk.exits.find(exit => exit.id === next.id) : chunk.pois.find(poi => poi.id === next.id);
    const plan = point ? approach(actor, chunk, point.position, next.kind === 'poi' ? next.id : undefined) : undefined;
    if (plan && (plan.type !== 'wait' || plan.reason !== 'unreachable')) return plan;
    blocked.add(next.id);
  }
  return { type: 'wait', reason: 'unreachable' };
}
