import type { WorldProjection } from './projection';

/**
 * Keep the desktop view close to the hero. Phones need a wider tactical view
 * because their narrow screen otherwise shows only a few tiles; halve the
 * resulting zoom for a two-times wider view while the camera bounds still
 * constrain it to the generated map.
 */
export function worldCameraZoom(width: number, height: number, mapSize: number, mobile = false): number {
  const mapFit = Math.max(width / mapSize, height / mapSize);
  const base = Math.max(1.35, mapFit) * 1.25;
  // Keep the whole viewport inside the chunk even on unusually tall phones.
  return mobile ? Math.max(base * 0.5, mapFit) : base;
}

export function visibleWorldBounds(view: WorldProjection) {
  const width = view.width / view.zoom;
  const height = view.height / view.zoom;
  return { x: view.scrollX + (view.width - width) / 2, y: view.scrollY + (view.height - height) / 2, width, height };
}
