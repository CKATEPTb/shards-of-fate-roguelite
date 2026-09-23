import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import Phaser from 'phaser';
import { AURA_FAMILIES, PROJECTILE_KINDS, type ActionDefinition, type AuraVisualDefinition, type Modifiers, type ProjectileKind, type StatusDefinition } from '@shards/shared';
import { gameContent } from '../catalog';
import { AuraIcon } from '../components/AuraIcon';
import { AuraCatalogScene, type AuraCatalogSettings } from './auraCatalogScene';
import type { UnitFacing, UnitMotion } from './unitAnimation';
import './auraCatalogPreview.css';

const MAX_SELECTED = 4;
const families: Record<AuraVisualDefinition['family'], string> = {
  blood: 'Кровь', holy: 'Свет', nature: 'Природа', shadow: 'Тень', arcane: 'Тайная магия',
  fire: 'Огонь', frost: 'Лёд', storm: 'Буря', stone: 'Камень', metal: 'Сталь',
  venom: 'Яд', spirit: 'Духи', time: 'Время', war: 'Война', astral: 'Астрал',
};
const forms: Record<AuraVisualDefinition['form'], string> = {
  dome: 'Купол', halo: 'Нимб', vortex: 'Вихрь', orbit: 'Орбиты', runes: 'Руны', wings: 'Крылья',
  chains: 'Цепи', spikes: 'Шипы', rain: 'Дождь', flames: 'Пламя', mist: 'Туман', shards: 'Осколки',
  roots: 'Корни', waves: 'Волны', crown: 'Корона', eyes: 'Глаза', feathers: 'Перья', embers: 'Искры', arcs: 'Разряды', sigil: 'Печать',
};
const projectiles: Record<ProjectileKind, string> = {
  arrow: 'Стрела', fire: 'Огненный заряд', frost: 'Ледяное копьё', lightning: 'Молния',
  holy: 'Священный свет', shadow: 'Теневая сфера', nature: 'Побег рощи', blood: 'Кровавый сгусток',
  arcane: 'Чародейский заряд', poison: 'Ядовитый плевок', bone: 'Костяное копьё', stone: 'Каменный осколок',
};
const modifierNames: Partial<Record<keyof Modifiers, string>> = {
  damageBonus: 'Урон', damageReduction: 'Поглощение урона', partyDamageReduction: 'Поглощение урона отрядом',
  taunt: 'Провокация', vampirismDice: 'Вампиризм', healingShareDice: 'Общее исцеление', preserveHot: 'Продление регенерации',
  preserveShield: 'Сохранение ёмкости щита', guaranteedCrit: 'Гарантированный критический удар', evasionBonus: 'Уклонение',
  repeatAttack: 'Повтор атаки', initiativeBonus: 'Инициатива', agilityBonus: 'Проворность', damageBonusDice: 'Дополнительный урон',
  partyGuardDice: 'Защита союзника', invulnerable: 'Полное поглощение урона', accuracyBonus: 'Точность',
  critBonus: 'Крит', armorBonus: 'Броня', powerBonus: 'Сила', resilienceBonus: 'Стойкость', luckBonus: 'Удача',
};
const numberSign = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

function actionRule(action: ActionDefinition): string {
  const stat = action.scaling ? 'Сила источника' : '';
  const amount = action.damagePerStack !== undefined ? `${action.damagePerStack} × число зарядов`
    : [action.dice, stat && `${action.factor !== undefined && action.factor !== 1 ? `${action.factor} × ` : ''}${stat}`].filter(Boolean).join(' + ');
  const label = { damage: 'Урон', heal: 'Исцеление', shield: 'Щит', status: 'Наложение ауры' }[action.type];
  if (action.type === 'status') return `${label}: ${gameContent.statuses.find(status => status.id === action.statusId)?.name ?? action.statusId}`;
  return `${label}: ${amount || 'по правилам источника'}${action.hits && action.hits > 1 ? `, ударов: ${action.hits}` : ''}${action.bypassArmor ? ' · игнорирует броню' : ''}`;
}

