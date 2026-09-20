import { ExpeditionGame } from './ExpeditionGame';
import { useSession } from './session/useSession';
import { MainMenu } from './session/MainMenu';
import { Lobby } from './session/Lobby';
import { MenuFrame } from './session/MenuFrame';
import './session/session.css';

export function App() {
  const session = useSession();
  const back = () => session.setScreen('menu');
  const exit = () => { session.setScreen('exit'); try { window.close(); } catch { /* The browser may keep user-opened tabs alive. */ } };
  return <>
    {session.screen === 'game' && session.active
      ? <ExpeditionGame key={session.active.id} initial={session.active.state} onCheckpoint={session.checkpoint} onEnded={session.end} onLeave={session.leave} />
      : <MenuFrame>
        {session.screen === 'menu' && <MainMenu saved={session.saved} onContinue={session.resume} onNew={() => session.setScreen('lobby')} onSettings={() => session.setScreen('settings')} onExit={exit} />}
        {session.screen === 'lobby' && <Lobby hasSave={!!session.saved} onBack={back} onStart={session.start} />}
        {session.screen === 'settings' && <section className="menu-message"><span className="eyebrow">У костра</span><h1>Настройки</h1><p>Этот раздел появится позже.</p><button className="secondary-button" onClick={back}>В главное меню</button></section>}
        {session.screen === 'exit' && <section className="menu-message"><span className="eyebrow">До следующего путешествия</span><h1>Можно закрыть вкладку</h1><p>Игра остановлена. Ваше последнее автосохранение осталось здесь.</p><button className="secondary-button" onClick={back}>В главное меню</button></section>}
      </MenuFrame>}
    {session.error && <div className="session-error" role="alert"><span>{session.error}</span><button aria-label="Закрыть сообщение" onClick={() => session.setError('')}>×</button></div>}
  </>;
}
