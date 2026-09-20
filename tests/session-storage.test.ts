import { describe, expect, it } from 'vitest';
import { createCombat, createExpedition, stepExpeditionCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { clearPrototypeSaves, needsCheckpoint, readSession, saveSession, SESSION_STORAGE_KEY, sessionEnded, type SessionStorage } from '../apps/client/src/session/storage';

function storage(): SessionStorage {
  const values = new Map<string,string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key,value) => { values.set(key,value); }, removeItem: key => { values.delete(key); } };
}
const identity = { id: 'one-run', startedAt: 100 };

describe('single local session checkpoints', () => {
  it('saves exactly one hero with seed, difficulty, wounds and identity', () => {
    const store = storage();
    const state = createExpedition('SESSION', ['ranger'], gameContent, 'hard');
    state.world.actors[0].body!.leftLeg.current = 1;
    saveSession(store, identity, state, gameContent, 120);
    const restored = readSession(store, gameContent)!;
    expect(restored.id).toBe('one-run');
    expect(restored.savedAt).toBe(120);
    expect(restored.state.difficultyId).toBe('hard');
    expect(restored.state.world.graph.seed).toBe('SESSION');
    expect(restored.state.world.actors.map(actor => actor.id)).toEqual(['ranger']);
    expect(restored.state.world.actors[0].body!.leftLeg.current).toBe(1);
  });
  it('replaces the old slot atomically only when the new run is saved', () => {
    const store = storage();
    const old = createExpedition('OLD', ['guardian'], gameContent);
    const saved = saveSession(store, identity, old, gameContent)!;
    const next = createExpedition('NEW', ['mage'], gameContent, 'nightmare');
    expect(readSession(store, gameContent)!.state.world.graph.seed).toBe('OLD');
    saveSession(store, { ...saved, id: 'new-run' }, next, gameContent);
    const encoded = JSON.parse(store.getItem(SESSION_STORAGE_KEY)!);
    expect(Object.keys(encoded).sort()).toEqual(['id','savedAt','snapshot','startedAt','version']);
    expect(readSession(store, gameContent)!.state.world.actors[0].id).toBe('mage');
    expect(readSession(store, gameContent)!.id).toBe('new-run');
  });
  it('does not destroy the previous checkpoint if storage rejects a replacement', () => {
    const store = storage();
    const state = createExpedition('OLD', ['guardian'], gameContent);
    saveSession(store, identity, state, gameContent);
    expect(() => saveSession({ ...store, setItem: () => { throw new Error('quota'); } }, { ...identity, id: 'new' }, state, gameContent)).toThrow('quota');
    expect(readSession(store, gameContent)!.id).toBe(identity.id);
  });
  it('checkpoints chunk transitions and leaving combat, not ordinary movement or battle turns', () => {
    const state = createExpedition('CHECKPOINT', ['guardian'], gameContent);
    const next = structuredClone(state);
    next.world.actors[0].position.x++;
    expect(needsCheckpoint(state, next)).toBe(false);
    next.world.currentChunkId = '0,-1';
    expect(needsCheckpoint(state, next)).toBe(true);
    const combat = createCombat({seed:'fight',characterIds:['guardian'],encounterId:gameContent.encounters[0].id},gameContent);
    const battle = {...state,combat};
    expect(needsCheckpoint(state,battle)).toBe(false);
    expect(needsCheckpoint(battle,stepExpeditionCombat(battle,gameContent))).toBe(false);
    expect(needsCheckpoint(battle,{...battle,combat:{...combat,status:'victory'}})).toBe(true);
    expect(needsCheckpoint(battle,state)).toBe(true);
  });
  it('deletes the previous checkpoint as soon as the player dies in combat', () => {
    const store = storage();
    const state = createExpedition('DEATH', ['guardian'], gameContent);
    saveSession(store, identity, state, gameContent);
    state.combat = createCombat({seed:'fight',characterIds:['guardian'],encounterId:gameContent.encounters[0].id},gameContent);
    state.combat.units[0].body!.head.current = 0;
    expect(sessionEnded(state)).toBe(true);
    expect(saveSession(store,identity,state,gameContent)).toBeNull();
    expect(readSession(store,gameContent)).toBeNull();
  });
  it('does not revive dead heroes, failed runs or draw outcomes', () => {
    const state = createExpedition('DEATH', ['guardian'], gameContent);
    expect(sessionEnded({...state,failed:true})).toBe(true);
    for (const part of ['head','torso'] as const) {
      const dead = structuredClone(state); dead.world.actors[0].body![part].current=0;
      expect(sessionEnded(dead)).toBe(true);
    }
    const dead = structuredClone(state);
    for (const part of ['leftLeg','rightLeg','leftArm','rightArm'] as const) dead.world.actors[0].body![part].current=0;
    expect(sessionEnded(dead)).toBe(true);
  });
  it('rejects party saves and clears only obsolete prototype slots', () => {
    const store = storage();
    expect(() => saveSession(store,identity,createExpedition('COOP',['guardian','priest'],gameContent),gameContent)).toThrow('one player');
    store.setItem('shards-of-fate:expedition:v3','old'); store.setItem('unrelated','keep');
    clearPrototypeSaves(store);
    expect(store.getItem('shards-of-fate:expedition:v3')).toBeNull();
    expect(store.getItem('unrelated')).toBe('keep');
    expect(readSession(store,gameContent)).toBeNull();
  });
});
