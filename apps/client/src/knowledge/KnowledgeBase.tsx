import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { REWARD_RARITIES, type RewardRarity, type Season } from '@shards/shared';
import { gameContent } from '../catalog';
import { EquipmentRarityBadge, EQUIPMENT_RARITY_NAMES } from '../components/EquipmentRarity';
import { createKnowledgeCatalog, KNOWLEDGE_TABS, normalizeKnowledgeSearch, type KnowledgeTabId } from './knowledgeModel';
import { KnowledgeDetails, KnowledgeEntryIcon } from './KnowledgeDetails';
import './knowledgeBase.css';

const PAGE_SIZE = 40;
const seasonNames: Record<Season, string> = { spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима' };
const count = (value: number) => value.toLocaleString('ru-RU');

/** The codex reads the shipped catalogue without loading or advancing a saved run. */
export function KnowledgeBase({ onBack }: { onBack: () => void }) {
  const catalog = useMemo(() => createKnowledgeCatalog(gameContent), []);
  const [tab, setTab] = useState<KnowledgeTabId>('heroes');
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<RewardRarity | ''>('');
  const [season, setSeason] = useState<Season | ''>('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const list = useRef<HTMLUListElement>(null);
  const details = useRef<HTMLElement>(null);
  const lastSelectedButton = useRef<HTMLButtonElement | null>(null);
  const entries = useMemo(() => catalog.filter(entry => entry.tab === tab), [catalog, tab]);
  const groups = useMemo(() => [...new Set(entries.map(entry => entry.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [entries]);
  const rarities = REWARD_RARITIES.filter(value => entries.some(entry => entry.rarity === value));
  const seasons = (Object.keys(seasonNames) as Season[]).filter(value => entries.some(entry => entry.season === value));
  const filtered = useMemo(() => {
    const words = normalizeKnowledgeSearch(query).split(/\s+/).filter(Boolean);
    return entries.filter(entry => (!rarity || entry.rarity === rarity) && (!season || entry.season === season)
      && (!group || entry.group === group) && words.every(word => entry.searchText.includes(word)));
  }, [entries, query, rarity, season, group]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = catalog.find(entry => entry.id === selectedId);
  const activeTab = KNOWLEDGE_TABS.find(candidate => candidate.id === tab)!;
  const hasFilters = Boolean(query || rarity || season || group);

  useEffect(() => { backButton.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    tabButtons.current[KNOWLEDGE_TABS.findIndex(category => category.id === tab)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [currentPage, tab, query, rarity, season, group]);
  useEffect(() => {
    if (!selectedId) return;
    details.current?.scrollTo({ top: 0 });
    details.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [selectedId]);

  const closeDetails = () => {
    setSelectedId(null);
    requestAnimationFrame(() => lastSelectedButton.current?.isConnected
      ? lastSelectedButton.current.focus({ preventScroll: true }) : list.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
  };
  const resetFilters = () => { setQuery(''); setRarity(''); setSeason(''); setGroup(''); setPage(0); setSelectedId(null); };
  const changeTab = (next: KnowledgeTabId) => { setTab(next); resetFilters(); };
  const navigate = (nextTab: KnowledgeTabId, sourceId: string) => {
    const next = catalog.find(entry => entry.tab === nextTab && entry.sourceId === sourceId);
    if (!next) return;
    const index = catalog.filter(entry => entry.tab === nextTab).findIndex(entry => entry.id === next.id);
    setTab(nextTab); setQuery(''); setRarity(''); setSeason(''); setGroup('');
    setPage(Math.floor(index / PAGE_SIZE)); setSelectedId(next.id);
  };
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % KNOWLEDGE_TABS.length
      : event.key === 'ArrowLeft' ? (index + KNOWLEDGE_TABS.length - 1) % KNOWLEDGE_TABS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? KNOWLEDGE_TABS.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault(); changeTab(KNOWLEDGE_TABS[next].id); tabButtons.current[next]?.focus();
  };

  return <section className="knowledge-base" aria-labelledby="knowledge-heading" data-detail-open={Boolean(selected)}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (selected) closeDetails(); else onBack(); } }}>
    <header className="knowledge-heading">
      <button ref={backButton} className="knowledge-back" onClick={onBack} aria-label="В главное меню"><span aria-hidden="true">←</span><span>Меню</span></button>
      <div><span className="eyebrow">Хроники четырёх сезонов</span><h1 id="knowledge-heading">База знаний</h1></div>
      <svg className="knowledge-book" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 13C18 8 11 8 5 10v28c6-2 13-2 19 3 6-5 13-5 19-3V10c-6-2-13-2-19 3Zm0 0v28M11 17l7 1m-7 6 7 1m12-7 7-1m-7 8 7-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </header>
    <nav className="knowledge-tabs" role="tablist" aria-label="Разделы базы знаний">
      {KNOWLEDGE_TABS.map((category, index) => <button key={category.id} ref={node => { tabButtons.current[index] = node; }}
        type="button" role="tab" id={`knowledge-tab-${category.id}`} aria-selected={tab === category.id}
        aria-controls="knowledge-content" tabIndex={tab === category.id ? 0 : -1} onClick={() => changeTab(category.id)} onKeyDown={event => tabKey(event, index)}>
        {category.label}<small>{count(catalog.filter(entry => entry.tab === category.id).length)}</small>
      </button>)}
    </nav>
    <div className="knowledge-tools">
      <label className="knowledge-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" /><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <input type="search" aria-label={`Поиск: ${activeTab.label}`} value={query} placeholder="Название или описание…"
          onChange={event => { setQuery(event.target.value); setPage(0); setSelectedId(null); }} />
      </label>
      <div className="knowledge-filters">
        {groups.length > 1 && <select aria-label="Тип записи" value={group} onChange={event => { setGroup(event.target.value); setPage(0); setSelectedId(null); }}>
          <option value="">Все типы</option>{groups.map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
        {rarities.length > 0 && <select aria-label="Редкость" value={rarity} onChange={event => { setRarity(event.target.value as RewardRarity | ''); setPage(0); setSelectedId(null); }}>
          <option value="">Любая редкость</option>{rarities.map(value => <option key={value} value={value}>{EQUIPMENT_RARITY_NAMES[value]}</option>)}
        </select>}
        {seasons.length > 0 && <select aria-label="Сезон" value={season} onChange={event => { setSeason(event.target.value as Season | ''); setPage(0); setSelectedId(null); }}>
          <option value="">Все сезоны</option>{seasons.map(value => <option key={value} value={value}>{seasonNames[value]}</option>)}
        </select>}
        {hasFilters && <button className="knowledge-clear" onClick={resetFilters}>Сбросить</button>}
      </div>
    </div>
    <div id="knowledge-content" className="knowledge-content" role="tabpanel" aria-labelledby={`knowledge-tab-${tab}`}>
      <div className="knowledge-browser">
        <div className="knowledge-list-heading"><strong>{activeTab.label}</strong><span role="status">{count(filtered.length)} из {count(entries.length)}</span></div>
        <ul ref={list} className="knowledge-list" aria-label={activeTab.label}>
          {visible.map(entry => <li key={entry.id}><button type="button" data-equipment-rarity={entry.rarity} aria-pressed={selectedId === entry.id}
            onClick={event => { lastSelectedButton.current = event.currentTarget; setSelectedId(entry.id); }}>
            <span className="knowledge-entry-art"><KnowledgeEntryIcon entry={entry} size={42} /></span>
            <span className="knowledge-entry-copy"><strong>{entry.name}</strong><small>{entry.subtitle}</small></span><span className="knowledge-entry-arrow" aria-hidden="true">›</span>
          </button></li>)}
          {!visible.length && <li className="knowledge-empty"><strong>Ничего не найдено</strong><p>Попробуйте другое название или уберите фильтры.</p><button onClick={resetFilters}>Сбросить поиск</button></li>}
        </ul>
        <div className="knowledge-pagination" aria-label="Страницы каталога">
          <button disabled={currentPage === 0} aria-label="Предыдущая страница" onClick={() => setPage(currentPage - 1)}>←</button>
          <span aria-live="polite" aria-atomic="true">{currentPage + 1}<small> / {pages}</small></span>
          <button disabled={currentPage + 1 >= pages} aria-label="Следующая страница" onClick={() => setPage(currentPage + 1)}>→</button>
        </div>
      </div>
      <article ref={details} className="knowledge-detail" aria-label={selected ? `Описание: ${selected.name}` : 'Описание записи'}>
        {selected ? <>
          <button className="knowledge-list-back" onClick={closeDetails}>← К списку</button>
          <header className="knowledge-detail-heading" data-equipment-rarity={selected.rarity}>
            <span className="knowledge-detail-art"><KnowledgeEntryIcon entry={selected} size={72} /></span>
            <div><span className="knowledge-detail-subtitle">{selected.subtitle}</span><h2 tabIndex={-1}>{selected.name}</h2>{selected.rarity && <EquipmentRarityBadge rarity={selected.rarity} />}</div>
          </header>
          <KnowledgeDetails entry={selected} onNavigate={navigate} />
        </> : <div className="knowledge-detail-placeholder"><span aria-hidden="true">✧</span><h2>У каждого открытия своя история</h2><p>Выберите запись, чтобы узнать её свойства, способности и связи с другими находками.</p></div>}
      </article>
    </div>
  </section>;
}
