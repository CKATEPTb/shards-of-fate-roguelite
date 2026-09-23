import { Icon } from '../Icon';
import { AudioSettingsPanel } from '../AudioSettings';

export function MenuPanel({ onResume, onLeave, reducedMotion, onReducedMotion, network }: { onResume: () => void; onLeave: () => void; reducedMotion: boolean; onReducedMotion: (value: boolean) => void; network?: { code: string; isHost: boolean } }) {
  return <div className="menu-panel">
    <button className="primary-button resume-button" onClick={onResume}><Icon name="play" />Вернуться в игру</button>
    <button className="secondary-button" onClick={onLeave}>{network ? network.isHost ? 'Завершить комнату и выйти' : 'Покинуть комнату' : 'Сохранить и выйти в главное меню'}</button>
    <label className="setting-toggle"><span><strong>Меньше движения</strong><small>Без вторичных анимаций и задержки камеры</small></span><input type="checkbox" checked={reducedMotion} onChange={event => onReducedMotion(event.target.checked)} /></label>
    <AudioSettingsPanel compact />
    {network ? <p className="panel-note">Комната {network.code} · {network.isHost ? 'Вы — хост' : 'Вы — участник'}. Игра и таймер боссов продолжаются, пока открыто меню. При выходе хоста комната закрывается, а поход сохраняется у него; таймер в сохранении стоит на паузе.</p>
      : <p className="panel-note">Прогресс сохраняется при выходе в меню, переходе на другой участок и после боя. Закрытие вкладки возвращает к последнему автосохранению.</p>}
  </div>;
}
