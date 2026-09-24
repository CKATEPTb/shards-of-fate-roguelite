import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { commandCoop, contentWithLoadouts, createCombat, createCoopState } from '@shards/game-core';
import { CATALOG_EQUIPMENT_ITEMS, equipItem, gameContent, skillPoolsByRarity } from '@shards/game-data';
import type { AdventureReward, CoopCommand, EquipmentItemDefinition } from '@shards/shared';
import { AdventureRewards } from '../components/exploration/AdventureRewards';
import { LoadoutHud } from '../components/exploration/LoadoutHud';
import { FittingHero } from '../components/exploration/rewardPresentation';
import { initAudio, playSound, setAudioScene } from '../audio/engine';
import '../styles.css';
import './rewardFittingPreview.css';

const firstHero = gameContent.characters.find(hero => hero.id === 'guardian') ?? gameContent.characters[0];
const inventoryPreview = new URLSearchParams(window.location.search).get('inventory') === '1';

/** Curated catalogue examples; browsing the workshop never advances the game's dice. */
function workshopRewards(heroId: string, batch: number): AdventureReward[] {
  const queries: Array<(item: EquipmentItemDefinition) => boolean> = [
    item => item.slot === 'head' && item.rarity === 'common',
    item => item.slot === 'chest' && item.rarity === 'rare',
    item => item.slot === 'boots' && item.rarity === 'common',
    item => item.slot === 'ring1' && item.rarity === 'epic',
    item => item.slot === 'ring2' && item.rarity === 'legendary',
    item => item.weapon?.kind === 'sword' && item.rarity === 'rare',
    item => item.weapon?.kind === 'dagger' && item.rarity === 'epic',
    item => item.weapon?.kind === 'shield' && item.rarity === 'rare',
    item => item.weapon?.hands === 2 && item.rarity === 'legendary',
  ];
  const items = queries.map((query, index) => {
    const pool = CATALOG_EQUIPMENT_ITEMS.filter(query);
    const item = pool[(batch + index * 3) % pool.length];
    if (!item) throw new Error(`Missing workshop equipment pool: ${index}`);
    return item;
  });
  const abilities = (['rare', 'epic', 'legendary'] as const).map((rarity, index) => {
    const pool = skillPoolsByRarity[rarity];
    return pool[(batch + index * 7) % pool.length];
  });
  const reward = (kind: AdventureReward['kind'], item: { id: string; rarity?: AdventureReward['rarity'] }, index: number): AdventureReward => ({
    id: `workshop:${heroId}:${batch}:${index}`, kind, definitionId: item.id, rarity: item.rarity ?? 'common',
    source: `workshop:${batch}`, luckRolls: [],
  });
  return [...items.map((item, index) => reward('equipment', item, index)), ...abilities.map((skill, index) => reward('skill', skill, items.length + index))];
}

function workshopState(heroId: string, batch: number) {
  const state = createCoopState('inventory-workshop', [heroId], gameContent);
  const rewards = workshopRewards(heroId, batch);
  const sets = new Set(rewards.slice(0, 2).map(reward => CATALOG_EQUIPMENT_ITEMS.find(item => item.id === reward.definitionId)?.setId));
  const collection: AdventureReward[] = inventoryPreview ? CATALOG_EQUIPMENT_ITEMS.filter(item => item.setId && sets.has(item.setId)
    && !rewards.some(reward => reward.definitionId === item.id)).map((item, index) => ({
      id: `workshop-set:${heroId}:${batch}:${index}`, kind: 'equipment', definitionId: item.id, rarity: item.rarity ?? 'common',
      source: `workshop:${batch}`, luckRolls: [],
    })) : [];
  state.progression!.heroes[heroId] = { ...state.progression!.heroes[heroId], coins: 240,
    rewards: inventoryPreview ? [] : rewards, inventory: inventoryPreview ? [...rewards, ...collection] : [] };
  return state;
}

