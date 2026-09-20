import { useRef, type PointerEvent } from 'react';
import type { ChunkExit, GridPoint } from '@shards/shared';

interface Press { pointerId: number; x: number; y: number; moved: boolean }

/** An exit intent always targets the gate, never the terrain beneath its screen marker. */
export function ExitMarker({ exit, disabled, onMove }: { exit: ChunkExit; disabled: boolean; onMove: (point: GridPoint) => void }) {
  const press = useRef<Press | null>(null);
  const moved = (event: PointerEvent<SVGGElement>, start: Press) => Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8;

  return <g data-exit-id={exit.id} data-hud-interactive visibility="hidden" role="button"
    tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={`Перейти через выход ${exit.position.x}, ${exit.position.y}`}
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
      if (!disabled && start?.pointerId === event.pointerId && !start.moved && !moved(event, start)) onMove(exit.position);
    }}
    onPointerCancel={() => { press.current = null; }}
    onLostPointerCapture={() => { press.current = null; }}
    onClick={event => {
      event.preventDefault();
      event.stopPropagation();
      // Assistive activation has no pointer sequence; physical taps are handled above.
      if (!disabled && event.detail === 0) onMove(exit.position);
    }}
    onKeyDown={event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !event.repeat) onMove(exit.position);
    }}>
    <circle className="exit-indicator-hit-area" r="17" />
    <circle className="exit-indicator-backdrop" r="13" />
    <path className="exit-indicator-arrow" d="M-8-2.5H0V-7L9 0 0 7V2.5H-8Z" />
  </g>;
}
