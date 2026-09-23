import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { createCombat, deserializeSnapshot, runCombat, serializeSnapshot, stepCombat } from '@shards/game-core';
import { contentFixture, hero, options } from '../packages/game-core/src/__tests__/fixtures';
import { runActions } from '../packages/game-core/src/actions';
import { runAttackTurn } from '../packages/game-core/src/attack-turn';
import { chooseSkill } from '../packages/game-core/src/ai';
import { createContext } from '../packages/game-core/src/events';
import { damageReductionFor } from '../packages/game-core/src/modifiers';
import { legacyHeroBody, syncBodyCombatant } from '../packages/game-core/src/anatomy';
import { expireStatuses, tickStatuses } from '../packages/game-core/src/statuses';
import { expireShields } from '../packages/game-core/src/shields';
import { applyHealing } from '../packages/game-core/src/healing';
import { partyCompositions } from '../tools/balance-simulator/src/simulate';

describe('complete starting roster', () => {
  it('has nine distinct equipped heroes, three per role, with their own active and passive', () => {
    expect(new Set(gameContent.characters.map(hero => hero.id))).toEqual(new Set(['vampire', 'guardian', 'paladin', 'priest', 'druid', 'necromancer', 'rogue', 'ranger', 'mage']));
    for (const role of ['tank', 'healer', 'damage']) expect(gameContent.characters.filter(hero => hero.role === role)).toHaveLength(3);
    for (const hero of gameContent.characters) {
      expect(hero.passive?.description).toBeTruthy();
      expect(hero.anatomy?.equipment).toHaveLength(7);
      expect(hero.skillIds.map(id => gameContent.skills.find(skill => skill.id === id)!.tags).filter(tags => tags.includes('ROLE'))).toHaveLength(1);
      expect(hero.skillIds.map(id => gameContent.skills.find(skill => skill.id === id)!.tags).filter(tags => tags.includes('CHARACTER'))).toHaveLength(1);
    }
  });

  it('limits balance compositions to the supported one-to-four heroes', () => {
    const parties = partyCompositions(gameContent.characters.map(hero => hero.id));
    expect(parties).toHaveLength(255);
    expect(parties.every(party => party.length >= 1 && party.length <= 4 && new Set(party).size === party.length)).toBe(true);
    expect(new Set(parties.map(party => party.join(','))).size).toBe(parties.length);
  });

  it.each(gameContent.characters.map(hero => hero.id))('%s runs and restores a real solo battle deterministically', characterId => {
    const options = { seed: `solo:${characterId}`, characterIds: [characterId], enemyIds: ['goblin_scout'], encounterId: 'roaming' };
    let state = createCombat(options, gameContent);
    for (let i = 0; i < 8 && !['victory', 'defeat', 'draw'].includes(state.status); i++) {
      state = stepCombat(state, gameContent);
      expect(deserializeSnapshot(serializeSnapshot(state), gameContent)).toEqual(state);
    }
    const final = runCombat(state, gameContent);
    expect(final).toEqual(runCombat(createCombat(options, gameContent), gameContent));
    expect(deserializeSnapshot(serializeSnapshot(final), gameContent)).toEqual(final);
  });

  it('includes Guardian himself in his aura and skips a useless solo taunt', () => {
    const solo = createCombat({ seed: 'solo-guardian', characterIds: ['guardian'], enemyIds: ['rat'], encounterId: 'roaming' }, gameContent);
    const ctx = createContext(solo, gameContent);
    expect(damageReductionFor(ctx, solo.units[0])).toBe(0.25);
    expect(chooseSkill(ctx, solo.units[0])?.id).toBe('guardian_bastion');
    runActions(ctx, gameContent.skills.find(skill => skill.id === 'guardian_bastion')!.actions, { source: solo.units[0], target: 'self', origin: 'attack' });
    expect(damageReductionFor(ctx, solo.units[0])).toBe(0.75);
    const party = createCombat({ seed: 'duo', characterIds: ['guardian', 'priest'], enemyIds: ['rat'], encounterId: 'roaming' }, gameContent);
    expect(chooseSkill(createContext(party, gameContent), party.units[0])?.id).toBe('tank_taunt');
  });
});

