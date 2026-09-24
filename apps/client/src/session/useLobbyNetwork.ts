import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createCoopState } from '@shards/game-core';
import type { RoomRun } from '@shards/protocol';
import type { DifficultyId } from '@shards/shared';
import { gameContent } from '../catalog';
import { NetworkSession } from '../network/session';
import type { LobbyInvitation } from './invitations';
import type { SavedSession } from './storage';

interface LobbyAction { generation: number; token: symbol }

function relayUrl(): string {
  return import.meta.env.VITE_RELAY_URL || (import.meta.env.DEV
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/rsocket`
    : 'wss://sof-ws.ckateptb.dev/rsocket');
}

/** Solo remains local until an invitation is created; joining is only possible from an invitation. */
export function useLobbyNetwork(invitation: LobbyInvitation | null, savedRun?: SavedSession) {
  const [network] = useState(() => new NetworkSession(gameContent));
  const view = useSyncExternalStore(network.subscribe, network.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(invitation?.error ?? null);
  const [roomMissing, setRoomMissing] = useState(!!invitation?.error);
  const [networked, setNetworked] = useState(invitation !== null || !!savedRun?.cooperative);
  const mounted = useRef(false);
  const generation = useRef(0);
  const actionToken = useRef<symbol | null>(null);
  const hadRoom = useRef(false);
  const code = invitation?.code;
  const invitationError = invitation?.error;
  const isInvitation = invitation !== null;
  const resumeRun = useMemo<RoomRun | undefined>(() => savedRun?.cooperative ? {
    seed: savedRun.cooperative.seed, difficultyId: savedRun.cooperative.difficultyId,
    characterIds: [...savedRun.cooperative.characterIds], generatorVersion: 1,
  } : undefined, [savedRun]);

  const current = useCallback((action: LobbyAction): boolean => mounted.current
    && generation.current === action.generation && actionToken.current === action.token, []);

  const begin = useCallback((): LobbyAction | null => {
    if (!mounted.current || actionToken.current) return null;
    const action = { generation: generation.current, token: Symbol('lobby action') };
    actionToken.current = action.token;
    setBusy(true);
    setError(null);
    setRoomMissing(false);
    return action;
  }, []);

  const finish = useCallback((action: LobbyAction) => {
    if (!current(action)) return;
    actionToken.current = null;
    setBusy(false);
  }, [current]);

  const fail = useCallback((action: LobbyAction, cause: unknown) => {
    if (!current(action)) return;
    const roomError = cause instanceof Error && 'code' in cause;
    setRoomMissing(roomError && cause.code === 'ROOM_NOT_FOUND');
    setError(roomError ? cause.message : network.getSnapshot().error ?? (cause instanceof Error ? cause.message : 'Не удалось выполнить сетевое действие.'));
  }, [current, network]);

  const retryJoin = useCallback(async (): Promise<void> => {
    if (!isInvitation) return;
    if (invitationError || !code) {
      if (mounted.current) {
        setRoomMissing(true);
        setError('Комната не существует.');
      }
      return;
    }
    const snapshot = network.getSnapshot();
    if (snapshot.status === 'connected' && snapshot.room?.members.some(member => member.id === snapshot.memberId)) return;
    const action = begin();
    if (!action) return;
    setNetworked(true);
    try {
      await network.connect(relayUrl());
      if (!current(action)) return;
      for (let attempt = 0; attempt < 2; attempt++) {
        const room = await network.inspect(code);
        if (!current(action)) return;
        const allowed = room.run?.characterIds ?? room.heroIds ?? gameContent.characters.map(hero => hero.id);
        const heroId = allowed.find(id => !room.members.some(member => member.ready && member.heroId === id)) ?? allowed[0];
        if (!heroId) throw new Error('В этом походе нет доступных героев.');
        try {
          await network.join({ code, name: 'Путник', heroId });
          if (!current(action)) return;
          hadRoom.current = true;
          return;
        } catch (cause) {
          if (!current(action)) return;
          // Starting can freeze the hero pool between inspect and join.
          if (attempt !== 0 || !(cause instanceof Error) || !('code' in cause) || cause.code !== 'INVALID_HERO') throw cause;
        }
      }
    } catch (cause) { fail(action, cause); }
    finally { finish(action); }
  }, [begin, code, current, fail, finish, invitationError, isInvitation, network]);

  const createRoom = useCallback(async (heroId: string): Promise<string | null> => {
    if (isInvitation || !mounted.current) return null;
    const snapshot = network.getSnapshot();
    if (snapshot.status === 'connected' && snapshot.room && network.isHost) return snapshot.room.code;
    const action = begin();
    if (!action) return null;
    setNetworked(true);
    try {
      await network.connect(relayUrl());
      if (!current(action)) return null;
      if (savedRun?.cooperative) network.prepareResume(savedRun);
      const preferred = savedRun?.hostHeroId ?? resumeRun?.characterIds[0] ?? heroId;
      const selectedHero = resumeRun && !resumeRun.characterIds.includes(heroId) ? preferred : heroId;
      await network.create({ name: 'Хост', heroId: selectedHero }, resumeRun);
      if (!current(action)) return null;
      const created = network.getSnapshot();
      if (created.status !== 'connected' || !created.room || !network.isHost) throw new Error('Не удалось создать приглашение. Повторите попытку.');
      hadRoom.current = true;
      return created.room.code;
    } catch (cause) { fail(action, cause); return null; }
    finally { finish(action); }
  }, [begin, current, fail, finish, isInvitation, network, resumeRun, savedRun]);

  useEffect(() => {
    mounted.current = true;
    ++generation.current;
    actionToken.current = null;
    hadRoom.current = false;
    setBusy(false);
    if (isInvitation) {
      setNetworked(true);
      void retryJoin();
    } else if (resumeRun) {
      setNetworked(true);
      void createRoom(savedRun?.hostHeroId ?? resumeRun.characterIds[0]);
    }
    return () => {
      mounted.current = false;
      ++generation.current;
      actionToken.current = null;
      network.leave();
    };
  }, [createRoom, isInvitation, network, resumeRun, retryJoin, savedRun?.hostHeroId]);

  useEffect(() => {
    if (view.status === 'closed' && hadRoom.current) setRoomMissing(true);
  }, [view.status]);

  const selectHero = useCallback(async (heroId: string): Promise<void> => {
    const action = begin();
    if (!action) return;
    try {
      await network.select(heroId);
      if (!current(action)) return;
    } catch (cause) { fail(action, cause); }
    finally { finish(action); }
  }, [begin, current, fail, finish, network]);

  const setReady = useCallback(async (ready: boolean): Promise<void> => {
    const action = begin();
    if (!action) return;
    try {
      await network.setReady(ready);
      if (!current(action)) return;
    } catch (cause) { fail(action, cause); }
    finally { finish(action); }
  }, [begin, current, fail, finish, network]);

  const startRun = useCallback(async (seed: string, difficulty: DifficultyId): Promise<void> => {
    const action = begin();
    if (!action) return;
    try {
      const room = network.getSnapshot().room;
      if (!room || room.phase !== 'lobby' || !network.isHost) throw new Error('Поход может начать только хост в комнате.');
      if (!room.members.length || room.members.some(member => !member.ready)) {
        setError('Дождитесь готовности всех игроков.');
        return;
      }
      if (!seed.trim()) throw new Error('Укажите сид мира.');
      const state = savedRun?.cooperative ?? createCoopState(seed.trim(), room.members.map(member => member.heroId), gameContent, difficulty);
      await network.start(state);
      if (!current(action)) return;
    } catch (cause) { fail(action, cause); }
    finally { finish(action); }
  }, [begin, current, fail, finish, network, savedRun]);

  const disconnect = useCallback((): void => {
    ++generation.current;
    actionToken.current = null;
    network.leave();
    if (mounted.current) setBusy(false);
  }, [network]);

  return { network, view, busy, error: error ?? (busy ? null : view.error),
    roomMissing: roomMissing || view.status === 'closed' && hadRoom.current,
    networked, createRoom, selectHero, setReady, startRun, retryJoin, disconnect };
}