function RewardFittingWorkshop() {
  const [heroId, setHeroId] = useState(firstHero.id);
  const [batch, setBatch] = useState(0);
  const [state, setState] = useState(() => workshopState(firstHero.id, 0));
  const current = useRef(state);
  current.current = state;
  const progress = state.progression!.heroes[heroId];
  const [open, setOpen] = useState(!inventoryPreview);
  const [sheetRequest, setSheetRequest] = useState(inventoryPreview ? 1 : 0);
  const [message, setMessage] = useState('');
  const hero = gameContent.characters.find(item => item.id === heroId) ?? firstHero;
  const equipped = useMemo(() => progress.equipment.map(item => equipItem(item.itemId, item.slot)), [progress.equipment]);
  const body = state.actors.find(actor => actor.id === heroId)?.body;
  const content = useMemo(() => contentWithLoadouts(gameContent, state.progression!.heroes), [state.progression]);
  const sheet = useMemo(() => createCombat({ seed: 'inventory-sheet', characterIds: [heroId], encounterId: gameContent.encounters[0].id,
    heroBodies: body ? { [heroId]: body } : undefined }, content), [heroId, body, content]);
  useEffect(initAudio, []);
  useEffect(() => setAudioScene({ kind: 'camp', season: 'spring' }), []);

  const send = (command: CoopCommand): boolean => {
    const result = commandCoop(current.current, heroId, command, gameContent);
    if (!result.accepted) { setMessage(result.reason ?? 'Не удалось применить выбор.'); return false; }
    current.current = result.state;
    setState(result.state);
    setMessage(command.type === 'set-auto-equipment' ? command.enabled ? 'Автозамена экипировки включена.' : 'Автозамена экипировки выключена.'
      : command.type === 'collect-rewards' ? 'Все находки в сумке.' : command.type === 'collect-reward' ? 'Находка в сумке.' : command.type === 'equip-inventory' ? 'Снаряжение обновлено.' : 'Неподобранные находки оставлены.');
    if (command.type === 'equip-inventory') playSound('equip', { volume: .65 });
    return true;
  };

  const newLoot = () => {
    const next = batch + 1;
    setBatch(next); setMessage('');
    const updated = { ...current.current, progression: { ...current.current.progression!, heroes: {
      ...current.current.progression!.heroes, [heroId]: { ...current.current.progression!.heroes[heroId], rewards: workshopRewards(heroId, next) },
    } } };
    current.current = updated; setState(updated);
    setOpen(true);
  };
  const changeHero = (id: string) => {
    const nextHero = gameContent.characters.find(item => item.id === id);
    if (!nextHero || open) return;
    const next = batch + 1;
    setHeroId(id); setBatch(next); setMessage(''); setSheetRequest(inventoryPreview ? 1 : 0);
    const updated = workshopState(id, next); current.current = updated; setState(updated); setOpen(!inventoryPreview);
  };

  return <main className="reward-fitting-preview" aria-label="Мастерская добычи и экипировки">
    <header className="reward-preview-controls">
      <div><span>Мастерская</span><strong>Добыча и экипировка</strong></div>
      <label><span className="sr-only">Персонаж</span><select value={heroId} disabled={open} onChange={event => changeHero(event.target.value)}
        title={open ? 'Закройте окно наград, чтобы сменить персонажа' : 'Начать примерку за другого персонажа'}>
        {gameContent.characters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <small>Только в этой вкладке</small>
    </header>
    <section className="reward-preview-stage" aria-hidden={open} inert={open}>
      <div className="reward-preview-splash">
        <div className="reward-preview-hero"><FittingHero hero={hero} equipment={equipped} body={body} facing="south" /><span aria-hidden="true">◇</span></div>
        <span className="reward-preview-eyebrow">Привал после похода</span>
        <h1>{hero.name}</h1>
        <p>Откройте персонажа: слева — сумка, рядом — снаряжение и бонусы комплектов.</p>
        <dl className="reward-preview-summary" aria-label="Собранные находки">
          <div><dt>В сумке</dt><dd>{progress.inventory?.length ?? 0}</dd></div>
          <div><dt>Надето</dt><dd>{progress.equipment.length}</dd></div>
          <div><dt>Способности</dt><dd>{progress.skills.filter(Boolean).length}</dd></div>
          <div><dt>Монеты</dt><dd>{progress.coins}</dd></div>
        </dl>
        <button type="button" className="reward-preview-open" onClick={() => setSheetRequest(value => value + 1)}>Открыть персонажа <span aria-hidden="true">↗</span></button>
        <button type="button" className="reward-preview-open reward-preview-more" onClick={newLoot}>Новая добыча <span aria-hidden="true">↗</span></button>
        <small>Нажатие на вещь — сравнение, повторное — экипировка.<br />Сохранения приключения не меняются.</small>
        <p role="status" className="reward-preview-notice">{message}</p>
      </div>
    </section>
    <LoadoutHud key={`${heroId}:${sheetRequest}`} state={sheet} content={content} controlledActorId={heroId} disabled={open} initialOpen={sheetRequest > 0}
      progress={progress} onEquipInventory={(inventoryId, slot) => send({ type: 'equip-inventory', inventoryId, slot })}
      onSetAutoEquipment={enabled => send({ type: 'set-auto-equipment', enabled })} />
    {open && <AdventureRewards key={`${heroId}:${batch}`} heroId={heroId} progress={progress} body={body}
      onCollect={rewardId => send({ type: 'collect-reward', rewardId })} onCollectAll={rewardIds => send({ type: 'collect-rewards', rewardIds })}
      onResolve={choice => send({ type: 'resolve-rewards', ...choice })} onClose={() => setOpen(false)} />}
  </main>;
}

// Reuse the workshop root on HMR; creating another root leaves old portals behind.
const previewRoot: ReturnType<typeof createRoot> = import.meta.hot?.data.rewardFittingRoot ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) {
  import.meta.hot.data.rewardFittingRoot = previewRoot;
  import.meta.hot.accept();
}
previewRoot.render(<RewardFittingWorkshop />);
