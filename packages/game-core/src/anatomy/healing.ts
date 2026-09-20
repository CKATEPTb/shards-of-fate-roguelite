import { BODY_PARTS, type HeroBody } from '@shards/shared';
import { cloneHeroBody, isBodyAlive } from './body';

/** Allocate one healing budget by maximum part health, redistributing capped shares. */
export function healBody(body: HeroBody, amount: number): { body: HeroBody; healed: number } {
  const updated = cloneHeroBody(body);
  if (!isBodyAlive(body) || !Number.isFinite(amount) || amount <= 0) return { body: updated, healed: 0 };
  let remaining = Math.floor(amount);
  let healed = 0;
  while (remaining > 0) {
    const damaged = BODY_PARTS.filter(part => updated[part].current > 0 && updated[part].current < updated[part].max);
    if (!damaged.length) break;
    const weight = damaged.reduce((sum, part) => sum + updated[part].max, 0);
    const budget = remaining;
    const shares = damaged.map(part => ({ part, quota: budget * updated[part].max / weight }));
    for (const { part, quota } of shares) {
      const applied = Math.min(updated[part].max - updated[part].current, Math.floor(quota));
      updated[part].current += applied;
      remaining -= applied;
      healed += applied;
    }
    shares.sort((a, b) => (b.quota % 1) - (a.quota % 1) || BODY_PARTS.indexOf(a.part) - BODY_PARTS.indexOf(b.part));
    for (const { part } of shares) {
      if (!remaining) break;
      if (updated[part].current === updated[part].max) continue;
      updated[part].current++;
      remaining--;
      healed++;
    }
  }
  return { body: updated, healed };
}

export function restBody(body: HeroBody): HeroBody {
  const updated = cloneHeroBody(body);
  if (isBodyAlive(body)) for (const part of BODY_PARTS) if (updated[part].current > 0) updated[part].current = updated[part].max;
  return updated;
}