function modifierRule([key, value]: [string, unknown]): string {
  if (key === 'healingBonus') return '';
  const label = modifierNames[key as keyof Modifiers] ?? key;
  if (typeof value === 'boolean') return value ? label : '';
  if (typeof value === 'number') return `${label}: ${numberSign(value)}`;
  if (typeof value === 'string') return `${label}: ${value}`;
  if (value && typeof value === 'object' && 'dice' in value && 'atLeast' in value) return `${label}: ${value.dice}, успех на ${value.atLeast}+`;
  return '';
}

function durationLabel(status: StatusDefinition): string {
  if (status.stacking === 'decay') return 'До исчерпания зарядов';
  if (status.defaultDuration === undefined) return 'Задаётся источником';
  if (status.defaultDuration === null) return 'Без ограничения';
  return `${status.defaultDuration} собств. хода`;
}

function AuraDescription({ status, selected, onOnly, onToggle, stacks }: {
  status: StatusDefinition; selected: boolean; onOnly: () => void; onToggle: () => void; stacks: number;
}) {
  const rules = [...status.actions.map(actionRule), ...Object.entries(status.modifiers).map(modifierRule)].filter(Boolean);
  const sources = [...gameContent.skills, ...gameContent.effects].flatMap(source => source.actions.flatMap(action => {
    if (action.statusId === status.id) return [{ name: source.name, duration: action.duration }];
    if (action.onHitStatusId === status.id) return [{ name: `${source.name} · попадание`, duration: action.onHitDuration }];
    return [];
  }));
  const timing = status.trigger === 'TURN_STARTED' ? 'В начале хода носителя'
    : status.trigger === 'TURN_ENDED' ? 'В конце хода носителя' : 'Пока активна аура';
  return <aside className="atlas-detail" aria-label="Описание выбранной ауры">
    <div className="atlas-detail-art"><AuraIcon id={status.id} visual={status.visual} size={112} /><span className={`atlas-polarity ${status.polarity === 'negative' ? 'negative' : ''}`}>{status.polarity === 'negative' ? 'Отрицательная' : 'Положительная'}</span></div>
    <span className="atlas-kicker">{status.visual ? families[status.visual.family] : 'Аура'} · {status.visual ? forms[status.visual.form] : 'Эффект'}</span>
    <h2>{status.name}</h2><p className="atlas-description">{status.description}</p>
    <dl className="atlas-rules"><div><dt>Срабатывание</dt><dd>{timing}</dd></div><div><dt>Базовая длительность</dt><dd>{durationLabel(status)}</dd></div><div><dt>Наложение</dt><dd>{status.stacking === 'decay' ? 'Общий запас зарядов · −1 за срабатывание' : status.stacking === 'refresh' ? 'Обновляет длительность от того же источника' : 'Независимые слои и сроки действия'}</dd></div>
      {status.expiresAt && <div><dt>Завершение</dt><dd>{status.expiresAt === 'TURN_STARTED' ? 'В начале собственного хода' : 'В конце собственного хода'}</dd></div>}
    </dl>
    {!!rules.length && <section className="atlas-formulas"><h3>Механика</h3><ul>{rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul></section>}
    {!!sources.length && <section className="atlas-sources"><h3>Источники</h3>{sources.map((source, index) => <p key={index}>{source.name}<span>{status.stacking === 'decay' ? 'По зарядам' : source.duration === null ? 'До снятия' : source.duration !== undefined ? `${source.duration} хода` : 'По умению'}</span></p>)}</section>}
    <p className="atlas-duration-note">Фактическую длительность задаёт применяющее умение. В мастерской эффект показан постоянно, зарядов: {stacks}.</p>
    <div className="atlas-detail-actions"><button className="atlas-primary" onClick={onOnly}>Показать отдельно</button><button aria-pressed={selected} onClick={onToggle}>{selected ? 'Снять с героя' : 'Добавить к эффектам'}</button></div>
  </aside>;
}

function AuraCatalogWorkshop() {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [polarity, setPolarity] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>(['divine_protection']);
  const [focusId, setFocusId] = useState('divine_protection');
  const [heroId, setHeroId] = useState('guardian');
  const [facing, setFacing] = useState<UnitFacing>('south');
  const [motion, setMotion] = useState<UnitMotion>('idle');
  const [stacks, setStacks] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [projectile, setProjectile] = useState<ProjectileKind>('fire');
  const [notice, setNotice] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<AuraCatalogScene | undefined>(undefined);
  const selected = useMemo(() => selectedIds.flatMap(id => gameContent.statuses.find(status => status.id === id) ?? []), [selectedIds]);
  const focus = gameContent.statuses.find(status => status.id === focusId) ?? gameContent.statuses[0];
  const settings = useMemo<AuraCatalogSettings>(() => ({ heroId, facing, motion, selected, stacks, paused, reduced }), [heroId, facing, motion, selected, stacks, paused, reduced]);
  const initial = useRef(settings);
  useEffect(() => {
    if (!host.current) return;
    const preview = new AuraCatalogScene(initial.current);
    scene.current = preview;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 720, height: 520, transparent: true,
      pixelArt: true, antialias: false, roundPixels: true, scene: [preview], audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, banner: false });
    return () => { scene.current = undefined; game.destroy(true); };
  }, []);
  useEffect(() => { scene.current?.configure(settings); }, [settings]);
  const filtered = useMemo(() => gameContent.statuses.filter(status => (family === 'all' || status.visual?.family === family)
    && (polarity === 'all' || (status.polarity ?? 'positive') === polarity)
    && `${status.name} ${status.description} ${status.id} ${status.visual ? families[status.visual.family] : ''} ${status.tags.join(' ')}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))), [query, family, polarity]);
  const toggle = (id: string) => {
    setFocusId(id);
    if (selectedIds.includes(id)) { setSelectedIds(selectedIds.filter(candidate => candidate !== id)); setNotice(''); }
    else if (selectedIds.length < MAX_SELECTED) { setSelectedIds([...selectedIds, id]); setNotice(''); }
    else setNotice(`Одновременно можно показать ${MAX_SELECTED} ауры. Снимите одну или нажмите «Показать отдельно».`);
  };
  const selectOnly = (id: string) => { setSelectedIds([id]); setFocusId(id); setNotice(''); };
  return <main className="aura-atlas" style={{ '--atlas-accent': focus.color } as CSSProperties}>
    <header className="atlas-header"><div><span className="atlas-kicker">Осколки судьбы · мастерская эффектов</span><h1>Атлас аур<span className="atlas-header-gem" aria-hidden="true">✦</span></h1></div><p><b>{gameContent.statuses.length}</b><span>аур в каталоге<br />{AURA_FAMILIES.length} школ магии</span></p></header>
    <div className="atlas-workspace">
      <section className="atlas-library" aria-label="Каталог аур"><div className="atlas-library-head"><h2>Коллекция</h2><div className="atlas-view" aria-label="Вид каталога"><button aria-pressed={view === 'grid'} aria-label="Сетка иконок" onClick={() => setView('grid')}>▦</button><button aria-pressed={view === 'list'} aria-label="Список аур" onClick={() => setView('list')}>☷</button></div></div>
        <label className="atlas-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, свойство, школа…" aria-label="Поиск ауры" /></label>
        <div className="atlas-filters"><label><span className="atlas-sr-only">Школа магии</span><select value={family} onChange={event => setFamily(event.target.value)}><option value="all">Все школы</option>{AURA_FAMILIES.map(key => <option key={key} value={key}>{families[key]} · {gameContent.statuses.filter(status => status.visual?.family === key).length}</option>)}</select></label><label><span className="atlas-sr-only">Тип ауры</span><select value={polarity} onChange={event => setPolarity(event.target.value)}><option value="all">Все ауры</option><option value="positive">Положительные</option><option value="negative">Отрицательные</option></select></label></div>
        <p className="atlas-result-count">Найдено: {filtered.length}<span>На герое: {selected.length}/{MAX_SELECTED}</span></p>
        <div className={`atlas-catalog ${view}`} role="group" aria-label="Выберите ауры для просмотра">{filtered.map(status => <button key={status.id} className="atlas-entry" aria-pressed={selectedIds.includes(status.id)} data-focused={focus.id === status.id} data-negative={status.polarity === 'negative'} title={`${status.name}. ${status.description}`} onClick={() => toggle(status.id)}>
          <AuraIcon id={status.id} visual={status.visual} size={48} /><span className="atlas-entry-name">{status.name}</span><span className="atlas-entry-school">{status.visual ? families[status.visual.family] : 'Аура'}</span><i aria-hidden="true">{selectedIds.includes(status.id) ? '✓' : '+'}</i></button>)}
          {!filtered.length && <div className="atlas-empty"><p>Ауры не найдены</p><button onClick={() => { setQuery(''); setFamily('all'); setPolarity('all'); }}>Сбросить фильтры</button></div>}
        </div>
      </section>
      <section className="atlas-showcase" aria-label="Модель персонажа и эффекты"><div className="atlas-stage-heading"><div><span className="atlas-kicker">Живой предпросмотр</span><h2>{gameContent.characters.find(hero => hero.id === heroId)?.name}</h2></div><button className="atlas-pause" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '▶ Продолжить' : 'Ⅱ Пауза'}</button></div>
        <div className="atlas-stage" ref={host} role="img" aria-label="Анимированная модель с выбранными аурами" />
        <div className="atlas-active-auras" aria-label="Активные эффекты">{selected.map(status => <button key={status.id} onClick={() => toggle(status.id)} title={`Снять: ${status.name}`}><AuraIcon id={status.id} size={27} /><span>{status.name}</span><b aria-hidden="true">×</b></button>)}{!selected.length && <span className="atlas-no-aura">Выберите ауру в коллекции</span>}</div>
        <p className="atlas-notice" role="status">{notice || 'Нажмите на иконку, чтобы добавить или снять эффект.'}</p>
        <div className="atlas-controls"><label>Герой<select value={heroId} onChange={event => setHeroId(event.target.value)}>{gameContent.characters.map(hero => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select></label><label>Движение<select value={motion} onChange={event => setMotion(event.target.value as UnitMotion)}><option value="idle">Спокойствие</option><option value="walk">Ходьба</option><option value="cast">Применение умения</option><option value="attack">Атака</option><option value="dodge">Уклонение</option><option value="shieldBlock">Блок щитом</option></select></label>
          <div className="atlas-facing"><span>Ракурс</span><div>{([['west', '←', 'Влево'], ['north', '↑', 'Спина'], ['south', '↓', 'Лицо'], ['east', '→', 'Вправо']] as const).map(([key, arrow, label]) => <button key={key} title={label} aria-label={label} aria-pressed={facing === key} onClick={() => setFacing(key)}>{arrow}</button>)}</div></div>
          <label className="atlas-stacks">Заряды <b>{stacks}</b><input type="range" min="1" max="12" step="1" value={stacks} onChange={event => setStacks(Number(event.target.value))} /></label>
          <label className="atlas-reduced"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />Меньше движения</label><button className="atlas-reset" onClick={() => { setSelectedIds([]); setNotice(''); }}>Снять все ауры</button>
        </div>
        <div className="atlas-projectiles"><label><span className="atlas-kicker">Магические снаряды</span><select value={projectile} onChange={event => setProjectile(event.target.value as ProjectileKind)}>{PROJECTILE_KINDS.map(kind => <option key={kind} value={kind}>{projectiles[kind]}</option>)}</select></label><button className="atlas-primary" disabled={paused} onClick={() => scene.current?.fire(projectile)}>Выпустить <span aria-hidden="true">↗</span></button></div>
      </section>
      <AuraDescription status={focus} selected={selectedIds.includes(focus.id)} onOnly={() => selectOnly(focus.id)} onToggle={() => toggle(focus.id)} stacks={stacks} />
    </div>
    <footer className="atlas-footer"><span>Иллюстрация · модель · механика</span><span>Мастерская не изменяет текущую игру</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<AuraCatalogWorkshop />);
