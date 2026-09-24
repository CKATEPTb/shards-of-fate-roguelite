import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import Phaser from 'phaser';
import { SKILL_RARITIES, type SkillDefinition, type SkillRarity } from '@shards/shared';
import { gameContent } from '../catalog';
import { AuraIcon } from '../components/AuraIcon';
import { DiceLegend, DiceText } from '../components/DiceText';
import { SKILL_RARITY_FILTER_NAMES, SKILL_RARITY_NAMES, SkillRarityBadge } from '../components/SkillRarity';
import { skillDiceRules, statusDiceRules } from '../components/exploration/diceRules';
import { AuraCatalogScene, type AuraCatalogSettings } from './auraCatalogScene';
import type { UnitFacing, UnitMotion } from './unitAnimation';
import { auraLinkDuration, skillActionText, skillAuraLinks, skillFamilies, skillKindNames, skillKinds, skillSource, skillTargetNames, skillTurns, type SkillAuraLink } from './skillCatalogModel';
import './auraCatalogPreview.css';
import './skillCatalogPreview.css';

const relationText = (relation: 'ally' | 'enemy' | undefined) => relation === 'ally' ? 'Если выбран союзник' : relation === 'enemy' ? 'Если выбран противник' : undefined;
const firstSentence = (text: string) => text.length > 190 ? text.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? text : text;

function LinkedAura({ link, enabled, onToggle }: { link: SkillAuraLink; enabled: boolean; onToggle: () => void }) {
  const rules = statusDiceRules(link.status);
  const summary = firstSentence(link.status.description);
  return <article className="grimoire-aura" data-negative={link.status.polarity === 'negative'}>
    <button className="grimoire-aura-toggle" aria-pressed={enabled} aria-label={`${enabled ? 'Скрыть' : 'Показать'} эффект: ${link.status.name}`} onClick={onToggle}><AuraIcon id={link.status.id} size={39} /><span aria-hidden="true">{enabled ? '✓' : '+'}</span></button>
    <div><h4>{link.status.name}<small>{auraLinkDuration(link)}</small></h4>
      <p className="grimoire-aura-condition">{[relationText(link.relation), link.onHit ? 'При попадании' : 'При применении', skillTargetNames[link.target] ?? link.target, link.parent && `От ауры «${link.parent}»`].filter(Boolean).join(' · ')}</p>
      <p><DiceText text={summary} rules={rules} /></p>
      <p className="grimoire-aura-timing">{link.status.trigger === 'TURN_STARTED' ? 'В начале хода носителя' : link.status.trigger === 'TURN_ENDED' ? 'В конце хода носителя' : 'Пока аура активна'}{link.status.stacking === 'decay' ? ' · −1 заряд после срабатывания' : link.status.stacking === 'refresh' ? ' · обновление срока' : ' · независимые слои'}</p>
      {summary !== link.status.description && <details><summary>Все правила эффекта</summary><p><DiceText text={link.status.description} rules={rules} /></p></details>}
    </div>
  </article>;
}

