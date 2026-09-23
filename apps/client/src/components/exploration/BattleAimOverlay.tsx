import { useId, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { BattleCardDrag } from './useBattleCardDrag';
import './battleAim.css';

/** A view of the gesture's coordinates; target selection stays in the gesture controller. */
export function BattleAimOverlay({ drag, tone, targetName, reducedMotion = false, onCancel }: {
  drag: BattleCardDrag;
  tone: 'attack' | 'support' | 'escape';
  targetName?: string;
  reducedMotion?: boolean;
  onCancel: () => void;
}) {
  const gradientId = `battle-aim-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { anchorX, anchorY, endX, endY } = drag;
  const dx = endX - anchorX, dy = endY - anchorY;
  const distance = Math.hypot(dx, dy);
  const lift = Math.max(42, Math.min(150, distance * .33));
  const control1 = { x: anchorX + dx * .12, y: anchorY - lift };
  const control2 = { x: endX - dx * .18, y: endY - dy * .22 };
  const path = `M ${anchorX} ${anchorY} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${endX} ${endY}`;
  const angle = distance > 2 ? Math.atan2(endY - control2.y, endX - control2.x) * 180 / Math.PI : -90;
  const ready = !drag.cancelling && (drag.automatic || Boolean(drag.targetId));
  const label = targetName ?? (drag.automatic ? 'Применить умение' : 'Выберите цель');
  const captionStyle = {
    left: `clamp(var(--aim-label-edge, 136px), ${endX}px, calc(100vw - var(--aim-label-edge, 136px)))`,
    top: endY > 94 ? endY - 25 : endY + 76,
  } as CSSProperties;
  return createPortal(<div className="battle-aim-overlay" data-tone={tone} data-ready={ready}
    data-cancelling={drag.cancelling} data-reduced={reducedMotion}>
    <svg className="battle-aim-svg" width="100%" height="100%" aria-hidden="true">
      <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={anchorX} y1={anchorY} x2={endX} y2={endY}>
        <stop offset="0" stopColor="var(--aim-origin)" stopOpacity=".55" />
        <stop offset=".45" stopColor="var(--aim-color)" stopOpacity=".92" />
        <stop offset="1" stopColor="var(--aim-tip)" />
      </linearGradient></defs>
      <g className="battle-aim-curve">
        <path className="battle-aim-aura" d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth="11" strokeLinecap="round" />
        <path d={path} fill="none" stroke="#0a1517" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" />
        <path d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.6" strokeLinecap="round" />
        <path className="battle-aim-flow" d={path} fill="none" stroke="var(--aim-tip)" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 16" />
        <g transform={`translate(${anchorX} ${anchorY})`}>
          <circle r="7" fill="#15251a" fillOpacity=".7" stroke="var(--aim-origin)" strokeOpacity=".8" />
          <path d="M0 -4 4 0 0 4 -4 0Z" fill="var(--aim-tip)" />
        </g>
        <g className="battle-aim-target" transform={`translate(${endX} ${endY})`}>
          <circle className="battle-aim-target-halo" r="19" fill="none" stroke="var(--aim-color)" strokeWidth="5" />
          <circle r="14" fill="#101b19" fillOpacity=".12" stroke="var(--aim-color)" strokeOpacity=".7" strokeWidth="1" />
          <path d="M0 -21V-17 M21 0H17 M0 21V17 M-21 0H-17" fill="none" stroke="var(--aim-tip)" strokeOpacity=".9" strokeWidth="1.4" />
          <g transform={`rotate(${angle})`}>
            <path d="M2 0 -13 -7 -9 0 -13 7Z" fill="var(--aim-tip)" stroke="#15221e" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M-1 0 -10 -4 -7 0Z" fill="#fff6d4" fillOpacity=".65" />
          </g>
        </g>
      </g>
    </svg>
    {!drag.cancelling && <div className="battle-aim-caption" style={captionStyle} aria-hidden="true">
      <span>{label}</span><small>{ready ? 'Отпустите для применения' : 'Наведите на участника'}</small>
    </div>}
    <button type="button" className="battle-aim-cancel" data-battle-cancel data-over={drag.cancelling}
      aria-label="Отменить выбор карты" onClick={onCancel} onPointerDown={event => event.stopPropagation()}>
      <span className="battle-aim-cancel-rune" aria-hidden="true"><svg viewBox="0 0 48 48">
        <path d="M24 3 42 13 42 35 24 45 6 35 6 13Z" fill="none" stroke="currentColor" strokeWidth="1" opacity=".35" />
        <path d="M24 8 37 16 37 32 24 40 11 32 11 16Z" fill="currentColor" opacity=".06" />
        <path d="m17 17 14 14m0-14L17 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 3h4M42 22v4M22 45h4M6 22v4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg></span>
      <strong>Отмена</strong><small>{drag.cancelling ? 'Отпустите карту' : 'Отпустите здесь'}</small>
      <kbd aria-hidden="true">Esc</kbd>
    </button>
  </div>, document.body);
}
