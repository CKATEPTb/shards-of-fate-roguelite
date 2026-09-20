import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { BODY_PARTS, type Combatant } from '@shards/shared';
import { bodyCombatHealth, bodyMaxHealth, legacyHeroBody, startHeroBody, syncBodyCombatant } from '../packages/game-core/src/anatomy';
import { createCombat } from '../packages/game-core/src/create';
import { runActions } from '../packages/game-core/src/actions';
import { createContext } from '../packages/game-core/src/events';
import { drawDice } from '../packages/game-core/src/dice';
import { createRng } from '../packages/game-core/src/random';
import { chooseSkill } from '../packages/game-core/src/ai';
import { selectTargets } from '../packages/game-core/src/targets';
import { runCombat, stepCombat } from '../packages/game-core/src/combat';
import { deserializeSnapshot, serializeSnapshot } from '../packages/game-core/src/snapshot';
import { hashValue } from '../packages/game-core/src/canonical';
import { contentFixture, hero, options } from '../packages/game-core/src/__tests__/fixtures';

function locationSeed(location: number, hit = 10): string {
  for (let index = 0; index < 100_000; index++) {
    const seed = `anatomy-${index}`;
    const rng = createRng(seed);
    if (drawDice('d20', rng).total === location && drawDice('d20', rng).total === hit) return seed;
  }
  throw new Error('No deterministic fixture seed');
}

function attack(location: number, hit = 10) {
  const content = contentFixture();
  const state = createCombat({ ...options, seed: locationSeed(location, hit) }, content);
  const [target, source] = state.units;
  return { content, state, target, source, damage: () => runActions(createContext(state, content), [{ type: 'damage', scaling: 'power' }], { source, target: 'enemy', origin: 'attack' }) };
}