describe('received healing and vampirism', () => {
  it('shares actual healing with the receiver and allies once, including another sharing hero', () => {
    const content = contentFixture();
    content.characters[0].modifiers.healingShareDice = '1d4';
    content.characters.push({ ...hero('ally'), modifiers: { healingShareDice: '1d4' } });
    const state = createCombat({ ...options, characterIds: ['hero', 'ally'] }, content);
    for (const unit of state.units.filter(unit => unit.team === 'heroes')) {
      unit.body = legacyHeroBody(content.characters.find(hero => hero.id === unit.definitionId)!, 20, 100);
      syncBodyCombatant(unit, content.characters.find(hero => hero.id === unit.definitionId)!);
    }
    const before = state.units.map(unit => unit.hp);
    applyHealing(createContext(state, content), state.units[0], state.units[0], 40);
    expect(state.units[0].hp - before[0]).toBe(50);
    expect(state.units[1].hp - before[1]).toBe(10);
    expect(state.events.filter(event => event.type === 'HEALED').map(event => event.amount)).toEqual([40, 10, 10]);
  });

  it('does not distribute overheal or regrow a limb through secondary healing', () => {
    const content = contentFixture(); content.characters[0].modifiers.healingShareDice = '1d4';
    const state = createCombat(options, content); const unit = state.units[0];
    unit.body!.leftArm.current = 0; unit.body!.torso.current -= 4; syncBodyCombatant(unit, content.characters[0]);
    applyHealing(createContext(state, content), unit, unit, 100);
    expect(unit.body!.leftArm.current).toBe(0);
    expect(state.events.filter(event => event.type === 'HEALED').map(event => event.amount)).toEqual([4]);
    expect(state.events.filter(event => event.type === 'OVERHEALED').map(event => event.amount)).toEqual([96, 1]);
  });

  it('vampirism heals only actual direct health damage, not shield absorption or overkill', () => {
    const content = contentFixture(); content.characters[0].modifiers.vampirismDice = '1d6';
    const state = createCombat({ ...options, seed: 'vampire-lifesteal' }, content);
    const unit = state.units[0]; unit.body!.torso.current -= 15; syncBodyCombatant(unit, content.characters[0]);
    const before = unit.hp;
    state.units[1].hp = 3; state.units[1].shield = 4;
    for (let i = 0; i < 10 && state.units[1].hp > 0; i++) runActions(createContext(state, content), [{ type: 'damage', scaling: 'power' }], { source: unit, target: 'enemy', origin: 'attack' });
    expect(state.units[1].hp).toBe(0);
    expect(unit.hp - before).toBe(1);
    expect(state.events.filter(event => event.type === 'HEALED').map(event => event.amount)).toEqual([1]);
  });
});

describe('regeneration and expiring absorption', () => {
  it('preserves a HoT tick on a successful source roll and otherwise spends the tick', () => {
    const content = contentFixture(); content.characters[0].modifiers.preserveHot = { dice: '1d4', atLeast: 1 };
    content.statuses.push({ schemaVersion: 1, id: 'hot', name: 'Hot', description: 'Hot', color: '#ffffff', trigger: 'TURN_ENDED', actions: [{ type: 'heal', scaling: 'healing' }], modifiers: {}, tags: ['HOT'] });
    const state = createCombat(options, content); const unit = state.units[0];
    unit.body!.torso.current -= 20; syncBodyCombatant(unit, content.characters[0]);
    unit.statuses.push({ id: 'hot', sourceId: unit.id, remaining: 4, appliedTurn: 0 }); state.turn = 1;
    const ctx = createContext(state, content); const before = unit.hp;
    tickStatuses(ctx, unit, 'TURN_ENDED'); expireStatuses(ctx, unit);
    expect(unit.hp - before).toBe(10); expect(unit.statuses[0].remaining).toBe(4);
    expect(state.events.some(event => event.type === 'DICE_ROLLED' && event.message.includes('сохранение исцеления'))).toBe(true);
    delete content.characters[0].modifiers.preserveHot; state.turn++;
    tickStatuses(ctx, unit, 'TURN_ENDED'); expireStatuses(ctx, unit);
    expect(unit.hp - before).toBe(20); expect(unit.statuses[0].remaining).toBe(3);
  });

  it('can absorb without consuming capacity but still expires after four recipient turns', () => {
    const content = contentFixture(); content.characters[0].modifiers.preserveShield = { dice: '1d4', atLeast: 1 };
    const state = createCombat(options, content); const [source, target] = state.units; const ctx = createContext(state, content);
    runActions(ctx, [{ type: 'shield', scaling: 'power', factor: 2, duration: 4 }], { source, target: 'enemy', origin: 'effect' });
    runActions(ctx, [{ type: 'damage', scaling: 'power' }], { source, target: 'enemy', origin: 'effect' });
    expect(target.shield).toBe(20); expect(target.hp).toBe(100);
    delete content.characters[0].modifiers.preserveShield;
    runActions(ctx, [{ type: 'damage', scaling: 'power' }], { source, target: 'enemy', origin: 'effect' });
    expect(target.shield).toBe(10); expect(target.shieldLayers?.[0].capacity).toBe(10);
    for (let turn = 1; turn <= 3; turn++) { state.turn = turn; expireShields(ctx, target); expect(target.shield).toBe(10); }
    state.turn = 4; expireShields(ctx, target);
    expect(target.shield).toBe(0); expect(target.shieldLayers).toBeUndefined();
  });

  it('rejects a saved timed shield whose layers exceed its aggregate capacity', () => {
    let state = createCombat({ seed: 'saved-ward', characterIds: ['necromancer'], enemyIds: ['slime'], encounterId: 'roaming' }, gameContent);
    for (let i = 0; i < 10 && !state.units[0].shieldLayers?.length; i++) state = stepCombat(state, gameContent);
    expect(state.units[0].shieldLayers?.length).toBeGreaterThan(0);
    expect(deserializeSnapshot(serializeSnapshot(state), gameContent)).toEqual(state);
    state.units[0].shieldLayers![0].capacity = state.units[0].shield + 1;
    expect(() => deserializeSnapshot(serializeSnapshot(state), gameContent)).toThrow(/capacity exceeds/);
  });
});

