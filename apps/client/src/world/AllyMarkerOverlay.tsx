import { memo, useMemo, useRef, type PointerEvent, type RefObject } from 'react';
import type { ChunkExit, CoopActor, GameContent } from '@shards/shared';
import { findDefinition } from '../catalog';
import { resolveHeroVisualLoadout } from '../art/heroLoadout';
import { unitFramePixels } from '../art/unitFrames';
import { computeAllyIndicators, type AllyIndicatorTarget } from './allyIndicators';
import type { WorldProjection } from './projection';
import './allyIndicators.css';

const frames = new WeakMap<HTMLDivElement, string>();

/** The scene's existing projection callback moves DOM guides without React frames. */
export function updateAllyIndicators(surface: HTMLDivElement | null, targets: readonly AllyIndicatorTarget[], exits: readonly ChunkExit[], view: WorldProjection) {
  if (!surface) return;
  const signature = [view.scrollX, view.scrollY, view.zoom, view.width, view.height, surface.style.display,
    targets.map(target => `${target.id},${target.position.x},${target.position.y},${target.forceEdge}`).join('|'),
    exits.map(exit => `${exit.id},${exit.position.x},${exit.position.y},${exit.direction}`).join('|')].join(':');
  if (frames.get(surface) === signature) return;
  const markers = new Map(computeAllyIndicators(targets, exits, view).map(marker => [marker.id, marker]));
  for (const node of surface.querySelectorAll<HTMLButtonElement>('[data-ally-id]')) {
    const marker = markers.get(node.dataset.allyId!);
    node.style.visibility = marker ? 'visible' : 'hidden';
    node.tabIndex = marker && !node.disabled ? 0 : -1;
    if (!marker) continue;
    node.style.transform = `translate(${marker.x}px, ${marker.y}px) translate(-50%, -50%)`;
    node.style.setProperty('--ally-direction', `${marker.angle}deg`);
    node.dataset.offscreen = String(marker.offscreen);
    node.dataset.edge = marker.edge;
    node.dataset.screenX = String(marker.x);
    node.dataset.screenY = String(marker.y);
  }
  frames.set(surface, signature);
}

const AllyPortrait = memo(function AllyPortrait({ actorId, content }: { actorId: string; content: GameContent }) {
  const definition = findDefinition(actorId, content);
  const pixels = useMemo(() => unitFramePixels(definition.sprite || definition.id, definition.role, false, 'south', 'idle', 0,
    undefined, resolveHeroVisualLoadout(definition)), [definition]);
  return <svg className="ally-indicator-portrait" viewBox="18 3 28 28" shapeRendering="crispEdges" aria-hidden="true">
    {pixels.map(pixel => <rect key={`${pixel.x}:${pixel.y}`} x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.color} />)}
  </svg>;
});

interface Press { pointerId: number; x: number; y: number; moved: boolean }

function AllyIndicatorButton({ ally, following, disabled, content, onFollow }: { ally: CoopActor; following: boolean; disabled: boolean; content: GameContent; onFollow?: (actorId: string) => void }) {
  const press = useRef<Press | null>(null);
  const name = findDefinition(ally.id, content).name;
  const label = following ? `Следовать за ${name}: активно` : `Следовать за ${name}`;
  const moved = (event: PointerEvent<HTMLButtonElement>, start: Press) => Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8;
  return <button type="button" className="ally-indicator" data-ally-id={ally.id} data-hud-interactive data-following={following}
    disabled={disabled} tabIndex={-1} aria-label={label} aria-pressed={following} title={label}
    onPointerDown={event => {
      event.stopPropagation();
      if (disabled || event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const start = press.current;
      if (start?.pointerId === event.pointerId && moved(event, start)) start.moved = true;
    }}
    onPointerUp={event => {
      event.stopPropagation();
      const start = press.current;
      press.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!disabled && start?.pointerId === event.pointerId && !start.moved && !moved(event, start)) onFollow?.(ally.id);
    }}
    onPointerCancel={() => { press.current = null; }}
    onLostPointerCapture={() => { press.current = null; }}
    onClick={event => {
      event.preventDefault();
      event.stopPropagation();
      // Native keyboard and assistive clicks have no preceding pointer sequence.
      if (!disabled && event.detail === 0) onFollow?.(ally.id);
    }}
    onKeyDown={event => { event.stopPropagation(); }}
    onKeyUp={event => { event.stopPropagation(); }}>
    <span className="ally-indicator-head"><AllyPortrait actorId={ally.id} content={content} />
      <svg className="ally-indicator-direction" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4L12 8L3 12L5 8Z" /></svg>
    </span>
    <span className="ally-indicator-name">{name}</span>
    <span className="ally-indicator-following" aria-hidden="true">{following ? 'Следую' : '\u00a0'}</span>
  </button>;
}

export function AllyIndicators({ surfaceRef, allies, followingActorId, hidden, onFollow, content }: {
  surfaceRef: RefObject<HTMLDivElement | null>;
  allies: readonly CoopActor[];
  followingActorId?: string | null;
  hidden: boolean;
  onFollow?: (actorId: string) => void;
  content: GameContent;
}) {
  return <div ref={surfaceRef} className="ally-indicators" data-testid="ally-indicators" role="group" aria-label="Союзники и следование"
    style={{ display: hidden || !onFollow ? 'none' : undefined }}>
    {allies.map(ally => <AllyIndicatorButton key={ally.id} ally={ally} following={ally.id === followingActorId} disabled={hidden || !onFollow} content={content} onFollow={onFollow} />)}
  </div>;
}
