import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { approachCampfire, campfireAvailability, createCombat, enableRoaming, isBodyAlive, leaveEncounter, moveExpedition, partyBodies, restAtCampfire, stepExpedition, stepExpeditionCombat, MOVEMENT_TICK_MS } from '@shards/game-core';
import type { ExpeditionState, GridPoint } from '@shards/shared';
import { gameContent, isFinished } from '../catalog';

import { needsCheckpoint, sessionEnded } from '../session/storage';

/** The hook schedules simulation ticks and storage; all movement/encounter rules live in game-core. */
export function useExpedition(initial: ExpeditionState, onCheckpoint: (state: ExpeditionState) => boolean, onEnded: () => void) {
  const controlledActorId = initial.world.actors[0].id;
  const [state, setState] = useState(initial);
  const current = useRef(state);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState('');
  const [campfireIntent, setCampfireIntent] = useState<{ chunkId: string; poiId: string } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const localBody = state.world.actors.find(actor => actor.id === controlledActorId)?.body;
  const defeated = !state.combat && (!!state.failed || !!localBody && !isBodyAlive(localBody));

  const commit = useCallback((next: ExpeditionState) => {
    if (next === current.current) return;
    const previous = current.current;
    current.current = next;
    setState(next);
    if (sessionEnded(next)) { if (!sessionEnded(previous)) onEnded(); }
    else if (needsCheckpoint(previous, next)) onCheckpoint(next);
  }, [onCheckpoint, onEnded]);

  useEffect(() => {
    if (paused || state.combat || defeated) return;
    const timer = window.setInterval(() => {
      try {
        const previous = current.current;
        const next = stepExpedition(enableRoaming(previous, gameContent), gameContent, MOVEMENT_TICK_MS);
        commit(next);
        if (next.combat) setPlaying(true);
        if (!previous.completed && next.completed) setNotice('Зимний алтарь найден. Вы прошли путь от центра мира до его края.');
      } catch (error) {
        console.error('Exploration step failed', error);
      }
    }, MOVEMENT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [commit, paused, !!state.combat, defeated]);

  const stepCombat = useCallback(() => {
    try {
      const next = stepExpeditionCombat(current.current, gameContent);
      commit(next);
      if (next.combat && isFinished(next.combat)) setPlaying(false);
    } catch {
      setPlaying(false);
      setNotice('Не удалось выполнить ход боя. Выйдите в главное меню и продолжите сессию.');
    }
  }, [commit]);

  useEffect(() => {
    if (paused || !playing || !state.combat || isFinished(state.combat)) return;
    const timer = window.setTimeout(stepCombat, 1150 / speed);
    return () => window.clearTimeout(timer);
  }, [paused, playing, speed, state.combat, stepCombat]);

  const move = useCallback((point: GridPoint) => {
    const fire = current.current.world.chunk.pois.find(poi => poi.kind === 'campfire' && poi.position.x === point.x && poi.position.y === point.y);
    if (fire) {
      const result = approachCampfire(current.current, controlledActorId, fire.id);
      commit(result.state);
      if (result.accepted) setCampfireIntent({ chunkId: result.state.world.currentChunkId, poiId: fire.id });
      setNotice('');
      return;
    }
    setCampfireIntent(null);
    const result = moveExpedition(current.current, controlledActorId, point);
    commit(result.state);
    // The ground cursor explains unavailable destinations without interrupting play.
    setNotice('');
  }, [commit]);

  const continueExploration = useCallback(() => {
    const old = current.current;
    const next = enableRoaming(leaveEncounter(old), gameContent);
    if (next === old) return;
    commit(next);
    setPlaying(false);
    setNotice('');
  }, [commit]);

  const partyKey = state.world.actors.map(actor => actor.id).join(',');
  const healthKey = JSON.stringify(partyBodies(state.world.actors));
  const preview = useMemo(() => createCombat({ seed: state.world.graph.seed, characterIds: partyKey.split(','), heroBodies: partyBodies(state.world.actors), encounterId: gameContent.encounters[0].id, difficultyId: state.difficultyId }, gameContent), [state.world.graph.seed, partyKey, healthKey, state.difficultyId]);
  const campfire = campfireIntent && campfireIntent.chunkId === state.world.currentChunkId && !state.combat && !defeated
    ? campfireAvailability(state, controlledActorId, campfireIntent.poiId) : null;
  useEffect(() => {
    if (state.combat || defeated || campfireIntent && campfireIntent.chunkId !== state.world.currentChunkId) setCampfireIntent(null);
  }, [!!state.combat, defeated, state.world.currentChunkId, campfireIntent]);
  const closeCampfire = useCallback(() => setCampfireIntent(null), []);
  const rest = useCallback(() => {
    if (!campfireIntent || campfireIntent.chunkId !== current.current.world.currentChunkId) return;
    const previous = current.current;
    const next = restAtCampfire(previous, controlledActorId, campfireIntent.poiId);
    commit(next);
    if (next !== previous) setCampfireIntent(null);
  }, [campfireIntent, commit]);

  return {
    world: state.world, controlledActorId, move, combat: state.combat,
    groups: state.roaming?.chunks[state.world.currentChunkId],
    partyState: state.combat ?? preview, playing, speed, setSpeed,
    toggleCombat: () => setPlaying(value => !value), stepCombat, continueExploration,
    current, difficultyId: state.difficultyId ?? 'normal', notice, setNotice, clearedPoiIds: state.clearedPoiIds,
    reducedMotion, setReducedMotion, setPaused,
    campfire, rest, closeCampfire, defeated,
  };
}
