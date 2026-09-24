import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { InventoryTarget } from '@shards/shared';

interface InventoryDragOptions {
  root: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  onDrop: (rewardId: string, target: InventoryTarget) => void;
  onCancel?: () => void;
}

export interface InventoryDrag {
  rewardId: string;
  x: number;
  y: number;
  target: InventoryTarget | null;
}

interface DragSession {
  rewardId: string;
  pointerId: number;
  element: HTMLElement;
  root: HTMLDivElement;
  threshold: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dragging: boolean;
}

interface ClickBlock {
  pointerId: number;
  element: HTMLElement;
  x: number;
  y: number;
  expires: number;
}

const targets = new Set<string>(['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2',
  'rightHand', 'leftHand', 'skill0', 'skill1'] satisfies InventoryTarget[]);
const inside = (rect: DOMRect, x: number, y: number) => rect.width > 0 && rect.height > 0
  && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

function dropAt(root: HTMLElement, x: number, y: number) {
  if (!root.isConnected || !inside(root.getBoundingClientRect(), x, y)) return null;
  const element = root.ownerDocument.elementFromPoint(x, y)?.closest<HTMLElement>('[data-inventory-drop-target]');
  const target = element?.dataset.inventoryDropTarget;
  if (!element || !root.contains(element) || !target || !targets.has(target)
    || !inside(element.getBoundingClientRect(), x, y) || getComputedStyle(element).visibility !== 'visible') return null;
  return { target: target as InventoryTarget, allowed: element.dataset.dropAllowed === 'true' };
}

/** Scroll only the nearest overflow region inside the inventory, never the page. */
function scrollAt(root: HTMLElement, x: number, y: number, elapsed: number) {
  let element = root.ownerDocument.elementFromPoint(x, y);
  if (!element || !root.contains(element)) return;
  while (element && root.contains(element)) {
    if (element instanceof HTMLElement && element.scrollHeight > element.clientHeight
      && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)) {
      const rect = element.getBoundingClientRect();
      if (!inside(rect, x, y)) return;
      const edge = Math.min(36, rect.height / 4);
      const velocity = y < rect.top + edge ? -(1 - (y - rect.top) / edge)
        : y > rect.bottom - edge ? 1 - (rect.bottom - y) / edge : 0;
      element.scrollTop += velocity * elapsed * .45;
      return;
    }
    if (element === root) return;
    element = element.parentElement;
  }
}

