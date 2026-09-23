import { useCallback, useEffect, useRef, useState } from 'react';
import { createExpedition } from '@shards/game-core';
import type { DifficultyId, ExpeditionState } from '@shards/shared';
import { gameContent } from '../catalog';
import { clearPrototypeSaves, createSessionId, readSession, saveSession, SESSION_STORAGE_KEY, sessionEnded, type SavedNetworkSession, type SavedSession, type SavedSoloSession } from './storage';

export type SessionScreen = 'menu' | 'lobby' | 'game' | 'settings' | 'exit';
function initialSave(): { saved: SavedSession | null; error: string } {
  try { clearPrototypeSaves(localStorage); return { saved: readSession(localStorage, gameContent), error: '' }; }
  catch { return { saved: null, error: 'Не удалось прочитать сохранение. Можно начать новую игру.' }; }
}

export function useSession(initialScreen: SessionScreen = 'menu') {
  const [initial] = useState(initialSave);
  const [saved, setSaved] = useState(initial.saved);
  const [active, setActive] = useState<SavedSoloSession | null>(null);
  const [lobbySave, setLobbySave] = useState<SavedNetworkSession | null>(null);
  const [screen, setScreen] = useState<SessionScreen>(initialScreen);
  const [error, setError] = useState(initial.error);
  const wasMenu = useRef(initialScreen === 'menu');

  useEffect(() => {
    const returning = screen === 'menu' && !wasMenu.current;
    wasMenu.current = screen === 'menu';
    if (!returning) return;
    setActive(null);
    setLobbySave(null);
    // The authoritative network session writes host checkpoints independently.
    try { setSaved(readSession(localStorage, gameContent)); }
    catch { setSaved(null); setError('Не удалось прочитать сохранение. Можно начать новую игру.'); }
  }, [screen]);

  const clearLobbySave = useCallback(() => setLobbySave(null), []);

  const start = useCallback((characterId: string, difficultyId: DifficultyId, seed: string) => {
    try {
      const state = createExpedition(seed.trim(), [characterId], gameContent, difficultyId);
      const session = saveSession(localStorage, { id: createSessionId(), startedAt: Date.now() }, state, gameContent);
      setSaved(session); setActive(session); setLobbySave(null); setScreen('game'); setError('');
    } catch { setError('Не удалось начать игру. Проверьте seed и доступность хранилища браузера.'); }
  }, []);

  const resume = useCallback(() => {
    try {
      const session = readSession(localStorage, gameContent);
      setSaved(session);
      if (!session) { setError('Сессия уже завершена или сохранение отсутствует.'); return; }
      if (session.cooperative) {
        setActive(null); setLobbySave(session); setScreen('lobby');
      } else {
        setLobbySave(null); setActive(session); setScreen('game');
      }
      setError('');
    } catch { setSaved(null); setActive(null); setLobbySave(null); setError('Сохранение повреждено или несовместимо. Начните новую игру.'); }
  }, []);

  const checkpoint = useCallback((state: ExpeditionState): boolean => {
    if (!active) return false;
    try {
      setSaved(saveSession(localStorage, active, state, gameContent));
      setError(''); return true;
    } catch { setError('Не удалось сохранить сессию: хранилище браузера недоступно.'); return false; }
  }, [active]);

  const end = useCallback(() => {
    setSaved(null);
    try { localStorage.removeItem(SESSION_STORAGE_KEY); }
    catch { setError('Не удалось удалить сохранение завершённой сессии.'); }
  }, []);

  const leave = useCallback((state: ExpeditionState) => {
    if (sessionEnded(state)) end();
    else if (!checkpoint(state)) return;
    setActive(null); setScreen('menu');
  }, [checkpoint, end]);

  return { saved, active, lobbySave, clearLobbySave, screen, setScreen, error, setError, start, resume, checkpoint, end, leave };
}
