import type { ChunkExit, Direction } from '@shards/shared';
import { tileToScreen, type WorldProjection } from './projection';

export interface ExitIndicator {
  id: string;
  x: number;
  y: number;
  angle: number;
  offscreen: boolean;
  edge?: Direction;
}

const angles: Record<Direction, number> = { east: 0, south: 90, west: 180, north: -90 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Project every gate, then separate nearby edge guides without merging distinct entrances. */
export function computeExitIndicators(exits: readonly ChunkExit[], view: WorldProjection): ExitIndicator[] {
  if (view.width <= 0 || view.height <= 0 || view.zoom <= 0) return [];
  const padding = Math.min(20, view.width / 4, view.height / 4);
  const radius = Math.min(14, padding);
  const center = { x: view.width / 2, y: view.height / 2 };
  const targets = exits.map(exit => tileToScreen(exit.position, view));
  const markers: ExitIndicator[] = exits.map((exit, index) => {
    const point = targets[index];
    const offscreen = point.x < radius || point.x > view.width - radius || point.y < radius || point.y > view.height - radius;
    if (!offscreen) return { id: exit.id, ...point, angle: angles[exit.direction], offscreen };
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const tx = dx === 0 ? Infinity : (center.x - padding) / Math.abs(dx);
    const ty = dy === 0 ? Infinity : (center.y - padding) / Math.abs(dy);
    const factor = Math.min(tx, ty);
    const edge: Direction = tx < ty ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south');
    return { id: exit.id, x: center.x + dx * factor, y: center.y + dy * factor, angle: 0, offscreen, edge };
  });

  for (const edge of ['north', 'east', 'south', 'west'] as const) {
    const axis = edge === 'north' || edge === 'south' ? 'x' : 'y';
    const length = axis === 'x' ? view.width : view.height;
    // Leave room at corners for arrows attached to the neighboring screen edge.
    const corner = Math.min(24, (length - padding * 2) / 4);
    const start = padding + corner;
    const end = length - padding - corner;
    const group = markers.filter(marker => marker.edge === edge).sort((a, b) => a[axis] - b[axis] || a.id.localeCompare(b.id));
    const gap = group.length > 1 ? Math.min(34, (end - start) / (group.length - 1)) : 0;
    group.forEach((marker, index) => { marker[axis] = Math.max(clamp(marker[axis], start, end), index ? group[index - 1][axis] + gap : start); });
    for (let index = group.length - 1; index >= 0; index--) group[index][axis] = Math.min(group[index][axis], index === group.length - 1 ? end : group[index + 1][axis] - gap);
  }

  markers.forEach((marker, index) => {
    if (marker.offscreen) marker.angle = Math.atan2(targets[index].y - marker.y, targets[index].x - marker.x) * 180 / Math.PI;
  });
  return markers;
}
