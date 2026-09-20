import { RNG_STREAMS, SCHEMA_VERSION, type CombatState, type GameContent } from '@shards/shared';
import { createCombat } from './create';
import { canonicalJson, hashValue } from './canonical';
import { isLegacyAnatomyContentHash, restoreContentHash } from './content-hash';
import { validateEvents } from './snapshot-events';
import { migrateCombatBodies, validateUnits } from './snapshot-units';
import { array, fail, integer, oneOf, record, same, string } from './snapshot-values';
import { restoreDifficultyId } from './difficulty';

/** A deterministic diagnostic checksum, not a cryptographic authenticity proof. */
export function hashState(state: CombatState): string { return hashValue(state); }
export function serializeSnapshot(state: CombatState): string { return JSON.stringify(state); }

export function deserializeSnapshot(json: string, content: GameContent): CombatState {
  if (typeof json !== 'string' || json.length > 32_000_000) throw new Error('Snapshot exceeds maximum size');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Invalid snapshot JSON'); }
  const state = record(value, 'state', ['schemaVersion', 'contentHash', 'seed', 'encounterId', 'characterIds', 'enemyIds', 'difficultyId', 'status', 'round', 'turn', 'turnOrder', 'turnIndex', 'units', 'rng', 'events', 'nextSequence']);
  same(state.schemaVersion, SCHEMA_VERSION, 'schemaVersion');
  const seed = string(state.seed, 'seed');
  const encounterId = string(state.encounterId, 'encounterId');
  const characterIds = array(state.characterIds, 'characterIds', 4).map((id, index) => string(id, `characterIds[${index}]`));
  const enemyIds = state.enemyIds === undefined ? undefined : array(state.enemyIds, 'enemyIds', 16).map((id, index) => string(id, `enemyIds[${index}]`));
  const difficultyId = restoreDifficultyId(state.difficultyId);
  state.difficultyId = difficultyId;
  let expected = createCombat({ seed, encounterId, characterIds, enemyIds, difficultyId }, content);
  const legacyBodies = isLegacyAnatomyContentHash(state.contentHash, content);
  state.contentHash = restoreContentHash(state.contentHash, content, 'contentHash');
  const status = oneOf(state.status, ['ready', 'running', 'victory', 'defeat', 'draw'], 'status');
  const round = integer(state.round, 'round', 0, content.balance.maxRounds);
  const turn = integer(state.turn, 'turn', 0, content.balance.maxRounds * expected.units.length);
  migrateCombatBodies(state.units, expected.units, content, legacyBodies);
  validateUnits(state.units, expected.units, turn, content);
  const unitIds = expected.units.map(unit => unit.id);
  const turnOrder = array(state.turnOrder, 'turnOrder', expected.units.length).map((id, index) => string(id, `turnOrder[${index}]`));
  if (new Set(turnOrder).size !== turnOrder.length || turnOrder.some(id => !unitIds.includes(id))) fail('turnOrder', 'unknown or duplicate actor');
  integer(state.turnIndex, 'turnIndex', 0, turnOrder.length);
  if (round > 0 && !turnOrder.length) fail('turnOrder', 'started round must have an initiative order');
  if (round === 0 && turn !== 0) fail('turn', 'cannot have turns before the first round');
  const rng = record(state.rng, 'rng', ['seed', 'streams']);
  same(rng.seed, seed, 'rng.seed');
  const streams = record(rng.streams, 'rng.streams', RNG_STREAMS);
  for (const name of RNG_STREAMS) {
    const stream = record(streams[name], `rng.streams.${name}`, ['state', 'counter']);
    integer(stream.state, `rng.streams.${name}.state`, 1, 0xffffffff);
    integer(stream.counter, `rng.streams.${name}.counter`);
  }
  const events = validateEvents(state.events, unitIds, round, turn, content);
  same(state.nextSequence, events.length + 1, 'nextSequence');
  const turnsStarted = events.filter(event => event.type === 'TURN_STARTED');
  same(turnsStarted.length, turn, 'events.TURN_STARTED');
  const parsed = value as CombatState;
  if (status === 'ready') expected = createCombat({ seed, encounterId, characterIds, enemyIds, difficultyId, heroBodies: Object.fromEntries(parsed.units.filter(unit => unit.team === 'heroes').map(unit => [unit.definitionId, unit.body!])) }, content);
  for (const unit of parsed.units) same(turnsStarted.filter(event => event.actorId === unit.id).length, unit.turnsTaken, `units.${unit.id}.turnsTaken`);
  const heroes = parsed.units.some(unit => unit.team === 'heroes' && unit.hp > 0);
  const enemies = parsed.units.some(unit => unit.team === 'enemies' && unit.hp > 0);
  if (status === 'victory' && (!heroes || enemies) || status === 'defeat' && (heroes || !enemies) || status === 'running' && (!heroes || !enemies || !turn)) fail('status', 'inconsistent with survivors');
  if (status === 'draw' && !(heroes === enemies && (!heroes || round === content.balance.maxRounds))) fail('status', 'draw requires a round limit or mutual elimination');
  if (status === 'ready' && (turn !== 0 || round !== 0 || events.length || state.turnIndex !== 0 || turnOrder.length || canonicalJson(parsed) !== canonicalJson(expected))) fail('state', 'ready state must match a newly created combat');
  const terminal = ['victory', 'defeat', 'draw'].includes(status);
  const endings = events.filter(event => event.type === 'COMBAT_ENDED');
  if (endings.length !== (terminal ? 1 : 0)) fail('events', 'terminal state must contain exactly one COMBAT_ENDED');
  const endIndex = events.findIndex(event => event.type === 'COMBAT_ENDED');
  if (endIndex >= 0 && events.slice(endIndex + 1).some(event => ['COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'SKILL_USED', 'ATTACK_STARTED', 'TURN_ENDED'].includes(event.type as string))) fail('events', 'a completed combat cannot start another action or turn');
  return parsed;
}
