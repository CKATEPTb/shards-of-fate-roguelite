import { BODY_PARTS, type HeroBody } from '@shards/shared';
import { fail, integer, record, same } from '../snapshot-values';
import { bodyPartLossThreshold } from './body';

export function restoreHeroBody(value: unknown, expected?: HeroBody): HeroBody {
  const body = record(value, 'body', BODY_PARTS);
  return Object.fromEntries(BODY_PARTS.map(part => {
    const entry = record(body[part], `body.${part}`, ['current', 'max', 'lost']);
    const max = integer(entry.max, `body.${part}.max`, 1, 1_000_000);
    if (expected) same(max, expected[part].max, `body.${part}.max`);
    const floor = bodyPartLossThreshold(max);
    if (entry.lost === undefined) {
      // Zero in the old format meant permanent loss, never a recoverable wound.
      const current = integer(entry.current, `body.${part}.current`, 0, max);
      return [part, { max, current: current === 0 ? floor : current, lost: current === 0 }];
    }
    if (typeof entry.lost !== 'boolean') fail(`body.${part}.lost`, 'expected boolean');
    const current = integer(entry.current, `body.${part}.current`, floor, max);
    same(entry.lost, current === floor, `body.${part}.lost`);
    return [part, { max, current, lost: entry.lost }];
  })) as HeroBody;
}
