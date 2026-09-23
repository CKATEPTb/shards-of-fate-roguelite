import { RNG_STREAMS, SCHEMA_VERSION, type CombatOptions, type CombatState, type GameContent } from '@shards/shared';
import { createCombat } from './create';
import { canonicalJson, hashValue } from './canonical';
import { isLegacyAnatomyContentHash, isLegacyAttributesContentHash, isLegacyAutobattleContentHash, isLegacyEquipmentContentHash, isLegacyHeroSkillsContentHash, restoreContentHash } from './content-hash';
import { migrateCombatAttributes } from './snapshot-attributes';
import { migrateHeroSkills } from './snapshot-hero-skills';
import { migrateEquipmentStats } from './snapshot-equipment';
import { contentWithLegacyRatings, migrateManualCombatStats } from './snapshot-manual-combat';
import { validateEvents } from './snapshot-events';
import { migrateCombatBodies, validateUnits } from './snapshot-units';
import { array, fail, integer, oneOf, record, same, string } from './snapshot-values';
import { restoreDifficultyId } from './difficulty';
import { createCombatEntityRng, createEntityRng, createRoomRng } from './random';

/** A deterministic diagnostic checksum, not a cryptographic authenticity proof. */
export function hashState(state: CombatState): string { return hashValue(state); }
export function serializeSnapshot(state: CombatState): string { return JSON.stringify(state); }

