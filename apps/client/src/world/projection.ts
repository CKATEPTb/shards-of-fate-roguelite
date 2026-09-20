import type { GridPoint } from '@shards/shared';

export const TILE_SIZE = 32;

export interface WorldProjection {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface WorldFrame extends WorldProjection {
  actorX: number;
  actorY: number;
  /** Actual rendered feet (world pixels) and container depth, including allies. */
  actorFrames: string;
  /** Rendered enemy positions and animation frames, for inspection and diagnostics. */
  mobFrames: string;
  inspectedGroupId: string;
  facing: string;
  animationFrame: string;
  props: number;
  occluded: number;
  revealedRoofs: number;
  exteriorReveals: number;
}

export function tileCenter(point: GridPoint): GridPoint {
  return { x: (point.x + 0.5) * TILE_SIZE, y: (point.y + 0.5) * TILE_SIZE };
}

/** Phaser zooms around the viewport centre rather than the top-left corner. */
export function tileToScreen(point: GridPoint, view: WorldProjection): GridPoint {
  const centre = tileCenter(point);
  return {
    x: (centre.x - view.scrollX - view.width / 2) * view.zoom + view.width / 2,
    y: (centre.y - view.scrollY - view.height / 2) * view.zoom + view.height / 2,
  };
}
