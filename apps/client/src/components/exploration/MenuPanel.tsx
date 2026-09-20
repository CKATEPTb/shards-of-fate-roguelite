import { Icon } from '../Icon';

export function MenuPanel({ onResume, onLeave, reducedMotion, onReducedMotion }: { onResume: () => void; onLeave: () => void; reducedMotion: boolean; onReducedMotion: (value: boolean) => void }) {
  return <div className="menu-panel">
    <button className="primary-button resume-button" onClick={onResume}><Icon name="play" />Вернуться в игру</button>
    <button className="secondary-button" onClick={onLeave}>Сохранить и выйти в главное меню</button>
    <label className="setting-toggle"><span><strong>Меньше движения</strong><small>Без вторичных анимаций и задержки камеры</small></span><input type="checkbox" checked={reducedMotion} onChange={event => onReducedMotion(event.target.checked)} /></label>
    <p className="panel-note">Прогресс сохраняется при выходе в меню, переходе на другой участок и после боя. Закрытие вкладки возвращает к последнему автосохранению.</p>
  </div>;
}
