import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { resolveBattleTarget } from '../../game/battleTargeting';
import { playSound } from '../../audio/engine';

interface CardDragOptions {
  root: RefObject<HTMLElement | null>;
  enabled: boolean;
  turnKey: string;
  allowedTargets: (cardId: string) => string[];
  automaticTarget: (cardId: string) => string | undefined;
  onPick: (cardId: string) => void;
  onDrop: (cardId: string, targetId: string) => void;
  onCancel: () => void;
}

interface DragSession {
  cardId: string; pointerId: number; pointerType: string; element: HTMLButtonElement;
  turnKey: string; targetId?: string;
  startX: number; startY: number; moved: boolean;
}

export interface BattleCardDrag {
  cardId: string; x: number; y: number; targetId?: string;
  anchorX: number; anchorY: number; endX: number; endY: number;
  cancelling: boolean; automatic: boolean;
}

const contains = (rect: DOMRect, x: number, y: number) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

/** The card stays in the hand. Pointer capture drives an aiming arrow, never a floating copy. */
export function useBattleCardDrag(options: CardDragOptions) {
  const latest = useRef(options);
  latest.current = options;
  const session = useRef<DragSession | undefined>(undefined);
  const [drag, setDrag] = useState<BattleCardDrag>();

  const release = () => {
    const current = session.current;
    session.current = undefined;
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
    setDrag(undefined);
  };
  const cancel = () => { if (session.current?.moved) playSound('cancel', { volume: .35 }); release(); latest.current.onCancel(); };
  const resolve = (current: DragSession, x: number, y: number): BattleCardDrag => {
    const { root, allowedTargets, automaticTarget } = latest.current;
    const card = current.element.getBoundingClientRect();
    const field = root.current;
    const allowed = allowedTargets(current.cardId);
    const auto = automaticTarget(current.cardId);
    const automatic = auto !== undefined && allowed.includes(auto);
    const zone = document.querySelector<HTMLElement>('[data-battle-cancel]');
    const outside = !field || !contains(field.getBoundingClientRect(), x, y);
    const cancelling = outside || Boolean(zone && contains(zone.getBoundingClientRect(), x, y));
    const target = !cancelling && !automatic && field
      ? resolveBattleTarget(field, x, y, allowed, current.targetId, current.pointerType !== 'mouse') : undefined;
    const targetId = cancelling ? undefined : automatic ? auto : target?.id;
    current.targetId = targetId;
    return { cardId: current.cardId, x, y, anchorX: card.left + card.width / 2, anchorY: card.top + 8,
      endX: target?.x ?? x, endY: target?.y ?? y, targetId, cancelling, automatic };
  };

  useEffect(() => { cancel(); }, [options.turnKey, options.enabled]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      const current = session.current;
      session.current = undefined;
      if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return {
    drag, cancel,
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, cardId: string) => {
      if (!latest.current.enabled || event.button !== 0 || !event.isPrimary || session.current || !latest.current.allowedTargets(cardId).length) return;
      latest.current.onPick(cardId);
      playSound('select', { volume: .4 });
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      session.current = { cardId, pointerId: event.pointerId, pointerType: event.pointerType,
        element: event.currentTarget, turnKey: latest.current.turnKey,
        startX: event.clientX, startY: event.clientY, moved: false };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!latest.current.enabled || current.turnKey !== latest.current.turnKey) { cancel(); return; }
      current.moved ||= Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 7;
      if (!current.moved) return;
      event.preventDefault();
      setDrag(resolve(current, event.clientX, event.clientY));
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!latest.current.enabled || current.turnKey !== latest.current.turnKey) { cancel(); return; }
      const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 7;
      const result = moved ? resolve(current, event.clientX, event.clientY) : undefined;
      release();
      if (moved) {
        if (result?.targetId && !result.cancelling) latest.current.onDrop(current.cardId, result.targetId);
        else { playSound('cancel', { volume: .35 }); latest.current.onCancel(); }
      }
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (session.current?.pointerId === event.pointerId) cancel();
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (session.current?.pointerId === event.pointerId) cancel();
    },
  };
}