/** Co-op checkpoints may opt into a contiguous event suffix; solo saves keep full-history checks. */
export function deserializeSnapshot(json: string, content: GameContent, options: { allowTruncatedEvents?: boolean; enemyScalingPartySize?: number } = {}): CombatState {
  if (typeof json !== 'string' || json.length > 32_000_000) throw new Error('Snapshot exceeds maximum size');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Invalid snapshot JSON'); }
  const state = record(value, 'state', ['schemaVersion', 'contentHash', 'seed', 'encounterId', 'characterIds', 'enemyIds', 'difficultyId', 'status', 'round', 'turn', 'turnOrder', 'turnIndex', 'pendingActorId', 'initiative', 'units', 'rng', 'events', 'nextSequence']);
  same(state.schemaVersion, SCHEMA_VERSION, 'schemaVersion');
  const seed = string(state.seed, 'seed');
  const encounterId = string(state.encounterId, 'encounterId');
  const characterIds = array(state.characterIds, 'characterIds', 4).map((id, index) => string(id, `characterIds[${index}]`));
  const enemyIds = state.enemyIds === undefined ? undefined : array(state.enemyIds, 'enemyIds', 16).map((id, index) => string(id, `enemyIds[${index}]`));
  const difficultyId = restoreDifficultyId(state.difficultyId);
  state.difficultyId = difficultyId;
  const scalingPartySize = options.enemyScalingPartySize === undefined ? characterIds.length
    : integer(options.enemyScalingPartySize, 'enemyScalingPartySize', 1, characterIds.length);
  const expectedCombat = (heroBodies?: CombatOptions['heroBodies']): CombatState => {
    const created = createCombat({ seed, encounterId, characterIds, enemyIds, difficultyId, heroBodies }, content);
    // Late co-op arrivals do not heal or strengthen enemies already in combat.
    // Their original scaled stats remain the checkpoint validation baseline.
    if (scalingPartySize !== characterIds.length) {
      const original = createCombat({ seed, encounterId, characterIds: characterIds.slice(0, scalingPartySize), enemyIds, difficultyId }, content);
      created.units = created.units.map(unit => unit.team === 'heroes' ? unit : original.units.find(candidate => candidate.id === unit.id)!);
    }
    return created;
  };
  let expected = expectedCombat();
  const originalContentHash = state.contentHash;
  const unchangedContent = state.contentHash === hashValue(content);
  const legacyBodies = !unchangedContent && isLegacyAnatomyContentHash(state.contentHash, content);
  const legacyEquipment = !unchangedContent && isLegacyEquipmentContentHash(state.contentHash, content);
  const legacyAutobattle = !unchangedContent && isLegacyAutobattleContentHash(state.contentHash, content);
  const legacyHeroSkills = !unchangedContent && isLegacyHeroSkillsContentHash(state.contentHash, content);
  const legacyAttributes = !unchangedContent && isLegacyAttributesContentHash(state.contentHash, content);
  state.contentHash = restoreContentHash(state.contentHash, content, 'contentHash');
  const status = oneOf(state.status, ['ready', 'running', 'victory', 'defeat', 'draw', 'escaped'], 'status');
  const round = integer(state.round, 'round', 0, content.balance.maxRounds);
  const turn = integer(state.turn, 'turn', 0, content.balance.maxRounds * expected.units.length);
  if (legacyAttributes) migrateCombatAttributes(state.units, expected.units, content, {
    partySize: scalingPartySize, autobattle: legacyAutobattle, oldHands: legacyEquipment,
  });
  else {
    migrateCombatBodies(state.units, expected.units, content, legacyBodies);
    if (legacyEquipment) migrateEquipmentStats(state.units, expected.units, legacyAutobattle ? contentWithLegacyRatings(content) : content);
    if (legacyAutobattle) migrateManualCombatStats(state.units, expected.units, content);
  }
  if (legacyHeroSkills) migrateHeroSkills(state.units, content);
  if (legacyAutobattle && status === 'ready' && !(state.rng as CombatState['rng'])?.entityDice) {
    // No turn has consumed a die yet; the new encounter can start with entity streams.
    state.rng = structuredClone(expected.rng);
  }
  validateUnits(state.units, expected.units, turn, content, originalContentHash !== state.contentHash);
  const unitIds = expected.units.map(unit => unit.id);
  const turnOrder = array(state.turnOrder, 'turnOrder', expected.units.length).map((id, index) => string(id, `turnOrder[${index}]`));
  if (new Set(turnOrder).size !== turnOrder.length || turnOrder.some(id => !unitIds.includes(id))) fail('turnOrder', 'unknown or duplicate actor');
  integer(state.turnIndex, 'turnIndex', 0, turnOrder.length);
  if (state.initiative !== undefined) {
    const initiative = record(state.initiative, 'initiative', unitIds);
    for (const [id, total] of Object.entries(initiative)) integer(total, `initiative.${id}`, -1_000_000, 1_000_000);
  }
  if (state.pendingActorId !== undefined) {
    const actorId = string(state.pendingActorId, 'pendingActorId');
    const actor = (state.units as CombatState['units']).find(unit => unit.id === actorId);
    if (status !== 'running' || actor?.team !== 'heroes' || actor.hp <= 0 || actor.escaped || actorId !== turnOrder[state.turnIndex as number]) fail('pendingActorId', 'must be the current living hero');
  }
  if (round > 0 && !turnOrder.length) fail('turnOrder', 'started round must have an initiative order');
  if (round === 0 && turn !== 0) fail('turn', 'cannot have turns before the first round');
  const rng = record(state.rng, 'rng', ['seed', 'streams', 'diceIndex', 'diceOwner', 'entityDice']);
  same(rng.seed, seed, 'rng.seed');
  const diceIndex = rng.diceIndex === undefined ? undefined : integer(rng.diceIndex, 'rng.diceIndex');
  const diceOwner = rng.diceOwner === undefined ? undefined : string(rng.diceOwner, 'rng.diceOwner', 1024);
  let entityDice: { owners: Record<string, string>; counters: Record<string, number> } | undefined;
  if (diceOwner !== undefined && rng.entityDice !== undefined) fail('rng', 'single-owner and combat-owner dice modes are exclusive');
  if ((diceOwner !== undefined || rng.entityDice !== undefined) && diceIndex === undefined) fail('rng.diceIndex', 'entity dice require an index');
  if (rng.entityDice !== undefined) {
    const entity = record(rng.entityDice, 'rng.entityDice', ['owners', 'counters']);
    const savedOwners = record(entity.owners, 'rng.entityDice.owners', unitIds);
    const owners = Object.fromEntries(unitIds.map(id => [id, string(savedOwners[id], `rng.entityDice.owners.${id}`, 1024)]));
    const ownerIds = Object.values(owners);
    if (new Set(ownerIds).size !== ownerIds.length) fail('rng.entityDice.owners', 'combatants must have distinct dice owners');
    const savedCounters = record(entity.counters, 'rng.entityDice.counters', ownerIds);
    const counters = Object.fromEntries(ownerIds.map(id => [id, integer(savedCounters[id], `rng.entityDice.counters.${id}`)]));
    // Counters outlive a battle; their sum is unrelated to its local draw total.
    entityDice = { owners, counters };
  }
  const streams = record(rng.streams, 'rng.streams', RNG_STREAMS);
  for (const name of RNG_STREAMS) {
    const stream = record(streams[name], `rng.streams.${name}`, ['state', 'counter']);
    integer(stream.state, `rng.streams.${name}.state`, 1, 0xffffffff);
    integer(stream.counter, `rng.streams.${name}.counter`);
  }
  const nextSequence = integer(state.nextSequence, 'nextSequence', 1);
  const eventCount = array(state.events, 'events').length;
  const firstSequence = options.allowTruncatedEvents ? integer(nextSequence - eventCount, 'events.firstSequence', 1) : 1;
  const events = validateEvents(state.events, unitIds, round, turn, content, firstSequence);
  same(nextSequence, firstSequence + events.length, 'nextSequence');
  if (!events.length) same(nextSequence, 1, 'nextSequence');
  const truncated = firstSequence > 1;
  const turnsStarted = events.filter(event => event.type === 'TURN_STARTED');
  if (truncated) {
    if (turnsStarted.length > turn) fail('events.TURN_STARTED', 'retained turns exceed the combat turn count');
  } else same(turnsStarted.length, turn, 'events.TURN_STARTED');
  const parsed = value as CombatState;
  if (status === 'ready') {
    expected = expectedCombat(Object.fromEntries(parsed.units.filter(unit => unit.team === 'heroes').map(unit => [unit.definitionId, unit.body!])));
    if (entityDice) expected.rng = createCombatEntityRng(seed, entityDice.owners, entityDice.counters, diceIndex!);
    else if (diceOwner !== undefined) expected.rng = createEntityRng(seed, diceOwner, diceIndex!);
    else if (diceIndex !== undefined) expected.rng = createRoomRng(seed, diceIndex);
  }
  for (const unit of parsed.units) {
    const retainedTurns = turnsStarted.filter(event => event.actorId === unit.id).length;
    if (truncated) {
      if (retainedTurns > unit.turnsTaken) fail(`units.${unit.id}.turnsTaken`, 'retained turns exceed the unit turn count');
    } else same(retainedTurns, unit.turnsTaken, `units.${unit.id}.turnsTaken`);
  }
  const heroes = parsed.units.some(unit => unit.team === 'heroes' && unit.hp > 0 && !unit.escaped);
  const escaped = parsed.units.some(unit => unit.team === 'heroes' && unit.escaped);
  const enemies = parsed.units.some(unit => unit.team === 'enemies' && unit.hp > 0);
  if (status === 'victory' && (!heroes || enemies) || status === 'defeat' && (heroes || !enemies || escaped) || status === 'running' && (!heroes || !enemies || !turn) || status === 'escaped' && (heroes || !escaped)) fail('status', 'inconsistent with survivors');
  if (status === 'draw' && !(heroes === enemies && (!heroes || round === content.balance.maxRounds))) fail('status', 'draw requires a round limit or mutual elimination');
  if (status === 'ready' && (turn !== 0 || round !== 0 || events.length || state.turnIndex !== 0 || turnOrder.length || canonicalJson(parsed) !== canonicalJson(expected))) fail('state', 'ready state must match a newly created combat');
  const terminal = ['victory', 'defeat', 'draw', 'escaped'].includes(status);
  const endings = events.filter(event => event.type === 'COMBAT_ENDED');
  if (endings.length > 1 || !terminal && endings.length || terminal && !endings.length && !truncated) fail('events', 'terminal state must contain exactly one COMBAT_ENDED');
  const endIndex = events.findIndex(event => event.type === 'COMBAT_ENDED');
  // End triggers may fill the entire retained suffix after COMBAT_ENDED itself.
  const afterEnd = endIndex >= 0 ? events.slice(endIndex + 1) : terminal && truncated ? events : [];
  if (afterEnd.some(event => ['COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'SKILL_USED', 'ATTACK_STARTED', 'TURN_ENDED'].includes(event.type as string))) fail('events', 'a completed combat cannot start another action or turn');
  return parsed;
}