/** Drag intent is separate from a tap so bag selection and scrolling remain native. */
export function useInventoryDrag(options: InventoryDragOptions) {
  const latest = useRef(options);
  latest.current = options;
  const session = useRef<DragSession | null>(null);
  const blockedClick = useRef<ClickBlock | null>(null);
  // An Escape/blur cancellation can happen while the pointer is still held down.
  const cancelledPointer = useRef<DragSession | null>(null);
  const clickTimer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const previousFrame = useRef<number | null>(null);
  const [drag, setDrag] = useState<InventoryDrag | null>(null);

  const clearClickBlock = useCallback(() => {
    blockedClick.current = null;
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    clickTimer.current = null;
  }, []);

  const blockClick = useCallback((current: DragSession) => {
    clearClickBlock();
    blockedClick.current = { pointerId: current.pointerId, element: current.element,
      x: current.x, y: current.y, expires: performance.now() + 600 };
    clickTimer.current = window.setTimeout(clearClickBlock, 600);
  }, [clearClickBlock]);

  const release = useCallback(() => {
    const current = session.current;
    session.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    previousFrame.current = null;
    if (current) {
      try {
        if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
      } catch { /* The element or pointer may have been removed by a render. */ }
    }
    return current;
  }, []);

  const cancel = useCallback(() => {
    const current = release();
    if (!current) return;
    setDrag(null);
    if (current.dragging) {
      cancelledPointer.current = current;
      blockClick(current);
      latest.current.onCancel?.();
    }
  }, [blockClick, release]);

  const validSession = useCallback((current: DragSession) => !latest.current.disabled
    && latest.current.root.current === current.root && current.root.isConnected
    && current.root.contains(current.element), []);

  const animate = useCallback(function nextFrame(time: number) {
    frame.current = null;
    const current = session.current;
    if (!current?.dragging) return;
    if (!validSession(current)) { cancel(); return; }
    const elapsed = previousFrame.current === null ? 0 : Math.min(32, time - previousFrame.current);
    previousFrame.current = time;
    scrollAt(current.root, current.x, current.y, elapsed);
    const next = { rewardId: current.rewardId, x: current.x, y: current.y,
      target: dropAt(current.root, current.x, current.y)?.target ?? null };
    setDrag(previous => previous?.rewardId === next.rewardId && previous.x === next.x && previous.y === next.y
      && previous.target === next.target ? previous : next);
    frame.current = requestAnimationFrame(nextFrame);
  }, [cancel, validSession]);

  const consumeClick = useCallback((event: MouseEvent) => {
    const block = blockedClick.current;
    // Keyboard and assistive activation have detail=0 and must remain available.
    if (!block || event.detail === 0 || performance.now() > block.expires) return false;
    const pointerId = (event as PointerEvent).pointerId;
    const samePointer = typeof pointerId === 'number' && pointerId >= 0 ? pointerId === block.pointerId
      : (event.target instanceof Node && block.element.contains(event.target))
        || Math.hypot(event.clientX - block.x, event.clientY - block.y) <= 12;
    if (!samePointer) return false;
    clearClickBlock();
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }, [clearClickBlock]);

  const suppressClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!consumeClick(event.nativeEvent)) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, [consumeClick]);

  const start = useCallback((event: ReactPointerEvent<HTMLElement>, rewardId: string) => {
    const root = latest.current.root.current;
    if (latest.current.disabled || session.current || !event.isPrimary || event.button !== 0
      || !root?.contains(event.currentTarget)) return;
    if (event.pointerType === 'touch') {
      const handle = event.target instanceof Element ? event.target.closest('[data-inventory-drag-handle]') : null;
      if (!handle || !event.currentTarget.contains(handle)) return;
    }
    clearClickBlock();
    cancelledPointer.current = null;
    session.current = { rewardId, pointerId: event.pointerId, element: event.currentTarget, root,
      threshold: event.pointerType === 'touch' ? 8 : 6, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, dragging: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { /* Window capture listeners also cover browsers without pointer capture. */ }
  }, [clearClickBlock]);

  useLayoutEffect(() => { if (options.disabled) cancel(); }, [options.disabled, cancel]);

  useEffect(() => {
    let swallowingEscape = false;
    const pointerDown = (event: PointerEvent) => {
      if (event.isPrimary && event.button === 0 && !session.current) {
        clearClickBlock();
        cancelledPointer.current = null;
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const current = session.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (!validSession(current)) { cancel(); return; }
      current.x = event.clientX; current.y = event.clientY;
      if (!current.dragging && Math.hypot(current.x - current.startX, current.y - current.startY) < current.threshold) return;
      if (!current.dragging) {
        current.dragging = true;
        // Mount drag-only targets immediately; RAF then refreshes their hit area.
        setDrag({ rewardId: current.rewardId, x: current.x, y: current.y,
          target: dropAt(current.root, current.x, current.y)?.target ?? null });
      }
      event.preventDefault();
      if (frame.current === null) frame.current = requestAnimationFrame(animate);
    };
    const pointerUp = (event: PointerEvent) => {
      const cancelled = cancelledPointer.current;
      if (cancelled?.pointerId === event.pointerId) {
        cancelled.x = event.clientX; cancelled.y = event.clientY;
        blockClick(cancelled);
        cancelledPointer.current = null;
      }
      const current = session.current;
      if (!current || event.pointerId !== current.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      // Even a release before the next animation frame must never become a tap.
      current.dragging ||= Math.hypot(current.x - current.startX, current.y - current.startY) >= current.threshold;
      const drop = current.dragging && validSession(current) ? dropAt(current.root, current.x, current.y) : null;
      release();
      setDrag(null);
      if (!current.dragging) return;
      event.preventDefault();
      blockClick(current);
      if (drop?.allowed) latest.current.onDrop(current.rewardId, drop.target);
      else latest.current.onCancel?.();
    };
    const pointerCancel = (event: PointerEvent) => {
      if (session.current?.pointerId === event.pointerId) cancel();
      if (cancelledPointer.current?.pointerId === event.pointerId) cancelledPointer.current = null;
    };
    const lostCapture = (event: PointerEvent) => {
      if (session.current?.pointerId === event.pointerId) cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (!session.current && !swallowingEscape)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      swallowingEscape = true;
      const current = session.current;
      if (current && !current.dragging) {
        cancelledPointer.current = current;
        blockClick(current);
      }
      cancel();
    };
    const keyUp = (event: KeyboardEvent) => { if (event.key === 'Escape') swallowingEscape = false; };
    const blur = () => { swallowingEscape = false; cancel(); };
    const visibility = () => { if (document.hidden) cancel(); };
    const nativeDrag = (event: DragEvent) => { if (session.current) event.preventDefault(); };
    window.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('pointermove', pointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', pointerUp, true);
    window.addEventListener('pointercancel', pointerCancel, true);
    window.addEventListener('lostpointercapture', lostCapture, true);
    window.addEventListener('keydown', escape, true);
    window.addEventListener('keyup', keyUp, true);
    window.addEventListener('click', consumeClick, true);
    window.addEventListener('dragstart', nativeDrag, true);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      release();
      clearClickBlock();
      cancelledPointer.current = null;
      window.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('pointermove', pointerMove, true);
      window.removeEventListener('pointerup', pointerUp, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('lostpointercapture', lostCapture, true);
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('keyup', keyUp, true);
      window.removeEventListener('click', consumeClick, true);
      window.removeEventListener('dragstart', nativeDrag, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [animate, blockClick, cancel, clearClickBlock, consumeClick, release, validSession]);

  return { drag, start, cancel, suppressClick };
}
