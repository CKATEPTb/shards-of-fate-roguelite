import { BODY_PARTS, type HeroBody } from '@shards/shared';
import { integer, record, same } from '../snapshot-values';

export function restoreHeroBody(value: unknown, expected?: HeroBody): HeroBody {
  const body = record(value, 'body', BODY_PARTS);
  return Object.fromEntries(BODY_PARTS.map(part => {
    const entry = record(body[part], `body.${part}`, ['current', 'max']);
    const max = integer(entry.max, `body.${part}.max`, 1, 1_000_000);
    if (expected) same(max, expected[part].max, `body.${part}.max`);
    return [part, { max, current: integer(entry.current, `body.${part}.current`, 0, max) }];
  })) as HeroBody;
}