function SkillCard({ skill }: { skill: SkillDefinition }) {
  const rules = skillDiceRules(skill);
  const random = skill.target.startsWith('random') || skill.actions.some(action => action.target?.startsWith('random'));
  return <aside className="atlas-detail grimoire-detail" aria-label="Описание навыка" data-rarity={skill.rarity}>
    <div className="atlas-detail-art"><AuraIcon id={skill.id} size={112} /><SkillRarityBadge rarity={skill.rarity} /><span className="atlas-polarity">{skill.tags.includes('LEARNABLE') ? 'Изучаемый навык' : skill.tags.includes('ROLE') ? 'Классовое умение' : 'Игровой навык'}</span></div>
    <span className="atlas-kicker">{skill.icon ? skillFamilies[skill.icon.family] : 'Умение'} · {skillKinds(skill).map(kind => skillKindNames[kind]).join(' / ')}</span>
    <h2>{skill.name}</h2><p className="atlas-description"><DiceText text={skill.description} rules={rules} /></p>
    <dl className="atlas-rules"><div><dt>Цель</dt><dd>{skillTargetNames[skill.target] ?? skill.target}</dd></div><div><dt>Перезарядка</dt><dd>{skill.cooldown ? `${skillTurns(skill.cooldown)} героя` : 'Без перезарядки'}</dd></div><div><dt>Расход хода</dt><dd>Одно действие</dd></div><div><dt>Источник</dt><dd>{skillSource(skill)}</dd></div></dl>
    {random && <p className="grimoire-random"><b>Случайная цель</b><span>1dN по живым подходящим целям; N — их количество. При единственной цели броска нет. Выбор сохраняется для последующих действий по этому типу цели.</span></p>}
    <section className="grimoire-actions"><h3>Порядок действия</h3><ol>{skill.actions.map((action, index) => <li key={index}>
      {relationText(action.targetRelation) && <strong>{relationText(action.targetRelation)}</strong>}
      <span><DiceText text={skillActionText(action)} rules={rules} /></span>
      <small>Цель: {skillTargetNames[action.target ?? skill.target] ?? action.target ?? skill.target}</small>
      {action.type === 'shield' && <small>Срок щита: {action.duration === null ? 'без ограничения' : action.duration === undefined ? 'по правилам источника' : `${skillTurns(action.duration)} носителя`}</small>}
      {action.onHitStatusId && <small>Каждое попадание: {gameContent.statuses.find(status => status.id === action.onHitStatusId)?.name ?? action.onHitStatusId}</small>}
    </li>)}</ol></section>
    <DiceLegend rules={rules} />
  </aside>;
}

