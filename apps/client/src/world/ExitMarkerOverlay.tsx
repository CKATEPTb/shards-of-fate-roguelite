import type { RefObject } from 'react';
import type { ChunkExit, GridPoint } from '@shards/shared';
import { computeExitIndicators } from './exitIndicators';
import type { WorldProjection } from './projection';
import { ExitMarker } from './ExitMarker';
import './exitIndicators.css';

const frames = new WeakMap<SVGSVGElement, string>();

/** Camera frames update a few SVG transforms, without rerendering the game HUD. */
export function updateExitIndicators(surface: SVGSVGElement | null, exits: readonly ChunkExit[], view: WorldProjection) {
  if (!surface) return;
  const signature = `${exits.map(exit => `${exit.id},${exit.position.x},${exit.position.y},${exit.direction}`).join('|')}:${view.scrollX}:${view.scrollY}:${view.zoom}:${view.width}:${view.height}`;
  if (frames.get(surface) === signature) return;
  const nodes = new Map([...surface.querySelectorAll<SVGGElement>('[data-exit-id]')].map(node => [node.dataset.exitId, node]));
  const markers = computeExitIndicators(exits, view);
  if (markers.some(marker => !nodes.has(marker.id))) return;
  surface.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
  for (const marker of markers) {
    const node = nodes.get(marker.id)!;
    node.setAttribute('transform', `translate(${marker.x} ${marker.y}) rotate(${marker.angle})`);
    node.setAttribute('visibility', 'visible');
    node.dataset.offscreen = String(marker.offscreen);
    node.dataset.edge = marker.edge ?? '';
    node.dataset.screenX = String(marker.x);
    node.dataset.screenY = String(marker.y);
  }
  frames.set(surface, signature);
}

export function ExitIndicators({ surfaceRef, exits, hidden, onMove }: { surfaceRef: RefObject<SVGSVGElement | null>; exits: readonly ChunkExit[]; hidden: boolean; onMove: (point: GridPoint) => void }) {
  return <svg ref={surfaceRef} className="exit-indicators" data-testid="exit-indicators" aria-label="Выходы с участка" style={{ display: hidden ? 'none' : undefined }}>
    {exits.map(exit => <ExitMarker key={exit.id} exit={exit} disabled={hidden} onMove={onMove} />)}
  </svg>;
}
