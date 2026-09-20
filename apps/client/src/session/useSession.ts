import { useCallback, useState } from 'react';
import { createExpedition } from '@shards/game-core';
import type { DifficultyId, ExpeditionState } from '@shards/shared';
import { gameContent } from '../catalog';
import { clearPrototypeSaves, createSessionId, readSession, saveSession, SESSION_STORAGE_KEY, sessionEnded, type SavedSession } from './storage';

export type SessionScreen = 'menu' | 'lobby' | 'game' | 'settings' | 'exit';
function initialSave(): { saved: SavedSession | null; error: string } {
  try { clearPrototypeSaves(localStorage); return { saved: readSession(localStorage, gameContent), error: '' }; }
  catch { return { saved: null, error: 'Не удалось прочитать сохранение. Можно начать новую игру.' }; }
}

export function useSession() {
  const [initial] = useState(initialSave);
  const [saved, setSaved] = useState(initial.saved);
  const [active, setActive] = useState<SavedSession | null>(null);
  const [screen, setScreen] = useState<SessionScreen>('menu');
  const [error, setError] = useState(initial.error);

  const start = useCallback((characterId: string, difficultyId: DifficultyId, seed: string) => {
    try {
      const state = createExpedition(seed.trim(), [characterId], gameContent, difficultyId);
      const session = saveSession(localStorage, { id: createSessionId(), startedAt: Date.now() }, state, gameContent);
      setSaved(session); setActive(session); setScreen('game'); setError('');
    } catch { setError('Не удалось начать игру. Проверьте seed и доступность хранилища браузера.'); }
  }, []);

  const resume = useCallback(() => {
    try {
      const session = readSession(localStorage, gameContent);
      setSaved(session);
      if (!session) { setError('Сессия уже завершена или сохранение отсутствует.'); return; }
      setActive(session); setScreen('game'); setError('');
    } catch { setSaved(null); setError('Сохранение повреждено или несовместимо. Начните новую игру.'); }
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

  return { saved, active, screen, setScreen, error, setError, start, resume, checkpoint, end, leave };
}
