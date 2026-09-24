import { lazy, Suspense, useEffect, useState } from 'react';
import { ExpeditionGame } from './ExpeditionGame';
import { useSession } from './session/useSession';
import { MainMenu } from './session/MainMenu';
import { Lobby } from './session/Lobby';
import { MenuFrame } from './session/MenuFrame';
import { NewGameDialog } from './session/NewGameDialog';
import { clearInvitation, readInvitation } from './session/invitations';
import './session/session.css';
import { AudioSettingsPanel } from './components/AudioSettings';
import { initAudio, setMenuAudioScene } from './audio/engine';

const KnowledgeBase = lazy(() => import('./knowledge/KnowledgeBase').then(module => ({ default: module.KnowledgeBase })));

export function App() {
  const [invitation, setInvitation] = useState(readInvitation);
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const session = useSession(invitation ? 'lobby' : 'menu');
  const { setScreen, clearLobbySave } = session;
  useEffect(initAudio, []);
  useEffect(() => {
    if (session.screen !== 'game') setMenuAudioScene({ kind: session.screen === 'lobby' ? 'camp' : 'menu', season: 'spring' });
  }, [session.screen]);
  useEffect(() => {
    const navigate = () => {
      const next = readInvitation();
      setConfirmNewGame(false);
      clearLobbySave();
      setInvitation(current => current?.code === next?.code && current?.error === next?.error ? current : next);
      if (next) setScreen('lobby');
      else if (invitation) setScreen('menu');
    };
    window.addEventListener('hashchange', navigate);
    window.addEventListener('popstate', navigate);
    return () => {
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('popstate', navigate);
    };
  }, [clearLobbySave, invitation, setScreen]);
  const back = () => { setConfirmNewGame(false); clearLobbySave(); clearInvitation(); setInvitation(null); setScreen('menu'); };
  const openNewGame = () => { setConfirmNewGame(false); clearLobbySave(); clearInvitation(); setInvitation(null); setScreen('lobby'); };
  const newGame = () => { if (session.saved) setConfirmNewGame(true); else openNewGame(); };
  const exit = () => { session.setScreen('exit'); try { window.close(); } catch { /* The browser may keep user-opened tabs alive. */ } };
  return <>
    {session.screen === 'lobby' ? <Lobby key={invitation ? `invite:${invitation.code || 'invalid'}` : session.lobbySave ? `resume:${session.lobbySave.id}` : 'solo'} invitation={invitation} savedRun={session.lobbySave ?? undefined} onBack={back} onStart={session.start} /> : session.screen === 'game' && session.active
      ? <ExpeditionGame key={session.active.id} initial={session.active.state} onCheckpoint={session.checkpoint} onEnded={session.end} onLeave={session.leave} />
      : <MenuFrame>
        {session.screen === 'menu' && <MainMenu saved={session.saved} onContinue={session.resume} onNew={newGame} onKnowledge={() => session.setScreen('knowledge')} onSettings={() => session.setScreen('settings')} onExit={exit} />}
        {session.screen === 'knowledge' && <Suspense fallback={<section className="menu-message" aria-busy="true"><h1>База знаний</h1><p>Открываем страницы…</p><button className="secondary-button" onClick={back}>В главное меню</button></section>}><KnowledgeBase onBack={back} /></Suspense>}
        {session.screen === 'settings' && <section className="menu-message menu-audio-settings"><span className="eyebrow">Звуки путешествия</span><h1>Настройки</h1><AudioSettingsPanel /><button className="secondary-button" onClick={back}>В главное меню</button></section>}
        {session.screen === 'exit' && <section className="menu-message"><span className="eyebrow">До следующего путешествия</span><h1>Можно закрыть вкладку</h1><p>Игра остановлена. Ваше последнее автосохранение осталось здесь.</p><button className="secondary-button" onClick={back}>В главное меню</button></section>}
      </MenuFrame>}
    {confirmNewGame && session.screen === 'menu' && session.saved && <NewGameDialog onCancel={() => setConfirmNewGame(false)} onConfirm={openNewGame} />}
    {session.error && <div className="session-error" role="alert"><span>{session.error}</span><button aria-label="Закрыть сообщение" onClick={() => session.setError('')}>×</button></div>}
  </>;
}
