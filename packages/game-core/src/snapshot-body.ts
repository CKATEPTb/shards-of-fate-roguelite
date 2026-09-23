import { BODY_PARTS, LIMB_PARTS, type HeroBody } from '@shards/shared';
import { bodyPartLossThreshold, restoreHeroBody } from './anatomy';
import { fail, integer, record, same } from './snapshot-values';

/** Exact pre-negative-resource body shape; do not infer it from a current save's wounds. */
export function readLegacyHeroBody(value: unknown, expected?: HeroBody): HeroBody {
  const body = record(value, 'body', BODY_PARTS);
  return Object.fromEntries(BODY_PARTS.map(part => {
    const entry = record(body[part], `body.${part}`, ['current', 'max']);
    const max = integer(entry.max, `body.${part}.max`, 1, 1_000_000);
    if (expected) same(max, expected[part].max, `body.${part}.max`);
    return [part, { max, current: integer(entry.current, `body.${part}.current`, 0, max) }];
  })) as HeroBody;
}

export function legacyBodyHealth(body: HeroBody): number {
  return body.head.current > 0 && body.torso.current > 0 && LIMB_PARTS.some(part => body[part].current > 0)
    ? BODY_PARTS.reduce((sum, part) => sum + body[part].current, 0) : 0;
}

/** Metadata selects the old format; a new-format zero remains a recoverable wound. */
export function restoreSavedHeroBody(value: unknown, expected?: HeroBody, allowLegacy = false): HeroBody {
  const body = record(value, 'body', BODY_PARTS);
  const marked = BODY_PARTS.filter(part => Object.hasOwn(record(body[part], `body.${part}`, ['current', 'max', 'lost']), 'lost'));
  if (marked.length === BODY_PARTS.length) return restoreHeroBody(value, expected);
  if (marked.length || !allowLegacy) fail('body', 'missing or mixed body format markers');
  const previous = readLegacyHeroBody(value, expected);
  const next = restoreHeroBody(previous, expected);
  if (legacyBodyHealth(previous) === 0 && !next.head.lost && !next.torso.lost) {
    // Losing every limb was fatal in the old rules. Preserve that death using
    // the current fatal torso state, rather than silently reviving the hero.
    next.torso = { ...next.torso, current: bodyPartLossThreshold(next.torso.max), lost: true };
  }
  return next;
}
