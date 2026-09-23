import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioSettingsPanel } from '../components/AudioSettings';
import { initAudio, playSound, setAudioScene } from './engine';
import type { MusicScene, SoundCue } from './types';
import './audioPreview.css';

const themes: { name: string; note: string; scene: MusicScene }[] = [
  { name: 'У костра', note: 'Тихая тема главного меню', scene: { kind: 'menu' } },
  { name: 'Весна', note: 'Дыхание леса и светлые переборы', scene: { kind: 'exploration', season: 'spring' } },
  { name: 'Лето', note: 'Тёплые струны и неспешный ритм', scene: { kind: 'exploration', season: 'summer' } },
  { name: 'Осень', note: 'Деревянные тембры и сумеречная гармония', scene: { kind: 'exploration', season: 'autumn' } },
  { name: 'Зима', note: 'Воздух, пространство и хрустальные ноты', scene: { kind: 'exploration', season: 'winter' } },
  { name: 'Привал', note: 'Спокойная передышка в походе', scene: { kind: 'camp', season: 'spring' } },
  { name: 'Подземелье', note: 'Приглушённая тема осеннего подвала', scene: { kind: 'exploration', season: 'autumn', underground: true } },
  { name: 'Стычка', note: 'Лёгкое боевое напряжение', scene: { kind: 'battle', threat: 0, season: 'spring' } },
  { name: 'Опасный бой', note: 'Более плотный ритм', scene: { kind: 'battle', threat: 1, season: 'summer' } },
  { name: 'Элитные враги', note: 'Тяжёлая боевая тема', scene: { kind: 'battle', threat: 2, season: 'autumn' } },
  { name: 'Сезонный босс', note: 'Эпическая тема с низкими ударными', scene: { kind: 'boss', season: 'winter', threat: 2 } },
  { name: 'Победа', note: 'Завершение четырёх сезонов', scene: { kind: 'victory' } },
  { name: 'Последний огонь', note: 'Завершение похода', scene: { kind: 'defeat' } },
];
const groups: { name: string; sounds: [SoundCue, string][] }[] = [
  { name: 'Оружие и бой', sounds: [['sword', 'Меч'], ['dagger', 'Кинжал'], ['heavy', 'Тяжёлый удар'], ['bow', 'Лук'], ['staff', 'Посох'], ['hit', 'Попадание'], ['critical', 'Крит'], ['block', 'Блок'], ['dodge', 'Уклонение'], ['dice', 'Кубики'], ['turn', 'Ход'], ['death', 'Гибель'], ['flee', 'Побег']] },
  { name: 'Магия', sounds: [['fire', 'Огонь'], ['frost', 'Лёд'], ['lightning', 'Молния'], ['nature', 'Природа'], ['holy', 'Свет'], ['shadow', 'Тьма'], ['blood', 'Кровь'], ['arcane', 'Чары'], ['magic', 'Заклинание'], ['heal', 'Исцеление'], ['shield', 'Щит'], ['aura', 'Аура']] },
  { name: 'Путешествие', sounds: [['step', 'Шаг'], ['campfire', 'Костёр'], ['chest', 'Сундук'], ['well', 'Колодец'], ['portal', 'Портал'], ['stairs', 'Лестница'], ['loot', 'Находка'], ['coin', 'Монеты'], ['equip', 'Экипировка'], ['bossArrival', 'Приход босса'], ['victory', 'Победа'], ['defeat', 'Поражение']] },
];

function AudioPreview() {
  const [selected, setSelected] = useState(0);
  useEffect(initAudio, []);
  useEffect(() => setAudioScene(themes[selected].scene), [selected]);
  return <main className="audio-workshop" data-sound="off">
    <header><span>ОСКОЛКИ СУДЬБЫ · МАСТЕРСКАЯ</span><h1>Звуки путешествия</h1><p>Нажмите на тему, чтобы послушать. Переходы плавные — дайте новой мелодии несколько секунд.</p></header>
    <div className="audio-workshop-layout"><section aria-label="Музыкальные темы"><h2>Музыка</h2><div className="audio-theme-grid">
      {themes.map((theme, index) => <button key={theme.name} aria-pressed={selected === index} onClick={() => setSelected(index)}><strong>{theme.name}</strong><span>{theme.note}</span></button>)}
    </div></section><aside><AudioSettingsPanel /><p>Используются те же темы, эффекты и настройки, что и в игре. Сохранённый поход не меняется.</p></aside></div>
    {groups.map(group => <section className="audio-sound-group" key={group.name}><h2>{group.name}</h2><div>{group.sounds.map(([cue, name]) => <button key={cue} onClick={() => playSound(cue)}>{name}</button>)}</div></section>)}
  </main>;
}
createRoot(document.getElementById('root')!).render(<AudioPreview />);
