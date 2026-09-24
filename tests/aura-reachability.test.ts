import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { createCombat, modifiersFor, submitCombatAction } from '@shards/game-core';
import type { CombatState, GameContent, SkillDefinition } from '@shards/shared';
import { runAttackTurn } from '../packages/game-core/src/attack-turn';
import { createContext } from '../packages/game-core/src/events';
import { traceAuraReachability } from '../tools/content-validator/src/aura-reachability';

describe('aura gameplay reachability', () => {
  it('connects every authored aura to an obtainable skill or an owned passive', () => {
    const result = traceAuraReachability(gameContent);
    expect(result.unreachableStatusIds).toEqual([]);
    expect(result.reachableStatusIds).toHaveLength(gameContent.statuses.length);
    expect(result.routes.some(route => route.statusId === 'haste' && route.sourceId === 'exit_between_heartbeats')).toBe(true);
  });

  it('does not count orphan effects, zero duration, disabled hooks or impossible target relations', () => {
    const content = structuredClone(gameContent);
    content.characters = content.characters.map(unit => ({ ...unit, skillIds: [], effectIds: [] }));
    content.enemies = [];
    const skill: SkillDefinition = { schemaVersion: 1, id: 'root', name: 'root', description: 'root',
      target: 'self', cooldown: 1, priority: 1, condition: 'always', tags: ['LEARNABLE'], rarity: 'common',
      actions: [{ type: 'status', statusId: 'haste', duration: 3, targetRelation: 'enemy' },
        { type: 'status', statusId: 'burning', duration: 0 }, { type: 'status', statusId: 'regrowth', duration: 3 },
        { type: 'damage', onHitStatusId: 'poisoned', hits: 0 }] };
    content.skills = [skill];
    const regrowth = content.statuses.find(status => status.id === 'regrowth')!;
    delete regrowth.trigger;
    regrowth.actions = [{ type: 'status', statusId: 'inspired', duration: 3 }];
    expect(traceAuraReachability(content).reachableStatusIds).toEqual(['regrowth']);
    regrowth.trigger = 'TURN_STARTED';
    expect(traceAuraReachability(content).reachableStatusIds).toEqual(['inspired', 'regrowth']);
    expect(traceAuraReachability(content, { skillIds: new Set() }).reachableStatusIds).toEqual([]);
  });

  it('actually applies all 150 catalog auras through production combat actions and passive dispatch', () => {
    // A durable combat sandbox isolates application from target death. Dice,
    // selectors, per-hit checks, action order and passive dispatch are production code.
    const bases = new Map<string, CombatState>();
    function battleFor(heroId: string): CombatState {
      if (!bases.has(heroId)) {
        const state = createCombat({ seed: 'aura-runtime', encounterId: 'aura-runtime',
          characterIds: [...new Set([heroId, 'guardian', 'priest', 'mage'])], enemyIds: ['spider'] }, gameContent);
        for (const unit of state.units) {
          delete unit.body;
          unit.stats.maxHp = 10_000;
          unit.hp = 5_000;
        }
        state.status = 'running'; state.turn = 1; state.round = 1;
        bases.set(heroId, state);
      }
      return bases.get(heroId)!;
    }
    const observed = new Set<string>();
    const routes = traceAuraReachability(gameContent).routes;
    const nativeIds = new Set([...gameContent.characters, ...gameContent.enemies].flatMap(unit => unit.skillIds));
    const candidates = gameContent.skills.filter(skill => (skill.rarity || nativeIds.has(skill.id))
      && routes.some(route => route.sourceType === 'skill' && route.sourceId === skill.id));
    // This native heal also demonstrates that priest_benediction really fires;
    // a reference to its effect definition alone would not prove application.
    candidates.unshift(gameContent.skills.find(skill => skill.id === 'healer_mend')!);
    for (const skill of candidates) {
      const expected = routes.filter(route => route.sourceType === 'skill' && route.sourceId === skill.id).map(route => route.statusId);
      if (expected.length && expected.every(id => observed.has(id))) continue;
      const nativeHero = gameContent.characters.find(unit => unit.skillIds.includes(skill.id));
      const nativeEnemy = gameContent.enemies.find(unit => unit.skillIds.includes(skill.id) && unit.id === 'spider');
      // Learnable rewards occupy one of the two learned slots in the hero's
      // effective definition, just as coop progression builds that definition.
      const ownerId = nativeHero?.id ?? nativeEnemy?.id ?? 'guardian';
      const content: GameContent = { ...gameContent, characters: gameContent.characters.map(hero => hero.id === ownerId && skill.rarity
        ? { ...hero, skillIds: [...hero.skillIds.filter(id => !gameContent.skills.find(entry => entry.id === id)?.rarity), skill.id] } : hero) };
      if (!skill.rarity && !nativeHero && !nativeEnemy) continue;
      for (let attempt = 0; attempt < 24; attempt++) {
        const state = structuredClone(battleFor(nativeHero?.id ?? 'guardian'));
        state.rng.seed = `aura-runtime:${skill.id}:${attempt}`;
        const actor = state.units.find(unit => unit.definitionId === ownerId)!;
        const target = skill.target === 'self' ? actor
          : ['ally', 'lowestHealthAlly', 'allAllies', 'randomAlly'].includes(skill.target) || ['any', 'randomUnit'].includes(skill.target) && attempt % 2 === 0
            ? state.units.find(unit => unit.team === actor.team && unit !== actor) ?? actor
            : state.units.find(unit => unit.team !== actor.team)!;
        if (actor.team === 'heroes') {
          state.pendingActorId = actor.id;
          const after = submitCombatAction(state, content, { type: 'skill', actorId: actor.id, skillId: skill.id,
            ...(['randomEnemy', 'randomAlly', 'randomUnit'].includes(skill.target) ? {} : { targetId: target.id }) });
          after.events.forEach(event => { if (event.type === 'STATUS_APPLIED' && event.statusId) observed.add(event.statusId); });
        } else {
          runAttackTurn(createContext(state, content), actor, skill.actions, skill.target, skill.id, target.id);
          state.events.forEach(event => { if (event.type === 'STATUS_APPLIED' && event.statusId) observed.add(event.statusId); });
        }
        if (expected.length && expected.every(id => observed.has(id))) break;
        if (!expected.length && observed.has('inspired')) break;
      }
    }
    expect(gameContent.statuses.filter(status => !observed.has(status.id)).map(status => status.id)).toEqual([]);
    expect(observed.size).toBe(gameContent.statuses.length);
  }, 30_000);

  it('makes the reachable haste useful in the current battle without rerolling initiative', () => {
    const state = createCombat({ seed: 'haste-live', encounterId: 'haste-live', characterIds: ['guardian'], enemyIds: ['spider'] }, gameContent);
    const actor = state.units[0], context = createContext(state, gameContent);
    const before = modifiersFor(context, actor);
    const haste = gameContent.skills.find(skill => skill.id === 'exit_between_heartbeats')!;
    runAttackTurn(context, actor, haste.actions, haste.target, haste.id, actor.id);
    expect(actor.statuses.find(status => status.id === 'haste')?.remaining).toBe(3);
    const after = modifiersFor(context, actor);
    expect(after.evasionBonus - before.evasionBonus).toBe(2);
    expect(after.agilityBonus - before.agilityBonus).toBe(3);
    expect(after.initiativeBonus).toBe(before.initiativeBonus);
  });

  it('triggers both owned passive aura hooks from real healing and critical hit events', () => {
    const base = createCombat({ seed: 'aura-hooks', encounterId: 'aura-hooks',
      characterIds: ['priest', 'mage'], enemyIds: ['spider'] }, gameContent);
    for (const unit of base.units) { delete unit.body; unit.hp = 1_000; unit.stats.maxHp = 2_000; }
    const priest = base.units.find(unit => unit.definitionId === 'priest')!;
    const healing = gameContent.skills.find(skill => skill.id === 'healer_mend')!;
    runAttackTurn(createContext(base, gameContent), priest, healing.actions, healing.target, healing.id, priest.id);
    expect(base.events.some(event => event.type === 'HEALED' && event.actorId === priest.id)).toBe(true);
    expect(base.events.some(event => event.type === 'STATUS_APPLIED' && event.actorId === priest.id && event.statusId === 'inspired')).toBe(true);
    let criticalHookApplied = false;
    for (let attempt = 0; attempt < 64 && !criticalHookApplied; attempt++) {
      const state = structuredClone(base);
      state.events = []; state.rng.seed = `aura-critical-hook:${attempt}`;
      const mage = state.units.find(unit => unit.definitionId === 'mage')!;
      const enemy = state.units.find(unit => unit.team === 'enemies')!;
      runAttackTurn(createContext(state, gameContent), mage, [gameContent.characters.find(unit => unit.id === 'mage')!.basicAttack], 'enemy', undefined, enemy.id);
      criticalHookApplied = state.events.some(event => event.type === 'CRIT' && event.actorId === mage.id)
        && state.events.some(event => event.type === 'STATUS_APPLIED' && event.actorId === mage.id && event.statusId === 'burning');
    }
    expect(criticalHookApplied).toBe(true);
  });
});