function SkillCatalogWorkshop() {
  const [id, setId] = useState('ember_lance');
  const [scope, setScope] = useState('learnable');
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [kind, setKind] = useState('all');
  const [target, setTarget] = useState('all');
  const [rarity, setRarity] = useState<SkillRarity | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [heroId, setHeroId] = useState('mage');
  const [facing, setFacing] = useState<UnitFacing>('east');
  const [motion, setMotion] = useState<UnitMotion>('idle');
  const [stacks, setStacks] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [muted, setMuted] = useState<string[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<AuraCatalogScene | undefined>(undefined);
  const skill = gameContent.skills.find(item => item.id === id) ?? gameContent.skills.find(item => item.tags.includes('LEARNABLE')) ?? gameContent.skills[0];
  const links = useMemo(() => skillAuraLinks(skill), [skill]);
  const auras = useMemo(() => [...new Map(links.map(link => [link.status.id, link.status])).values()].filter(status => !muted.includes(status.id)).slice(0, 4), [links, muted]);
  const settings = useMemo<AuraCatalogSettings>(() => ({ heroId, facing, motion, selected: auras, stacks, paused, reduced }), [heroId, facing, motion, auras, stacks, paused, reduced]);
  const initial = useRef(settings);
  useEffect(() => {
    if (!stage.current) return;
    const preview = new AuraCatalogScene(initial.current);
    scene.current = preview;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: stage.current, width: 720, height: 520, transparent: true,
      pixelArt: true, antialias: false, roundPixels: true, scene: [preview], audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, banner: false });
    return () => { scene.current = undefined; game.destroy(true); };
  }, []);
  useEffect(() => { scene.current?.configure(settings); }, [settings]);
  const matchingOtherFilters = useMemo(() => gameContent.skills.filter(candidate => !candidate.tags.includes('UPGRADED') && (scope === 'all' || candidate.tags.includes('LEARNABLE'))
    && (family === 'all' || candidate.icon?.family === family)
    && (kind === 'all' || skillKinds(candidate).some(value => value === kind))
    && (target === 'all' || candidate.target === target || candidate.actions.some(action => action.target === target))
    && `${candidate.name} ${candidate.description} ${candidate.id} ${candidate.icon ? skillFamilies[candidate.icon.family] : ''} ${candidate.rarity ? SKILL_RARITY_NAMES[candidate.rarity] : ''} ${candidate.tags.join(' ')}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))), [query, scope, family, kind, target]);
  const filtered = useMemo(() => matchingOtherFilters.filter(candidate => rarity === 'all' || candidate.rarity === rarity), [matchingOtherFilters, rarity]);
  const rarityCounts = useMemo(() => Object.fromEntries(SKILL_RARITIES.map(value => [value, matchingOtherFilters.filter(candidate => candidate.rarity === value).length])) as Record<SkillRarity, number>, [matchingOtherFilters]);
  const targets = [...new Set(gameContent.skills.flatMap(candidate => [candidate.target, ...candidate.actions.flatMap(action => action.target ?? [])]))];
  const families = [...new Set(gameContent.skills.flatMap(candidate => candidate.icon ? [candidate.icon.family] : []))];
  const learned = gameContent.skills.filter(candidate => candidate.tags.includes('LEARNABLE') && !candidate.tags.includes('UPGRADED')).length;
  const toggleAura = (auraId: string) => setMuted(current => current.includes(auraId) ? current.filter(value => value !== auraId) : [...current, auraId]);
  const selectSkill = (skillId: string) => { setId(skillId); setMuted([]); };
  return <main className="aura-atlas grimoire" style={{ '--atlas-accent': skill.icon?.colors[1] ?? '#d3bd8a' } as CSSProperties}>
    <header className="atlas-header"><div><span className="atlas-kicker">Осколки судьбы · мастерская навыков</span><h1>Гримуар навыков<span className="atlas-header-gem" aria-hidden="true">✦</span></h1></div><p><b>{learned}</b><span>изучаемых навыков<br />{gameContent.skills.length} в общей коллекции</span></p></header>
    <div className="atlas-workspace grimoire-workspace">
      <section className="atlas-library" aria-label="Каталог навыков"><div className="atlas-library-head"><h2>Коллекция</h2><div className="atlas-view"><button aria-label="Сетка навыков" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>▦</button><button aria-label="Список навыков" aria-pressed={view === 'list'} onClick={() => setView('list')}>☷</button></div></div>
        <label className="atlas-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Поиск навыка" placeholder="Название, эффект, школа…" /></label>
        <div className="atlas-filters grimoire-filters">
          <label><span className="atlas-sr-only">Набор навыков</span><select value={scope} onChange={event => setScope(event.target.value)}><option value="learnable">Изучаемые · {learned}</option><option value="all">Все · {gameContent.skills.length}</option></select></label>
          <label className="grimoire-rarity-filter" data-rarity={rarity === 'all' ? undefined : rarity}><span className="atlas-sr-only">Редкость навыка</span><select value={rarity} onChange={event => setRarity(event.target.value as SkillRarity | 'all')}><option value="all">Все редкости · {matchingOtherFilters.length}</option>{SKILL_RARITIES.map(value => <option key={value} value={value}>{SKILL_RARITY_FILTER_NAMES[value]} · {rarityCounts[value]}</option>)}</select></label>
          <label><span className="atlas-sr-only">Школа магии</span><select value={family} onChange={event => setFamily(event.target.value)}><option value="all">Все школы</option>{families.map(value => <option key={value} value={value}>{skillFamilies[value]}</option>)}</select></label>
          <label><span className="atlas-sr-only">Тип действия</span><select value={kind} onChange={event => setKind(event.target.value)}><option value="all">Любое действие</option>{Object.entries(skillKindNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span className="atlas-sr-only">Цель навыка</span><select value={target} onChange={event => setTarget(event.target.value)}><option value="all">Любая цель</option>{targets.map(value => <option key={value} value={value}>{skillTargetNames[value] ?? value}</option>)}</select></label>
        </div>
        <p className="atlas-result-count">Найдено: {filtered.length}<span>Навыки на кубиках</span></p>
        <div className={`atlas-catalog ${view}`} role="group" aria-label="Выберите навык">{filtered.map(candidate => <button key={candidate.id} className="atlas-entry grimoire-entry" data-rarity={candidate.rarity} aria-pressed={candidate.id === skill.id} onClick={() => selectSkill(candidate.id)} title={`${candidate.name}${candidate.rarity ? ` · ${SKILL_RARITY_NAMES[candidate.rarity]}` : ''}`}><AuraIcon id={candidate.id} size={48} /><span className="atlas-entry-name">{candidate.name}</span><span className="atlas-entry-school">{skillKinds(candidate).map(value => skillKindNames[value]).join(' · ')}</span><SkillRarityBadge rarity={candidate.rarity} /><b className="grimoire-entry-cooldown" title={`Перезарядка: ${skillTurns(candidate.cooldown)}`}>↻ {candidate.cooldown}</b></button>)}
          {!filtered.length && <div className="atlas-empty"><p>Навыки не найдены</p><button onClick={() => { setQuery(''); setScope('learnable'); setFamily('all'); setKind('all'); setTarget('all'); setRarity('all'); }}>Сбросить фильтры</button></div>}
        </div>
      </section>
      <section className="atlas-showcase grimoire-showcase" aria-label="Предпросмотр эффектов навыка">
        <div className="atlas-stage-heading"><div><span className="atlas-kicker">Эффекты и снаряд</span><h2>{skill.name}</h2></div><button className="atlas-pause" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '▶ Продолжить' : 'Ⅱ Пауза'}</button></div>
        <div className="atlas-stage" ref={stage} role="img" aria-label="Модель носителя выбранных аур и мишень для снаряда" />
        <p className="grimoire-preview-note">Предпросмотр визуальных эффектов. Здесь ауры показаны на одной модели; выбор цели, броски, урон и перезарядки не разыгрываются.</p>
        <div className="grimoire-release"><span>{skill.projectile ? 'Снаряд этого умения' : 'Умение без снаряда'}</span><button className="atlas-primary" disabled={paused} onClick={() => skill.projectile ? scene.current?.fire(skill.projectile) : setMotion('cast')}>{skill.projectile ? 'Показать снаряд ↗' : 'Показать жест'}</button></div>
        <div className="atlas-controls"><label>Модель героя<select value={heroId} onChange={event => setHeroId(event.target.value)}>{gameContent.characters.map(hero => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select></label><label>Анимация<select value={motion} onChange={event => setMotion(event.target.value as UnitMotion)}><option value="idle">Спокойствие</option><option value="walk">Ходьба</option><option value="cast">Применение умения</option><option value="attack">Атака</option><option value="block">Блокирование</option></select></label>
          <div className="atlas-facing"><span>Ракурс</span><div>{([['west', '←', 'Влево'], ['north', '↑', 'Спина'], ['south', '↓', 'Лицо'], ['east', '→', 'Вправо']] as const).map(([value, arrow, label]) => <button key={value} aria-label={label} title={label} aria-pressed={facing === value} onClick={() => setFacing(value)}>{arrow}</button>)}</div></div>
          <label className="atlas-stacks">Заряды аур <b>{stacks}</b><input type="range" min="1" max="12" step="1" value={stacks} onChange={event => setStacks(Number(event.target.value))} /></label>
          <label className="atlas-reduced"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />Меньше движения</label><span className="grimoire-visible-count">Эффектов: {auras.length}/4</span>
        </div>
        <section className="grimoire-linked-auras"><div className="grimoire-linked-heading"><h3>Связанные ауры</h3><span>Иконка включает эффект на модели</span></div>{links.length ? links.map((link, index) => <LinkedAura key={`${link.status.id}-${index}`} link={link} enabled={auras.some(status => status.id === link.status.id)} onToggle={() => toggleAura(link.status.id)} />) : <p className="grimoire-no-aura">У этого умения нет связанных аур.</p>}</section>
      </section>
      <SkillCard skill={skill} />
    </div>
    <footer className="atlas-footer"><span>Иллюстрация · действие · эффект</span><span>Мастерская не изменяет текущую игру</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<SkillCatalogWorkshop />);
