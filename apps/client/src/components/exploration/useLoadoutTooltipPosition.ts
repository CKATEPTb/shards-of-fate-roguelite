import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import type { LoadoutSlot } from './loadoutModel';

const EDGE = 8;
const GAP = 10;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Keep descriptions beside a desktop panel or clear of the selected slot on smaller screens. */
export function useLoadoutTooltipPosition(
  active: LoadoutSlot | undefined,
  panel: RefObject<HTMLDivElement | null>,
  toggle: RefObject<HTMLButtonElement | null>,
  tooltip: RefObject<HTMLDivElement | null>,
): CSSProperties {
  const [position, setPosition] = useState<CSSProperties>({ left: EDGE, top: EDGE, width: 280 });

  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const element = tooltip.current;
      const anchor = panel.current?.querySelector<HTMLElement>(`[data-loadout-slot="${active.id}"]`);
      if (!element || !anchor || !panel.current || !toggle.current) return;
      const grid = panel.current.getBoundingClientRect();
      const button = toggle.current.getBoundingClientRect();
      const slot = anchor.getBoundingClientRect();
      const rightSpace = window.innerWidth - grid.right - GAP - EDGE;
      const beside = rightSpace >= 240;
      const width = Math.min(280, beside ? rightSpace : window.innerWidth - EDGE * 2);
      // Reserve the toggle even when a short viewport requires overlapping the slots.
      const bottom = Math.min(window.innerHeight - EDGE, button.top - EDGE);
      let maxHeight = Math.max(1, bottom - EDGE);
      element.style.width = `${width}px`;
      element.style.maxHeight = `${maxHeight}px`;
      let height = element.getBoundingClientRect().height;
      let preferredTop = slot.top + slot.height / 2 - height / 2;
      if (!beside) {
        if (grid.top - GAP - height >= EDGE) {
          preferredTop = grid.top - GAP - height;
        } else {
          // A narrow viewport can require covering other slots, but never the source:
          // its entire visible area must remain available for hover and a second tap.
          const visibleTop = Math.max(EDGE, grid.top);
          const visibleBottom = Math.max(visibleTop, Math.min(bottom, grid.bottom));
          const sourceTop = clamp(slot.top, visibleTop, visibleBottom);
          const sourceBottom = clamp(slot.bottom, visibleTop, visibleBottom);
          const above = Math.max(0, sourceTop - GAP - EDGE);
          const below = Math.max(0, bottom - sourceBottom - GAP);
          const useAbove = above >= below;
          maxHeight = Math.max(1, useAbove ? above : below);
          element.style.maxHeight = `${maxHeight}px`;
          height = element.getBoundingClientRect().height;
          preferredTop = useAbove ? sourceTop - GAP - height : sourceBottom + GAP;
        }
      }
      const next: CSSProperties = {
        width, maxHeight,
        left: clamp(beside ? grid.right + GAP : grid.left, EDGE, window.innerWidth - width - EDGE),
        top: clamp(preferredTop, EDGE, bottom - height),
      };
      setPosition(previous => previous.width === next.width && previous.maxHeight === next.maxHeight
        && previous.left === next.left && previous.top === next.top ? previous : next);
    };
    place();
    const element = panel.current;
    const observer = new ResizeObserver(place);
    if (element) observer.observe(element);
    if (tooltip.current) observer.observe(tooltip.current);
    if (toggle.current) observer.observe(toggle.current);
    window.addEventListener('resize', place);
    element?.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      element?.removeEventListener('scroll', place);
      observer.disconnect();
    };
  }, [active, panel, toggle, tooltip]);

  return position;
}
