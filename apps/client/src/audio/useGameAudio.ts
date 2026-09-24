import { useEffect, useMemo, useRef } from 'react';
import type { ExpeditionState, GameContent } from '@shards/shared';
import { isBodyAlive } from '@shards/game-core';
import { initAudio, playSound, restoreMenuAudioScene, setAudioScene } from './engine';
import { fireRemaining } from '../world/poiInteraction';
import type { MusicScene } from './types';

/** Presentation-only observations; initial saves and reconnection snapshots establish a silent baseline. */
export function useGameAudio(state: ExpeditionState, content: GameContent, actorId: string, battleKey?: string, snapshotEpoch = 0) {
  const { world, combat, progression } = state;
  const actor = world.actors.find(unit => unit.id === actorId);
  const progress = progression?.heroes[actorId];
  const bosses = state.bosses ?? state.cooperative?.bosses;
  const nearFire = !combat && !!actor && world.chunk.pois.some(poi => poi.kind === 'campfire'
    && Math.hypot(poi.position.x - actor.position.x, poi.position.y - actor.position.y) <= 3
    && fireRemaining(poi.id, world.tick, progression?.campfires) > 0);
  const enemies = combat?.units.filter(unit => unit.team === 'enemies').map(unit => unit.definitionId).join('|');
  const scene = useMemo<MusicScene>(() => {
    const surroundings = { season: world.chunk.season, underground: world.chunk.layer === 'basement' };
    // Keep the battle theme through the last presented impact, until its overlay leaves.
    if (combat) {
      const definitions = combat.units.filter(unit => unit.team === 'enemies').map(unit => content.enemies.find(enemy => enemy.id === unit.definitionId));
      if (definitions.some(enemy => enemy?.tags.includes('BOSS'))) return { ...surroundings, kind: 'boss', threat: 2 };
      const hostile = combat.units.filter(unit => unit.team === 'enemies');
      const party = combat.units.filter(unit => unit.team === 'heroes');
      const pressure = hostile.reduce((sum, unit) => sum + unit.stats.power, 0) / Math.max(1, party.reduce((sum, unit) => sum + unit.stats.power, 0));
      const threat = definitions.some(enemy => enemy?.rank === 'ELITE') || pressure >= 2.1 ? 2
        : definitions.some(enemy => enemy?.rank === 'VETERAN') || pressure >= 1.25 ? 1 : 0;
      return { ...surroundings, kind: 'battle', threat };
    }
    if (state.completed) return { ...surroundings, kind: 'victory' };
    if (state.failed) return { ...surroundings, kind: 'defeat' };
    return { ...surroundings, kind: nearFire ? 'camp' : 'exploration' };
  }, [battleKey, enemies, !!combat, world.chunk.season, world.chunk.layer, nearFire, state.completed, state.failed]);

  useEffect(() => {
    const release = initAudio();
    return () => { restoreMenuAudioScene(); release(); };
  }, []);
  useEffect(() => setAudioScene(scene), [scene]);

  const previous = useRef<{ state: ExpeditionState; actorId: string; snapshotEpoch: number } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { state, actorId, snapshotEpoch };
    if (!before || before.actorId !== actorId || before.snapshotEpoch !== snapshotEpoch || before.state.world.graph.seed !== world.graph.seed) return;
    const old = before.state;
    const oldActor = old.world.actors.find(unit => unit.id === actorId);
    const priorProgress = old.progression?.heroes[actorId];
    if (actor && oldActor && !combat && !old.combat) {
      if (world.currentChunkId !== old.world.currentChunkId) {
        const transition = old.world.chunk.pois.find(poi => poi.destination?.chunkId === world.currentChunkId
          && Math.hypot(poi.position.x - oldActor.position.x, poi.position.y - oldActor.position.y) <= 1);
        if (transition) playSound(transition.kind === 'portal' ? 'portal' : 'stairs', { volume: .75 });
      } else {
        const distance = Math.hypot(actor.position.x - oldActor.position.x, actor.position.y - oldActor.position.y);
        if (distance > 0 && distance <= 1.5) playSound('step', { volume: .22,
          intensity: world.chunk.layer === 'basement' ? .8 : world.chunk.season === 'winter' ? .2 : .45 });
      }
    }
    if (progress && priorProgress && progress !== priorProgress) {
      const sources = new Set(priorProgress.claimedSources);
      const received = progress.claimedSources.filter(source => !sources.has(source));
      if (received.some(source => source.startsWith('chest:'))) playSound('chest', { volume: .8 });
      else if (received.some(source => source.startsWith('well:'))) playSound('well', { volume: .7 });
      else if (!combat && progress.rewards.length > priorProgress.rewards.length) playSound('loot', { volume: .55 });
      if (!combat && progress.coins > priorProgress.coins) playSound('coin', { volume: .38 });
      if (!combat && (progress.npcPurchases?.length ?? 0) > (priorProgress.npcPurchases?.length ?? 0)) playSound('coin', { volume: .38 });
      if (JSON.stringify(progress.equipment) !== JSON.stringify(priorProgress.equipment)
        || JSON.stringify(progress.skills) !== JSON.stringify(priorProgress.skills)
        || JSON.stringify(progress.nativeSkillRarities) !== JSON.stringify(priorProgress.nativeSkillRarities)) playSound('equip', { volume: .65 });
    }
    for (const revived of world.actors) {
      const previous = old.world.actors.find(actor => actor.id === revived.id);
      if (previous?.reviveUntilTick !== undefined && revived.reviveUntilTick === undefined && revived.body && isBodyAlive(revived.body)) playSound('heal', { volume: .5 });
    }
    const oldSpawns = new Set((old.bosses ?? old.cooperative?.bosses)?.spawned.map(spawn => spawn.mobId));
    if (bosses?.spawned.some(spawn => !oldSpawns.has(spawn.mobId) && spawn.chunkId === world.currentChunkId)) playSound('bossArrival', { volume: .8 });
    if (!combat && !old.completed && state.completed) playSound('victory', { volume: .6 });
    if (!combat && !old.failed && state.failed) playSound('defeat', { volume: .55 });
  }, [state, actorId, snapshotEpoch]);

  useEffect(() => {
    if (!nearFire || state.failed || state.completed) return;
    playSound('campfire', { volume: .22 });
    const timer = setInterval(() => playSound('campfire', { volume: .2 }), 6100);
    return () => clearInterval(timer);
  }, [nearFire, state.failed, state.completed]);
}
