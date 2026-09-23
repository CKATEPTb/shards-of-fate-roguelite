import type { RngState } from '@shards/shared';

const WORD_RANGE = 1n << 64n;
const WORD_MASK = WORD_RANGE - 1n;
const INDEX_STEP = 0x9e3779b97f4a7c15n;
const RETRY_STEP = 0xd1b54a32d192ed03n;
const seedWords = new Map<string, bigint>();
const MAX_CACHED_SEEDS = 512;

/** Room RNG v1: FNV-1a over UTF-16 code units followed by a SplitMix64 finalizer. */
function seedWord(seed: string): bigint {
  const cached = seedWords.get(seed);
  if (cached !== undefined) return cached;
  let word = 0xcbf29ce484222325n;
  for (let index = 0; index < seed.length; index++) word = ((word ^ BigInt(seed.charCodeAt(index))) * 0x100000001b3n) & WORD_MASK;
  if (seedWords.size >= MAX_CACHED_SEEDS) seedWords.delete(seedWords.keys().next().value!);
  seedWords.set(seed, word);
  return word;
}

export function validateDiceOwner(owner: string): void {
  if (typeof owner !== 'string' || !owner.length || owner.length > 1024) throw new Error('Dice owner must contain 1–1024 characters');
}

function indexedSeedWord(rng: RngState): bigint {
  if (rng.diceOwner === undefined) return seedWord(rng.seed);
  validateDiceOwner(rng.diceOwner);
  // JSON frames both strings unambiguously, including delimiters and escaped characters.
  return seedWord(JSON.stringify(['entity-dice-v1', rng.seed, rng.diceOwner]));
}

function mixWord(word: bigint): bigint {
  word &= WORD_MASK;
  word = ((word ^ (word >> 30n)) * 0xbf58476d1ce4e5b9n) & WORD_MASK;
  word = ((word ^ (word >> 27n)) * 0x94d049bb133111ebn) & WORD_MASK;
  return word ^ (word >> 31n);
}

/** Check the entire requested draw before mutating a counter near its upper bound. */
export function reserveRoomDice(rng: RngState, count: number): number {
  const index = rng.diceIndex;
  if (index === undefined || !Number.isSafeInteger(index) || index < 0
    || !Number.isSafeInteger(count) || count < 0 || index > Number.MAX_SAFE_INTEGER - count) {
    throw new Error('Room dice index is invalid or exhausted');
  }
  return index;
}

export function drawRoomDie(sides: number, rng: RngState): number {
  const index = reserveRoomDice(rng, 1);
  const base = indexedSeedWord(rng) + (BigInt(index) + 1n) * INDEX_STEP;
  const size = BigInt(sides);
  const limit = WORD_RANGE - WORD_RANGE % size;
  let attempt = 0n;
  let word: bigint;
  do { word = mixWord(base + attempt++ * RETRY_STEP); } while (word >= limit);
  // Rejection sampling belongs to this die, so retries never advance the room index.
  rng.diceIndex = index + 1;
  return Number(word % size) + 1;
}

/** Floating consumers share the same indexed sequence, without touching legacy streams. */
export function drawRoomRandom(rng: RngState): number {
  const index = reserveRoomDice(rng, 1);
  const word = mixWord(indexedSeedWord(rng) + (BigInt(index) + 1n) * INDEX_STEP);
  rng.diceIndex = index + 1;
  return Number(word >> 11n) / 0x20000000000000;
}
