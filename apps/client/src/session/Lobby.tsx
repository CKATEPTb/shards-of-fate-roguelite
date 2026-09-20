import { useState, type CSSProperties } from 'react';
import { DIFFICULTY_PROFILES } from '@shards/game-data';
import type { DifficultyId } from '@shards/shared';
import { gameContent, roleNames } from '../catalog';
import { Portrait } from '../components/Portrait';

function randomSeed(): string { return [...crypto.getRandomValues(new Uint8Array(6))].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase(); }
const number = (value: number) => value.toLocaleString('ru-RU');
const roster = ['tank', 'healer', 'damage'].flatMap(role => gameContent.characters.filter(hero => hero.role === role));

export function Lobby({ hasSave, onBack, onStart }: { hasSave: boolean; onBack: () => void; onStart: (hero: string, difficulty: DifficultyId, seed: string) => void }) {
  const [selected, setSelected] = useState('guardian');
  const [difficultyId, setDifficulty] = useState<DifficultyId>('normal');
  const [seed, setSeed] = useState(randomSeed);
  const [starting, setStarting] = useState(false);
  const hero = gameContent.characters.find(character => character.id === selected)!;
  const difficulty = DIFFICULTY_PROFILES[difficultyId];
  return <form className="lobby" aria-label="Лобби" onSubmit={event => { event.preventDefault(); if (starting || !seed.trim()) return; setStarting(true); try { onStart(selected, difficultyId, seed); } finally { setStarting(false); } }}>
    <header className="lobby-heading"><div><span className="eyebrow">Новое путешествие</span><h1>У первого костра</h1></div><button type="button" className="lobby-back" onClick={onBack}>← Назад</button></header>
    <div className="lobby-body">
      <section className="lobby-roster"><h2><span>01</span> Выберите героя</h2><div className="hero-choices" role="group" aria-label="Персонаж">
        {roster.map(character => <button type="button" key={character.id} className="hero-choice" data-character={character.id} aria-pressed={selected === character.id} onClick={() => setSelected(character.id)} style={{ '--hero-color': character.color } as CSSProperties}>
          <Portrait unit={character} /><strong>{character.name}</strong><small>{roleNames[character.role]}</small>
        </button>)}
      </div></section>
      <section className="lobby-hero" aria-label="Выбранный герой" style={{ '--hero-color': hero.color } as CSSProperties}>
        <div className="lobby-portrait"><Portrait unit={hero} /></div><span className="eyebrow">{roleNames[hero.role]}</span><h2>{hero.name}</h2><p className="hero-title">{hero.title}</p><p className="hero-description">{hero.description}</p>
        <div className="lobby-skills">{hero.skillIds.map(id => { const skill = gameContent.skills.find(item => item.id === id)!; return <div key={id}><strong>{skill.name}</strong><p>{skill.description}</p></div>; })}
          {hero.passive && <div><strong>{hero.passive.name} · пассивно</strong><p>{hero.passive.description}</p></div>}
        </div>
      </section>
      <section className="lobby-options"><h2><span>02</span> Сложность</h2><div className="difficulty-choices" role="group" aria-label="Сложность">
        {Object.values(DIFFICULTY_PROFILES).map(profile => <button key={profile.id} type="button" onClick={() => setDifficulty(profile.id)} aria-pressed={profile.id === difficultyId}>{profile.name}</button>)}
      </div><p className="difficulty-description">{difficulty.description}</p><dl className="difficulty-stats">
        <div><dt>Здоровье врагов</dt><dd>×{number(difficulty.enemyHpMultiplier)}</dd></div><div><dt>Урон врагов</dt><dd>×{number(difficulty.enemyDamageMultiplier)}</dd></div>
        <div><dt>Эпические группы</dt><dd>{Math.round(difficulty.epicGroupChance * 100)}%</dd></div><div><dt>Мини-босс в чанке</dt><dd>{Math.round(difficulty.minibossChunkChance * 100)}%</dd></div>
      </dl><label className="seed-label" htmlFor="session-seed"><span>03</span> Сид мира</label><div className="seed-control"><input id="session-seed" maxLength={120} required value={seed} onChange={event => setSeed(event.target.value)} spellCheck={false} autoComplete="off" /><button type="button" onClick={() => setSeed(randomSeed())} aria-label="Случайный сид">⟳</button></div><p className="seed-note">Одинаковый сид создаёт тот же мир. Сложность остаётся неизменной до конца сессии.</p>
      </section>
    </div>
    <footer className="lobby-footer"><p>{hasSave ? 'При запуске предыдущее сохранение будет заменено.' : 'Путешествие закончится со смертью героя.'}</p><button className="primary-button" type="submit" disabled={starting || !seed.trim()}>{starting ? 'Создаём мир…' : 'Начать'}<span aria-hidden="true">→</span></button></footer>
  </form>;
}
