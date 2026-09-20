import { RNG_STREAMS, type RngState, type RngStream } from '@shards/shared';

/** FNV-1a over UTF-16 code units. Kept explicit so browser and headless runs agree. */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function createRng(seed: string): RngState {
  if (typeof seed !== 'string' || !seed.length || seed.length > 256) throw new Error('Seed must contain 1–256 characters');
  const streams = Object.fromEntries(RNG_STREAMS.map(name => [name, { state: hashString(`${seed}:${name}`) || 1, counter: 0 }])) as RngState['streams'];
  return { seed, streams };
}

/** Internal mutation is restricted to the private, cloned state of a step. */
export function drawRandom(rng: RngState, stream: RngStream): number {
  const current = rng.streams[stream];
  let state = current.state;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  current.state = state >>> 0;
  current.counter++;
  return current.state / 4294967296;
}

export function nextRandom(rng: RngState, stream: RngStream = 'COMBAT'): { value: number; rng: RngState } {
  const updated = structuredClone(rng);
  return { value: drawRandom(updated, stream), rng: updated };
}