describe('body combat rules', () => {
  it('rolls location before accuracy, with a location 1 consuming neither accuracy nor damage rolls', () => {
    const miss = attack(1);
    miss.damage();
    expect(miss.state.rng.streams.COMBAT.counter).toBe(1);
    expect(miss.state.events.filter(event => event.type === 'MISS')).toHaveLength(1);
    expect(miss.state.events.some(event => event.type === 'DAMAGE' || event.type === 'HIT')).toBe(false);
    const hit = attack(12);
    hit.damage();
    expect(hit.state.events.filter(event => event.type === 'DICE_ROLLED').map(event => event.amount)).toEqual([12, 10]);
    expect(hit.target.body!.leftArm.current).toBe(5);
    expect(hit.target.hp).toBe(90);
    expect(hit.state.events.find(event => event.type === 'DAMAGE')?.bodyPart).toBe('leftArm');
    const accuracyMiss = attack(20, 1);
    accuracyMiss.damage();
    expect(accuracyMiss.target.body!.head.current).toBe(12);
  });

  it('treats a location 20 as the head, independently of critical accuracy', () => {
    const normal = attack(20);
    normal.damage();
    expect(normal.target.body!.head.current).toBe(2);
    expect(normal.state.events.some(event => event.type === 'CRIT')).toBe(false);
    const critical = attack(20, 20);
    critical.damage();
    expect(critical.target.body!.head.current).toBe(0);
    expect(critical.target.hp).toBe(0);
    expect(critical.state.events.find(event => event.type === 'DAMAGE')?.amount).toBe(12);
    expect(critical.state.events.filter(event => event.type === 'ENTITY_DIED')).toHaveLength(1);
  });

  it.each([[1, 10], [12, 1]])('does not apply a follow-up status after a location/accuracy miss (%i, %i)', (location, hit) => {
    const fixture = attack(location, hit);
    fixture.content.statuses.push({ schemaVersion: 1, id: 'venom', name: 'Venom', description: 'Venom', color: '#fff', actions: [], modifiers: {}, tags: [] });
    runActions(createContext(fixture.state, fixture.content), [{ type: 'damage', scaling: 'power' }, { type: 'status', statusId: 'venom', duration: 2 }], { source: fixture.source, target: 'enemy', origin: 'attack' });
    expect(fixture.target.statuses).toEqual([]);
    expect(fixture.state.events.some(event => event.type === 'STATUS_APPLIED')).toBe(false);
  });

  it('applies armor and shields before localized damage, discarding limb overflow', () => {
    const fixture = attack(12);
    fixture.target.stats.armor = 100;
    fixture.target.shield = 3;
    fixture.damage();
    expect(fixture.target.body!.leftArm.current).toBe(13);
    expect(fixture.target.shield).toBe(0);
    const severed = attack(12);
    severed.source.stats.power = 100;
    severed.damage();
    expect(severed.target.body!.leftArm.current).toBe(0);
    expect(severed.target.body!.torso.current).toBe(28);
    expect(severed.target.hp).toBe(85);
    severed.source.stats.power = 10;
    severed.state.rng = createRng(locationSeed(12));
    severed.damage();
    expect(severed.target.body!.torso.current).toBe(18);
    expect(severed.state.events.filter(event => event.type === 'DAMAGE').at(-1)?.bodyPart).toBe('torso');
  });

  it('keeps DOT on the torso without body/accuracy rolls and rolls direct AoE independently', () => {
    const content = contentFixture();
    content.characters.push(hero('ally'));
    const state = createCombat({ ...options, characterIds: ['hero', 'ally'], seed: locationSeed(12) }, content);
    const enemy = state.units[2];
    runActions(createContext(state, content), [{ type: 'damage', scaling: 'power' }], { source: enemy, bearer: state.units[0], target: 'self', origin: 'status' });
    expect(state.units[0].body!.torso.current).toBe(18);
    expect(state.rng.streams.COMBAT.counter).toBe(0);
    runActions(createContext(state, content), [{ type: 'damage', scaling: 'power' }], { source: enemy, target: 'allEnemies', origin: 'attack' });
    expect(state.events.filter(event => event.type === 'DICE_ROLLED' && event.message.includes('часть тела'))).toHaveLength(2);
    expect(state.events.filter(event => event.type === 'ATTACK_STARTED').map(event => event.targetId)).toEqual(state.units.slice(0, 2).map(unit => unit.id));
  });

  it('heals once across surviving parts and chooses wounds that can still be healed', () => {
    const state = createCombat({ seed: 'healing-anatomy', encounterId: 'mossy_path', characterIds: ['guardian', 'priest', 'mage'] }, gameContent);
    const [guardian, priest, mage] = state.units;
    guardian.body!.leftArm.current = guardian.body!.rightArm.current = 0;
    syncBodyCombatant(guardian, gameContent.characters[0]);
    mage.body = legacyHeroBody(gameContent.characters[2], 35, 100);
    syncBodyCombatant(mage, gameContent.characters[2]);
    const ctx = createContext(state, gameContent);
    expect(selectTargets(ctx, priest, 'lowestHealthAlly')[0]).toBe(mage);
    expect(chooseSkill(ctx, priest)?.id).toBe('priest_prayer');
    const before = bodyCombatHealth(mage.body);
    runActions(ctx, [{ type: 'heal', scaling: 'healing' }], { source: priest, target: 'allAllies', origin: 'effect' });
    expect(bodyCombatHealth(mage.body!) - before).toBe(priest.stats.healing);
    expect(guardian.body!.leftArm.current).toBe(0);
    expect(guardian.statuses).toEqual([]);
    expect(mage.statuses.some(status => status.id === 'inspired')).toBe(true);
    mage.body = startHeroBody(gameContent.characters[2]);
    syncBodyCombatant(mage, gameContent.characters[2]);
    expect(chooseSkill(ctx, priest)).toBeUndefined();
  });

  it('prevents basic and active actions without arms but allows passives and one-armed actions', () => {
    const content = contentFixture();
    const state = createCombat(options, content);
    const actor = state.units[0];
    actor.body!.leftArm.current = actor.body!.rightArm.current = 0;
    syncBodyCombatant(actor, content.characters[0]);
    const active = stepCombat(state, content);
    expect(active.events.some(event => event.actorId === actor.id && ['ATTACK_STARTED', 'SKILL_USED'].includes(event.type))).toBe(false);
    const ctx = createContext(state, content);
    runActions(ctx, [{ type: 'shield', scaling: 'power' }], { source: actor, target: 'self', origin: 'attack' });
    expect(actor.shield).toBe(0);
    runActions(ctx, [{ type: 'shield', scaling: 'power' }], { source: actor, target: 'self', origin: 'effect' });
    expect(actor.shield).toBe(10);
    actor.body!.leftArm.current = 1;
    runActions(ctx, [{ type: 'shield', scaling: 'power' }], { source: actor, target: 'self', origin: 'attack' });
    expect(actor.shield).toBe(20);
  });

  it('prioritizes a critical head wound even while the other five parts are healthy', () => {
    const state = createCombat({ seed: 'head-priority', encounterId: 'mossy_path', characterIds: ['guardian', 'priest', 'mage'] }, gameContent);
    const [guardian, priest, mage] = state.units;
    guardian.body!.head.current = 1;
    mage.body = legacyHeroBody(gameContent.characters[2], 60, 100);
    syncBodyCombatant(guardian, gameContent.characters[0]);
    syncBodyCombatant(mage, gameContent.characters[2]);
    const ctx = createContext(state, gameContent);
    priest.cooldowns.priest_prayer = 5;
    expect(chooseSkill(ctx, priest)?.id).toBe('healer_mend');
    expect(selectTargets(ctx, priest, 'lowestHealthAlly')[0]).toBe(guardian);
    mage.body = startHeroBody(gameContent.characters[2]);
    syncBodyCombatant(mage, gameContent.characters[2]);
    expect(chooseSkill(ctx, priest)?.id).toBe('healer_mend');
  });
});

