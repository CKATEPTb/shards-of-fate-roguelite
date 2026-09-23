import { useId, useSyncExternalStore, type CSSProperties } from 'react';
import { playSound } from '../audio/engine';
import { DEFAULT_AUDIO_SETTINGS, getAudioSettings, subscribeAudioSettings, updateAudioSettings } from '../audio/settings';
import './AudioSettings.css';

const channels = [
  ['masterVolume', 'Общая громкость'],
  ['musicVolume', 'Музыка'],
  ['effectsVolume', 'Звуки игры'],
] as const;
const adjustmentKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const serverSettings = () => DEFAULT_AUDIO_SETTINGS;

export function AudioSettingsPanel({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const settings = useSyncExternalStore(subscribeAudioSettings, getAudioSettings, serverSettings);
  return <section className="audio-settings" data-compact={compact} data-muted={settings.muted} data-sound="off" aria-labelledby={`${id}-title`}>
    <header className="audio-settings-heading">
      <h2 id={`${id}-title`}>Звук</h2>
      <button type="button" className="audio-settings-mute" aria-pressed={settings.muted} onClick={() => updateAudioSettings({ muted: !settings.muted })}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {settings.muted ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
        </svg>
        <span>Без звука</span>
      </button>
    </header>
    <div className="audio-settings-channels">
      {channels.map(([key, label]) => {
        const percentage = Math.round(settings[key] * 100);
        const preview = () => { if (key === 'effectsVolume') playSound('select'); };
        return <div key={key} className="audio-volume-control">
          <label htmlFor={`${id}-${key}`}>{label}</label>
          <output htmlFor={`${id}-${key}`} aria-hidden="true">{percentage}%</output>
          <input id={`${id}-${key}`} type="range" min="0" max="100" step="1" value={percentage}
            aria-valuetext={`${percentage} процентов`} style={{ '--audio-volume': `${percentage}%` } as CSSProperties}
            onChange={event => updateAudioSettings({ [key]: Number(event.target.value) / 100 })}
            onPointerUp={preview} onKeyUp={event => { if (adjustmentKeys.has(event.key)) preview(); }} />
        </div>;
      })}
    </div>
    {!compact && <p className="audio-settings-note">{settings.muted ? 'Звук выключен. Уровни громкости сохранены.' : 'Настройки сохраняются на этом устройстве.'}</p>}
  </section>;
}
