import { DIFFICULTY_PROFILES } from '@shards/game-data';
import { findDefinition } from '../catalog';
import type { SavedSession } from './storage';

export function MainMenu({ saved, onContinue, onNew, onSettings, onExit }: { saved: SavedSession | null; onContinue: () => void; onNew: () => void; onSettings: () => void; onExit: () => void }) {
  return <section className="main-menu" aria-labelledby="main-menu-title">
    <div className="menu-sigil" aria-hidden="true">✧</div>
    <span className="eyebrow">У каждого пути своя цена</span>
    <h1 id="main-menu-title">Осколки<br />судьбы</h1>
    <div className="menu-divider" aria-hidden="true"><span />◆<span /></div>
    <nav className="main-menu-actions" aria-label="Главное меню">
      <button onClick={onContinue} disabled={!saved} className="main-menu-continue"><span>Продолжить</span>{saved && <small>{saved.cooperative && 'Сетевая игра · '}{findDefinition(saved.hostHeroId ?? saved.state.world.actors[0].id).name} · {DIFFICULTY_PROFILES[saved.state.difficultyId ?? 'normal'].name}</small>}</button>
      <button onClick={onNew}>Новая игра</button>
      <button onClick={onSettings}>Настройки</button>
      <button onClick={onExit}>Выйти</button>
    </nav>
    <p className="main-menu-note">Один герой. Одна жизнь.</p>
  </section>;
}
