import { describe, expect, it } from 'vitest';
import { createCombat, runCombat, stepCombat, CombatLimitError } from '../index';
import { runActions } from '../actions';
import { createContext } from '../events';
import { selectTargets } from '../targets';
import { contentFixture, hero, options } from './fixtures';
import { legacyHeroBody, syncBodyCombatant } from '../anatomy';

describe('shared effect pipeline', () => {
  it('applies party mitigation to the source and allies, consuming shields before HP', () => {
    const content = contentFixture();
    content.characters.push(hero('ally'));
    content.characters[0].modifiers.partyDamageReduction = 0.25;
    content.statuses.push({ schemaVersion: 1, id: 'bastion', name: 'Bastion', description: 'Bastion', color: '#fff', actions: [], modifiers: { partyDamageReduction: 0.5 }, tags: [] });
    const state = createCombat({ ...options, characterIds: ['hero', 'ally'] }, content);
    state.units[0].statuses.push({ id: 'bastion', sourceId: state.units[0].id, remaining: 4, appliedTurn: 0 });
    state.units[1].shield = 2;
    const ctx = createContext(state, content);
    runActions(ctx, [{ type: 'damage', scaling: 'power' }], { source: state.units[2], target: 'allEnemies', origin: 'effect' });
    expect(state.units[0].hp).toBe(98);
    expect(state.units[1].hp).toBe(100);
    expect(state.units[1].shield).toBe(0);
    expect(state.events.some(event => event.type === 'SHIELD_BROKEN')).toBe(true);
  });

  it('Priest healing applies an ally buff through a HEALED trigger, with no overheal proc', () => {
    const content = contentFixture();
    content.characters.push(hero('ally'));
    content.characters[0].effectIds = ['inspire'];
    content.statuses.push({ schemaVersion: 1, id: 'inspired', name: 'Inspired', description: 'Inspired', color: '#fff', actions: [], modifiers: { damageMultiplier: 1.2 }, tags: [] });
    content.effects.push({ schemaVersion: 1, id: 'inspire', name: 'Inspire', description: 'Inspire', trigger: 'HEALED', conditions: ['sourceIsOwner', 'targetIsAlly', 'ownerAlive'], target: 'eventTarget', priority: 1, internalCooldown: 0, actions: [{ type: 'status', statusId: 'inspired', duration: 2 }], tags: [] });
    const state = createCombat({ ...options, characterIds: ['hero', 'ally'] }, content);
    state.units[1].body = legacyHeroBody(content.characters[1], 20, 100);
    syncBodyCombatant(state.units[1], content.characters[1]);
    runActions(createContext(state, content), [{ type: 'heal', scaling: 'healing' }], { source: state.units[0], target: 'allAllies', origin: 'effect' });
    expect(state.units[0].statuses).toEqual([]);
    expect(state.units[1].statuses[0].id).toBe('inspired');
    expect(state.units[1].hp).toBe(30);
    expect(state.events.filter(event => event.type === 'HEALED')).toHaveLength(1);
    expect(state.events.filter(event => event.type === 'OVERHEALED')).toHaveLength(1);
  });

  it('ticks burn from the source’s power and remaining duration on target turns', () => {
    const content = contentFixture();
    content.characters[0].basicAttack.factor = 0;
    content.enemies[0].basicAttack.factor = 0;
    content.characters[0].skillIds = ['ignite'];
    content.skills.push({ schemaVersion: 1, id: 'ignite', name: 'Ignite', description: 'Ignite', cooldown: 50, priority: 1, condition: 'always', target: 'enemy', actions: [{ type: 'status', statusId: 'burn', duration: 3 }], tags: [] });
    content.statuses.push({ schemaVersion: 1, id: 'burn', name: 'Burn', description: 'Burn', color: '#f00', trigger: 'TURN_ENDED', actions: [{ type: 'damage', scaling: 'power', factor: 0.3, scaleWithRemainingDuration: true }], modifiers: {}, tags: [] });
    let state = createCombat(options, content);
    for (let i = 0; i < 6; i++) state = stepCombat(state, content);
    expect(state.events.filter(event => event.type === 'DAMAGE' && event.statusId === 'burn').map(event => event.amount)).toEqual([9, 6, 3]);
    expect(state.units[1].statuses).toEqual([]);
    expect(state.events.filter(event => event.type === 'STATUS_EXPIRED')).toHaveLength(1);
  });

  it('does not shorten an existing burn when a weaker proc reapplies it', () => {
    const content = contentFixture();
    content.statuses.push({ schemaVersion: 1, id: 'burn', name: 'Burn', description: 'Burn', color: '#f00', actions: [], modifiers: {}, tags: [] });
    const state = createCombat(options, content);
    const ctx = createContext(state, content);
    runActions(ctx, [{ type: 'status', statusId: 'burn', duration: 4 }, { type: 'status', statusId: 'burn', duration: 2 }], { source: state.units[0], target: 'enemy', origin: 'effect' });
    expect(state.units[1].statuses).toHaveLength(1);
    expect(state.units[1].statuses[0].remaining).toBe(4);
  });

  it('keeps multi-action skills on their original target when the first action kills it', () => {
    const content = contentFixture();
    content.encounters[0].enemyIds = ['enemy', 'enemy'];
    content.characters[0].skillIds = ['ignite'];
    content.skills.push({ schemaVersion: 1, id: 'ignite', name: 'Ignite', description: 'Ignite', cooldown: 3, priority: 1, target: 'enemy', condition: 'always', actions: [{ type: 'damage', scaling: 'power', factor: 100 }, { type: 'status', statusId: 'burn', duration: 4 }], tags: [] });
    content.statuses.push({ schemaVersion: 1, id: 'burn', name: 'Burn', description: 'Burn', color: '#f00', actions: [], modifiers: {}, tags: [] });
    const state = stepCombat(createCombat({ ...options, seed: 'target-lock' }, content), content);
    expect(state.units[1].hp).toBe(0);
    expect(state.units[2].hp).toBe(100);
    expect(state.units[2].statuses).toEqual([]);
    expect(state.events.some(event => event.type === 'STATUS_APPLIED')).toBe(false);
  });

  it('targets taunts by current HP before default max-HP threat, with stable ID ties', () => {
    const content = contentFixture();
    content.encounters[0].enemyIds = ['enemy', 'enemy'];
    content.statuses.push({ schemaVersion: 1, id: 'taunt', name: 'Taunt', description: 'Taunt', color: '#fff', actions: [], modifiers: { taunt: true }, tags: [] });
    const state = createCombat(options, content);
    const ctx = createContext(state, content);
    state.units[1].stats.maxHp = 300;
    expect(selectTargets(ctx, state.units[0], 'enemy')[0].id).toBe(state.units[1].id);
    state.units[2].statuses.push({ id: 'taunt', sourceId: state.units[2].id, appliedTurn: 0, remaining: 1 });
    expect(selectTargets(ctx, state.units[0], 'enemy')[0].id).toBe(state.units[2].id);
    state.units[1].statuses.push({ id: 'taunt', sourceId: state.units[1].id, appliedTurn: 0, remaining: 1 });
    state.units[1].hp = 20;
    expect(selectTargets(ctx, state.units[0], 'enemy')[0].id).toBe(state.units[2].id);
    state.units[1].hp = state.units[2].hp;
    expect(selectTargets(ctx, state.units[0], 'enemy')[0].id).toBe(state.units[1].id);
  });

  it('fails a recursive trigger graph without mutating the caller’s state', () => {
    const content = contentFixture();
    content.characters[0].effectIds = ['loop'];
    content.effects.push({ schemaVersion: 1, id: 'loop', name: 'Loop', description: 'Loop', trigger: 'SHIELD_CREATED', conditions: ['sourceIsOwner'], target: 'self', priority: 1, internalCooldown: 0, actions: [{ type: 'shield', scaling: 'power' }], tags: [] });
    content.characters[0].skillIds = ['shield'];
    content.skills.push({ schemaVersion: 1, id: 'shield', name: 'Shield', description: 'Shield', target: 'self', condition: 'always', priority: 1, cooldown: 1, actions: [{ type: 'shield', scaling: 'power' }], tags: [] });
    const original = createCombat(options, content);
    expect(() => stepCombat(original, content)).toThrow(CombatLimitError);
    expect(original.events).toEqual([]);
    expect(original.units[0].shield).toBe(0);
    content.effects[0].internalCooldown = 1;
    expect(() => runCombat(original, content)).not.toThrow();
  });

  it('enforces the independent per-step event budget', () => {
    const content = contentFixture();
    content.balance.maxEventsPerStep = 2;
    expect(() => stepCombat(createCombat(options, content), content)).toThrow(/events per combat step/);
  });
});
