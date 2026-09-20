import { useEffect, useState, type RefObject } from 'react';

/** Read-only hit testing: informational HUD elements never become pointer targets. */
export function useInformationalHover(root: RefObject<HTMLElement | null>, disabled = false): string | null {
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    let active: string | null = null;
    let pending = 0;
    let lastPoint: { x: number; y: number } | null = null;
    const change = (next: string | null) => {
      if (next === active) return;
      active = next;
      setHovered(next);
    };
    setHovered(null);
    if (disabled) return;

    const inspect = () => {
      pending = 0;
      if (!root.current || !lastPoint) return;
      let match: string | null = null;
      for (const element of root.current.querySelectorAll<HTMLElement>('[data-hud-hover]')) {
        const bounds = element.getBoundingClientRect();
        if (lastPoint.x >= bounds.left && lastPoint.x <= bounds.right && lastPoint.y >= bounds.top && lastPoint.y <= bounds.bottom) {
          match = element.dataset.hudHover ?? null;
          // Later descendants override their containing panel, preserving row details.
        }
      }
      change(match);
    };
    const clear = () => {
      if (pending) cancelAnimationFrame(pending);
      pending = 0;
      lastPoint = null;
      change(null);
    };
    const move = (event: PointerEvent) => {
      // Interactive equipment can overlap these read-only panels on short screens.
      // Observe the event to clear stale hover, but never inspect through that surface.
      if (event.pointerType === 'touch' || event.target instanceof Element && event.target.closest('[data-hud-interactive]')) { clear(); return; }
      lastPoint = { x: event.clientX, y: event.clientY };
      if (!pending) pending = requestAnimationFrame(inspect);
    };
    const touch = (event: PointerEvent) => { if (event.pointerType === 'touch') clear(); };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) clear(); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('pointerout', leave, { passive: true });
    window.addEventListener('blur', clear);
    window.addEventListener('resize', clear);
    return () => {
      if (pending) cancelAnimationFrame(pending);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear);
    };
  }, [root, disabled]);
  return hovered;
}