describe('persistent combat anatomy', () => {
  it('deep clones incoming wounds and restores ready, active and terminal fights deterministically', () => {
    const definition = gameContent.characters[0];
    const body = startHeroBody(definition);
    body.leftArm.current = 0;
    body.leftLeg.current = 12;
    const initial = createCombat({ seed: 'persist-injuries', encounterId: 'mossy_path', characterIds: ['guardian'], heroBodies: { guardian: body } }, gameContent);
    expect(initial.units[0].body).toEqual(body);
    expect(initial.units[0].body).not.toBe(body);
    const active = stepCombat(stepCombat(initial, gameContent), gameContent);
    const final = runCombat(initial, gameContent);
    for (const state of [initial, active, final]) {
      const restored = deserializeSnapshot(serializeSnapshot(state), gameContent);
      expect(restored).toEqual(state);
      expect(runCombat(restored, gameContent)).toEqual(final);
    }
    expect(body.leftLeg.current).toBe(12);
  });

  it('migrates the exact old content shape and scalar HP without reviving old deaths', () => {
    const legacyContent = structuredClone(gameContent);
    legacyContent.characters.forEach(definition => { delete definition.anatomy; });
    const state = stepCombat(createCombat({ seed: 'legacy-body', encounterId: 'mossy_path', characterIds: ['guardian', 'priest'] }, legacyContent), legacyContent);
    state.units.filter(unit => unit.team === 'heroes').forEach((unit, index) => {
      const definition = legacyContent.characters.find(candidate => candidate.id === unit.definitionId)!;
      delete unit.body;
      unit.stats = { ...definition.stats };
      unit.hp = index === 0 ? definition.stats.maxHp / 2 : 0;
    });
    state.contentHash = hashValue(legacyContent);
    const restored = deserializeSnapshot(serializeSnapshot(state), gameContent);
    expect(restored.units[0].body!.torso.current).toBe(32);
    expect(restored.units[0].hp).toBe(130);
    expect(restored.units[1].hp).toBe(0);
    expect(BODY_PARTS.every(part => restored.units[1].body![part].current === 0)).toBe(true);
    expect(deserializeSnapshot(serializeSnapshot(restored), gameContent)).toEqual(restored);
  });

  it('rejects missing bodies, inconsistent scalar health, changed maxima and stale armor', () => {
    const initial = createCombat({ seed: 'body-validation', encounterId: 'mossy_path', characterIds: ['guardian'] }, gameContent);
    const mutations: ((unit: Combatant) => void)[] = [unit => { delete unit.body; }, unit => { unit.hp--; }, unit => { unit.body!.head.max++; }, unit => { unit.body!.leftArm.current = 0; unit.hp = bodyCombatHealth(unit.body!); }, unit => { unit.stats.maxHp = bodyMaxHealth(unit.body!) + 1; }];
    for (const mutate of mutations) {
      const state = structuredClone(initial);
      mutate(state.units[0]);
      expect(() => deserializeSnapshot(serializeSnapshot(state), gameContent)).toThrow();
    }
  });
});
