import { afterAll, describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { BODY_PARTS, DIFFICULTY_IDS, type CombatState } from '@shards/shared';
import { createCombat, createCombatEntityRng, deserializeSnapshot, hashState, isTerminal, runCombat, serializeSnapshot, startHeroBody,
  stepCombat, submitCombatAction } from '@shards/game-core';
import { simulationPolicy } from '../packages/game-core/src/simulation-policy';

const historyLimit = 128;
const enemies = [
  ['slime', 'wolf'],
  ['thornling', 'spider'],
  ['goblin_shaman', 'goblin_scout'],
  ['act1_reed_clan_24', 'goblin_archer'],
  ['goblin_shaman', 'slime'],
  ['act1_reed_clan_14', 'wolf'],
  ['act1_reed_clan_16', 'act1_reed_clan_4'],
  ['goblin_archer', 'thornling'],
  ['act1_reed_clan_9', 'spider'],
];
const cases = enemies.flatMap((enemyIds, seedIndex) => [1, 2, 3, 4].flatMap(size => DIFFICULTY_IDS.map(difficultyId => ({
  seedIndex, seed: `balance-resume-v1:${seedIndex}`, size, difficultyId, enemyIds,
  characterIds: Array.from({ length: size }, (_, index) => gameContent.characters[(seedIndex + index * 2) % gameContent.characters.length].id),
}))));

const coverage = { pairs: 0, pending: 0, betweenTurns: 0, activeStatuses: 0, activeShields: 0, missingLimbs: 0,
  heroHealing: 0, enemyHealing: 0, heroShields: 0, enemyShields: 0 };

function observe(state: CombatState, afterSequence = 0): void {
  for (const event of state.events.filter(event => event.sequence >= afterSequence)) {
    const team = state.units.find(unit => unit.id === event.targetId)?.team;
    if (event.type === 'HEALED' && (event.amount ?? 0) > 0) {
      if (team === 'heroes') coverage.heroHealing++;
      if (team === 'enemies') coverage.enemyHealing++;
    }
    if (event.type === 'SHIELD_CREATED') {
      if (team === 'heroes') coverage.heroShields++;
      if (team === 'enemies') coverage.enemyShields++;
    }
  }
}

/** Use the same complete-transition event retention as the offline batch runner. */
function nextTransition(state: CombatState): CombatState {
  const firstSequence = state.nextSequence;
  const next = state.pendingActorId ? submitCombatAction(state, gameContent, simulationPolicy(state, gameContent)) : stepCombat(state, gameContent);
  observe(next, firstSequence);
  const keep = Math.max(historyLimit, next.nextSequence - firstSequence);
  return next.events.length > keep ? { ...next, events: next.events.slice(-keep) } : next;
}

describe('balance simulation checkpoint determinism', () => {
  it('covers all heroes, party sizes, difficulties and authored enemy support actions', () => {
    expect(cases).toHaveLength(108);
    expect(new Set(cases.flatMap(entry => entry.characterIds))).toEqual(new Set(gameContent.characters.map(hero => hero.id)));
    expect(new Set(cases.map(entry => entry.size))).toEqual(new Set([1, 2, 3, 4]));
    expect(new Set(cases.map(entry => entry.difficultyId))).toEqual(new Set(DIFFICULTY_IDS));
    const actions = enemies.flat().flatMap(id => gameContent.enemies.find(enemy => enemy.id === id)!.skillIds)
      .flatMap(id => gameContent.skills.find(skill => skill.id === id)!.actions.map(action => action.type));
    expect(new Set(actions)).toEqual(new Set(['damage', 'heal', 'shield', 'status']));
  });

  it.each(cases)('resumes $seed / $size heroes / $difficultyId without changing the future', entry => {
    const heroBodies = Object.fromEntries(entry.characterIds.map((id, index) => {
      const body = startHeroBody(gameContent.characters.find(hero => hero.id === id)!);
      for (const part of BODY_PARTS) body[part].current = Math.max(1, Math.floor(body[part].max * (.55 + (entry.seedIndex + index) % 4 * .1)));
      if (entry.seedIndex % 4 === 3 && index === 0) body.leftLeg = { ...body.leftLeg, lost: true, current: -Math.ceil(body.leftLeg.max / 2) };
      return [id, body];
    }));
    const initial = createCombat({ seed: entry.seed, characterIds: entry.characterIds, difficultyId: entry.difficultyId,
      encounterId: 'determinism-roaming', enemyIds: entry.enemyIds, heroBodies }, gameContent);
    // Legitimate persistent hero offsets from previous encounters; enemies start fresh.
    const owners = initial.rng.entityDice!.owners;
    const counters = Object.fromEntries(Object.values(owners).map((owner, index) => [owner, owner.startsWith('hero:') ? entry.seedIndex * 17 + index * 3 : 0]));
    initial.rng = createCombatEntityRng(entry.seed, owners, counters);
    const untouched = serializeSnapshot(initial);
    const uninterrupted = runCombat(initial, gameContent, simulationPolicy, { eventHistoryLimit: historyLimit });
    expect(isTerminal(uninterrupted)).toBe(true);
    expect(serializeSnapshot(initial)).toBe(untouched);

    const halfwayTurn = Math.max(1, Math.floor(uninterrupted.turn / 2));
    let checkpoint = initial;
    const maxSteps = gameContent.balance.maxRounds * initial.units.length * 2 + 2;
    for (let step = 0; step < maxSteps; step++) {
      const next = nextTransition(checkpoint);
      if (isTerminal(next)) break;
      checkpoint = next;
      const desiredBoundary = entry.seedIndex % 2 === 0 ? Boolean(checkpoint.pendingActorId) : !checkpoint.pendingActorId;
      if (checkpoint.turn >= halfwayTurn && desiredBoundary) break;
    }
    expect(checkpoint.status).toBe('running');
    expect(checkpoint.turn).toBeGreaterThan(0);
    expect(isTerminal(checkpoint)).toBe(false);
    const snapshot = serializeSnapshot(checkpoint);
    const restored = deserializeSnapshot(snapshot, gameContent, { allowTruncatedEvents: true });
    expect(restored).toEqual(checkpoint);
    expect(hashState(restored)).toBe(hashState(checkpoint));
    const resumed = runCombat(restored, gameContent, simulationPolicy, { eventHistoryLimit: historyLimit });
    expect(serializeSnapshot(checkpoint)).toBe(snapshot);
    expect(resumed.rng).toEqual(uninterrupted.rng);
    expect(resumed.units.map(unit => ({ id: unit.id, hp: unit.hp, body: unit.body, shield: unit.shield, cooldowns: unit.cooldowns,
      effectCooldowns: unit.effectCooldowns, statuses: unit.statuses }))).toEqual(uninterrupted.units.map(unit => ({
      id: unit.id, hp: unit.hp, body: unit.body, shield: unit.shield, cooldowns: unit.cooldowns, effectCooldowns: unit.effectCooldowns, statuses: unit.statuses,
    })));
    expect(resumed).toEqual(uninterrupted);
    expect(hashState(resumed)).toBe(hashState(uninterrupted));
    expect(deserializeSnapshot(serializeSnapshot(resumed), gameContent, { allowTruncatedEvents: true })).toEqual(resumed);

    coverage.pairs++;
    if (checkpoint.pendingActorId) coverage.pending++; else coverage.betweenTurns++;
    if (checkpoint.units.some(unit => unit.statuses.length)) coverage.activeStatuses++;
    if (checkpoint.units.some(unit => unit.shield > 0)) coverage.activeShields++;
    if (checkpoint.units.some(unit => unit.body && BODY_PARTS.some(part => unit.body![part].lost))) coverage.missingLimbs++;
    observe(resumed, checkpoint.nextSequence);
  }, 30_000);

  afterAll(() => {
    expect(coverage.pairs).toBe(108);
    for (const [name, count] of Object.entries(coverage)) expect(count, `Expected exercised checkpoint/support case: ${name}`).toBeGreaterThan(0);
    console.info('Determinism coverage:', JSON.stringify(coverage));
  });
});
