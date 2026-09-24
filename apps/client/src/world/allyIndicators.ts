import type { ChunkExit, CoopActor, Direction, ExplorationState, GridPoint } from '@shards/shared';
import { resolveWorldNode } from '@shards/game-core';
import { computeExitIndicators } from './exitIndicators';
import { tileToScreen, type WorldProjection } from './projection';

export interface AllyIndicatorTarget {
  id: string;
  position: GridPoint;
  /** Allies in other chunks and the followed ally always retain an edge guide. */
  forceEdge: boolean;
}

export interface AllyIndicator {
  id: string;
  x: number;
  y: number;
  angle: number;
  edge: Direction;
  offscreen: boolean;
}

/** Resolve map coordinates only when actors change, never on camera frames. */
export function allyIndicatorTargets(allies: readonly CoopActor[], state: ExplorationState, controlledActorId: string, followingActorId?: string | null): AllyIndicatorTarget[] {
  const currentNode = resolveWorldNode(state.graph, state.currentChunkId);
  return allies.filter(ally => ally.id !== controlledActorId).map(ally => {
    const sameChunk = ally.chunkId === state.currentChunkId;
    if (sameChunk) return { id: ally.id, position: ally.position, forceEdge: ally.id === followingActorId };
    // A basement has no graph node: guide to its actual entrance or to the stairs out.
    const connection = state.chunk.pois.find(poi => poi.destination?.chunkId === ally.chunkId)
      ?? (state.chunk.layer === 'basement' ? state.chunk.pois.find(poi => poi.kind === 'stairs-up') : undefined);
    if (connection) return { id: ally.id, position: connection.position, forceEdge: true };
    const allyNode = resolveWorldNode(state.graph, ally.chunkId);
    const position = currentNode && allyNode ? {
      x: (allyNode.x - currentNode.x) * state.chunk.size + ally.position.x,
      y: (allyNode.y - currentNode.y) * state.chunk.size + ally.position.y,
    } : ally.position;
    return { id: ally.id, position, forceEdge: true };
  });
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const edges: Direction[] = ['north', 'east', 'south', 'west'];
const halfWidth = 38;
const halfHeight = 39;
interface Occupied extends GridPoint { halfWidth: number; halfHeight: number }
const overlaps = (point: GridPoint, occupied: Occupied) => Math.abs(point.x - occupied.x) < halfWidth + occupied.halfWidth
  && Math.abs(point.y - occupied.y) < halfHeight + occupied.halfHeight;

/** Keep portrait hit areas apart and reserve the exact positions of exit arrows. */
export function computeAllyIndicators(targets: readonly AllyIndicatorTarget[], exits: readonly ChunkExit[], view: WorldProjection): AllyIndicator[] {
  if (!targets.length || view.width <= 0 || view.height <= 0 || view.zoom <= 0) return [];
  const paddingX = Math.min(halfWidth, view.width / 2);
  const paddingY = Math.min(halfHeight, view.height / 2);
  const center = { x: view.width / 2, y: view.height / 2 };
  // Coarse-pointer exit targets extend to 27px, including their transparent hit area.
  const occupied: Occupied[] = computeExitIndicators(exits, view).map(marker => ({ ...marker, halfWidth: 29, halfHeight: 29 }));
  const result: AllyIndicator[] = [];
  for (const target of targets) {
    const point = tileToScreen(target.position, view);
    const offscreen = point.x < 20 || point.x > view.width - 20 || point.y < 20 || point.y > view.height - 20;
    if (!offscreen && !target.forceEdge) continue;
    const dx = point.x - center.x;
    // An ally at the exact centre still needs a stable, finite active-follow marker.
    const dy = point.y - center.y || (dx === 0 ? -1 : 0);
    const tx = dx === 0 ? Infinity : (center.x - paddingX) / Math.abs(dx);
    const ty = dy === 0 ? Infinity : (center.y - paddingY) / Math.abs(dy);
    const edge: Direction = tx < ty ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south');
    const factor = Math.min(tx, ty);
    const preferred = { x: center.x + dx * factor, y: center.y + dy * factor };
    let chosen: (GridPoint & { edge: Direction }) | undefined;
    // Try the intended edge first, then adjacent edges if it is full. With a small
    // co-op party this also leaves enough space at corners for neighboring guides.
    const edgeIndex = edges.indexOf(edge);
    const order = [edge, edges[(edgeIndex + 1) % 4], edges[(edgeIndex + 3) % 4], edges[(edgeIndex + 2) % 4]];
    for (const candidateEdge of order) {
      const horizontal = candidateEdge === 'north' || candidateEdge === 'south';
      const start = horizontal ? paddingX : paddingY;
      const end = horizontal ? view.width - paddingX : view.height - paddingY;
      const desired = clamp(horizontal ? preferred.x : preferred.y, start, end);
      const first = horizontal
        ? { x: desired, y: candidateEdge === 'north' ? paddingY : view.height - paddingY, edge: candidateEdge }
        : { x: candidateEdge === 'west' ? paddingX : view.width - paddingX, y: desired, edge: candidateEdge };
      // The preferred point sorts first; avoid building the full search when it fits.
      if (!occupied.some(item => overlaps(first, item))) { chosen = first; break; }
      const candidates = [desired, start, end];
      for (let offset = 8; offset <= end - start + 8; offset += 8) candidates.push(clamp(desired - offset, start, end), clamp(desired + offset, start, end));
      candidates.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired));
      for (const coordinate of candidates) {
        const candidate = horizontal
          ? { x: coordinate, y: candidateEdge === 'north' ? paddingY : view.height - paddingY, edge: candidateEdge }
          : { x: candidateEdge === 'west' ? paddingX : view.width - paddingX, y: coordinate, edge: candidateEdge };
        if (occupied.some(item => overlaps(candidate, item))) continue;
        chosen = candidate;
        break;
      }
      if (chosen) break;
    }
    // Tiny viewports may have no free edge slot. Retain access to every ally.
    chosen ??= { ...preferred, edge };
    occupied.push({ ...chosen, halfWidth, halfHeight });
    result.push({ id: target.id, ...chosen, angle: Math.atan2(point.y - chosen.y, point.x - chosen.x) * 180 / Math.PI, offscreen });
  }
  return result;
}
