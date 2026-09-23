import { describe, expect, it } from 'vitest';
import type { ActionDefinition, CombatState, GameContent, SkillDefinition, StatusDefinition, TargetSelector } from '@shards/shared';
import { createCombat, runCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { contentFixture, deepFreeze, hero, options } from '../packages/game-core/src/__tests__/fixtures';
import { simulationPolicy, rankSimulationChoices } from '../packages/game-core/src/simulation-policy';
import { validateCombatChoice } from '../packages/game-core/src/combat-choice';
import { syncBodyCombatant } from '../packages/game-core/src/anatomy';

function addSkill(content: GameContent, id: string, target: TargetSelector, actions: ActionDefinition[], cooldown = 3): SkillDefinition {
  const skill: SkillDefinition = { schemaVersion: 1, id, name: id, description: id, target, actions, cooldown, priority: 100, condition: 'always', tags: [] };
  content.skills.push(skill);
  content.characters[0].skillIds.push(id);
  return skill;
}

function addStatus(content: GameContent, id: string, modifiers: StatusDefinition['modifiers'], actions: ActionDefinition[] = []): void {
  content.statuses.push({ schemaVersion: 1, id, name: id, description: id, color: '#ffffff', modifiers, actions, tags: [], stacking: 'refresh',
    ...(actions.length ? { trigger: 'TURN_STARTED' as const } : {}) });
}

function pending(content: GameContent, enemyCount = 1): CombatState {
  const state = createCombat({ ...options, characterIds: content.characters.map(character => character.id), enemyIds: Array.from({ length: enemyCount }, () => 'enemy') }, content);
  state.status = 'running';
  state.round = 1;
  state.turn = 1;
  state.pendingActorId = state.units[0].id;
  return state;
}

describe('offline simulation decisions', () => {
  it('is deterministic and cannot change state, events, content or any random stream', () => {
    const content = contentFixture();
    addSkill(content, 'random-burst', 'randomEnemy', [{ type: 'damage', dice: '10d8' }]);
    addSkill(content, 'nested-random', 'self', [{ type: 'damage', dice: '1d6', target: 'randomEnemy' }]);
    const state = pending(content, 3);
    const before = structuredClone(state);
    deepFreeze(state); deepFreeze(content);
    const choice = simulationPolicy(state, content);
    expect(choice).toEqual({ type: 'skill', actorId: state.units[0].id, skillId: 'random-burst' });
    for (let repeat = 0; repeat < 10; repeat++) expect(simulationPolicy(state, content)).toEqual(choice);
    expect(state).toEqual(before);
    expect(() => validateCombatChoice(state, content, choice)).not.toThrow();
  });

  it('makes the same choice when only future random state and dice ownership counters differ', () => {
    const content = contentFixture();
    addSkill(content, 'random-burst', 'randomEnemy', [{ type: 'damage', dice: '5d8' }]);
    const state = pending(content, 2), alternate = structuredClone(state);
    alternate.rng.seed = 'unrelated-future';
    alternate.rng.streams.COMBAT = { state: 314159, counter: 999 };
    alternate.rng.diceIndex = 500;
    alternate.rng.entityDice = { owners: {}, counters: { arbitrary: 1000 } };
    expect(simulationPolicy(alternate, content)).toEqual(simulationPolicy(state, content));
  });

  it('heals a critical surviving torso before spending a turn on an ordinary attack', () => {
    const content = contentFixture();
    content.characters.push(hero('ally'));
    addSkill(content, 'mend', 'ally', [{ type: 'heal', dice: '3d8', scaling: 'power' }]);
    const state = pending(content), ally = state.units[1];
    ally.body!.torso.current = -8;
    syncBodyCombatant(ally, content.characters[1]);
    expect(simulationPolicy(state, content)).toMatchObject({ type: 'skill', skillId: 'mend', targetId: ally.id });
  });

  it('does not heal full bodies or repeatedly heal an irrecoverable missing limb', () => {
    const content = contentFixture();
    addSkill(content, 'mend', 'ally', [{ type: 'heal', dice: '20d8' }]);
    addStatus(content, 'regrowth', {}, [{ type: 'heal', dice: '8d8', target: 'self' }]);
    addSkill(content, 'grow', 'ally', [{ type: 'status', statusId: 'regrowth', duration: 3 }]);
    const state = pending(content), actor = state.units[0];
    expect(simulationPolicy(state, content).type).toBe('attack');
    actor.body!.leftLeg.lost = true;
    actor.body!.leftLeg.current = -Math.ceil(actor.body!.leftLeg.max / 2);
    syncBodyCombatant(actor, content.characters[0]);
    expect(simulationPolicy(state, content).type).toBe('attack');
  });

  it('does not renew an already covered buff or pile shields over adequate protection', () => {
    const content = contentFixture();
    addStatus(content, 'focused', { guaranteedCrit: true });
    addSkill(content, 'focus', 'self', [{ type: 'status', statusId: 'focused', duration: 3 }]);
    addSkill(content, 'ward', 'self', [{ type: 'shield', dice: '10d8', duration: 3 }]);
    const state = pending(content), actor = state.units[0];
    actor.statuses.push({ id: 'focused', sourceId: actor.id, remaining: 3, appliedTurn: 0 });
    actor.shield = 200;
    expect(simulationPolicy(state, content).type).toBe('attack');
  });

  it('values a useful offensive aura in a long fight and stops refreshing it for no gain', () => {
    const content = contentFixture();
    content.enemies[0].stats.maxHp = 500;
    addStatus(content, 'focused', { guaranteedCrit: true });
    addSkill(content, 'focus', 'self', [{ type: 'status', statusId: 'focused', duration: 3 }]);
    const state = pending(content), actor = state.units[0];
    expect(simulationPolicy(state, content)).toMatchObject({ type: 'skill', skillId: 'focus' });
    actor.statuses.push({ id: 'focused', sourceId: actor.id, remaining: 3, appliedTurn: 0 });
    expect(simulationPolicy(state, content).type).toBe('attack');
  });

  it('protects an exposed wounded ally and avoids an already shielded recipient', () => {
    const content = contentFixture();
    content.characters.push(hero('ally'));
    content.enemies[0].stats.power = 35;
    content.enemies[0].stats.maxHp = 500;
    addSkill(content, 'ward', 'ally', [{ type: 'shield', dice: '5d8', duration: 3 }]);
    const state = pending(content), actor = state.units[0], ally = state.units[1];
    actor.shield = 300;
    ally.body!.torso.current = 1;
    syncBodyCombatant(ally, content.characters[1]);
    expect(simulationPolicy(state, content)).toMatchObject({ type: 'skill', skillId: 'ward', targetId: ally.id });
  });

  it('finishes a vulnerable enemy instead of attacking the largest target', () => {
    const content = contentFixture(), state = pending(content, 2);
    const enemies = state.units.filter(unit => unit.team === 'enemies');
    enemies[1].hp = 5;
    const choice = simulationPolicy(state, content);
    expect(choice).toMatchObject({ type: 'attack', targetId: enemies[1].id });
    addStatus(content, 'taunt', { taunt: true });
    enemies[0].statuses.push({ id: 'taunt', sourceId: enemies[0].id, remaining: 2, appliedTurn: 0 });
    expect(simulationPolicy(state, content).targetId).toBe(enemies[0].id);
  });

  it('uses strong offensive skills, respects cooldowns, and does not spend a turn on weaker attacks', () => {
    const content = contentFixture();
    addSkill(content, 'burst', 'enemy', [{ type: 'damage', dice: '4d8', scaling: 'power' }]);
    addSkill(content, 'weak', 'enemy', [{ type: 'damage', dice: '1d2' }]);
    const state = pending(content);
    expect(simulationPolicy(state, content)).toMatchObject({ type: 'skill', skillId: 'burst' });
    state.units[0].cooldowns.burst = 2;
    expect(simulationPolicy(state, content).type).toBe('attack');
  });

  it('accounts for friendly fire when evaluating random-unit skills', () => {
    const content = contentFixture();
    content.characters.push(hero('ally1'), hero('ally2'), hero('ally3'));
    addSkill(content, 'reckless', 'randomUnit', [{ type: 'damage', dice: '12d8' }]);
    const state = pending(content);
    expect(simulationPolicy(state, content).type).toBe('attack');
    expect(rankSimulationChoices(state, content).find(entry => entry.choice.skillId === 'reckless')!.score).toBeLessThan(0);
  });

  it('returns the only legal escape action without functional arms', () => {
    const content = contentFixture(), state = pending(content), actor = state.units[0];
    actor.body!.leftArm.current = 0;
    actor.body!.rightArm.current = 0;
    syncBodyCombatant(actor, content.characters[0]);
    expect(simulationPolicy(state, content)).toEqual({ type: 'flee', actorId: actor.id });
  });

  it('keeps normal play manual and completes deterministic offline battles for solo through four heroes', () => {
    const parties = [...gameContent.characters.map(character => [character.id]), ['guardian', 'priest'], ['vampire', 'druid', 'mage'], ['paladin', 'necromancer', 'rogue', 'ranger']];
    for (const characterIds of parties) {
      const initial = createCombat({ seed: `policy:${characterIds.join(':')}`, characterIds, enemyIds: ['goblin_scout', 'slime'], encounterId: 'roaming' }, gameContent);
      const manual = runCombat(initial, gameContent);
      expect(manual.status).toBe('running');
      expect(manual.pendingActorId).toBeTruthy();
      const result = runCombat(initial, gameContent, (state, content) => {
        const choice = simulationPolicy(state, content);
        expect(() => validateCombatChoice(state, content, choice)).not.toThrow();
        return choice;
      });
      expect(['victory', 'defeat', 'draw', 'escaped']).toContain(result.status);
      expect(result).toEqual(runCombat(initial, gameContent, simulationPolicy));
    }
  }, 60_000);
});
