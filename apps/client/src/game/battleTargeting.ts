export interface BattleTargetPoint { id: string; x: number; y: number }

/** Expanded ellipses use rendered anchors, so aim and art share responsive geometry. */
export function resolveBattleTarget(root: HTMLElement, x: number, y: number, allowedIds: readonly string[],
  previousId?: string, touch = false): BattleTargetPoint | undefined {
  const allowed = new Set(allowedIds);
  const margin = touch ? 56 : 38;
  const candidates: Array<BattleTargetPoint & { distance: number; direct: boolean }> = [];
  for (const target of root.querySelectorAll<HTMLElement>('[data-battle-target]')) {
    const id = target.dataset.battleTarget;
    if (!id || !allowed.has(id)) continue;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height * .48;
    const distance = Math.hypot((x - centerX) / (rect.width / 2 + margin), (y - centerY) / (rect.height / 2 + margin));
    if (distance > (id === previousId ? 1.25 : 1)) continue;
    candidates.push({ id, x: centerX, y: centerY, distance,
      direct: x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom });
  }
  candidates.sort((a, b) => Number(b.direct) - Number(a.direct) || a.distance - b.distance || a.id.localeCompare(b.id));
  const nearest = candidates[0];
  const previous = candidates.find(candidate => candidate.id === previousId);
  // A little hysteresis avoids flickering between neighbours without trapping the pointer.
  const chosen = previous && nearest && !nearest.direct && previous.distance < nearest.distance + .18 ? previous : nearest;
  return chosen ? { id: chosen.id, x: chosen.x, y: chosen.y } : undefined;
}

export function hitTestBattleTarget(root: HTMLElement, x: number, y: number, allowedIds: readonly string[]): string | undefined {
  return resolveBattleTarget(root, x, y, allowedIds)?.id;
}