describe('precision and repeat attacks', () => {
  it('applies passive evasion to the same d20 outcomes instead of adding an unlogged random check', () => {
    const content = contentFixture(); content.enemies[0].stats.maxHp = 100_000;
    const attempts = (bonus: number) => {
      content.enemies[0].modifiers.evasionBonus = bonus;
      const state = createCombat({ ...options, seed: 'passive-dodge' }, content); const ctx = createContext(state, content);
      for (let i = 0; i < 60; i++) runActions(ctx, [content.characters[0].basicAttack], { source: state.units[0], target: 'enemy', origin: 'attack' });
      return { rolls: state.events.filter(event => event.type === 'DICE_ROLLED').map(event => event.amount!), misses: state.events.filter(event => event.type === 'MISS').length };
    };
    const base = attempts(0); const agile = attempts(0.15);
    expect(agile.rolls).toEqual(base.rolls);
    expect(agile.misses).toBe(agile.rolls.filter(roll => roll <= 3).length);
    expect(agile.misses).toBeGreaterThan(base.misses);
  });

  it('makes every landed direct hit critical, without turning a miss into a hit', () => {
    const content = contentFixture(); content.characters[0].modifiers.guaranteedCrit = true;
    content.enemies[0].stats.maxHp = 100_000;
    const state = createCombat(options, content); const ctx = createContext(state, content);
    for (let i = 0; i < 100; i++) runActions(ctx, [content.characters[0].basicAttack], { source: state.units[0], target: 'enemy', origin: 'attack' });
    expect(state.events.filter(event => event.type === 'HIT').length).toBeGreaterThan(0);
    expect(state.events.filter(event => event.type === 'CRIT')).toHaveLength(state.events.filter(event => event.type === 'HIT').length);
    expect(state.events.some(event => event.type === 'MISS')).toBe(true);
  });

  it('repeats once and turns excess repeat rating into direct damage, never another repeat', () => {
    const content = contentFixture(); content.characters[0].modifiers.repeatAttack = { dice: '1d4', atLeast: 1 }; content.characters[0].modifiers.damageBonus = 2;
    const state = createCombat({ ...options, seed: 'repeat' }, content); const ctx = createContext(state, content);
    runAttackTurn(ctx, state.units[0], [content.characters[0].basicAttack], 'enemy');
    expect(state.events.filter(event => event.type === 'ATTACK_STARTED')).toHaveLength(2);
    const damage = state.events.filter(event => event.type === 'DAMAGE');
    expect(damage.length).toBeGreaterThan(0);
    for (const event of damage) expect([12, 24]).toContain(event.amount);
    const before = state.events.length;
    runAttackTurn(ctx, state.units[0], [{ type: 'shield', scaling: 'power' }], 'self');
    expect(state.events.slice(before).some(event => event.type === 'ATTACK_STARTED')).toBe(false);
  });
});
