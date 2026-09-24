import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { commandCoop, coopView, createCombat, createCoopState, generateChunk, seasonNpcNodeIds } from '@shards/game-core';
import { NPC_KINDS, type CoopCommand, type CoopState, type NpcKind, type Season } from '@shards/shared';
import { gameContent } from '../catalog';
import { NpcServiceDialog } from '../components/exploration/NpcServiceDialog';
import { LoadoutHud } from '../components/exploration/LoadoutHud';
import { RewardArt, rewardName } from '../components/exploration/rewardPresentation';
import { WorldCanvas } from '../world/WorldCanvas';
import { npcNames } from '../world/npcArt';
import { initAudio, setAudioScene } from '../audio/engine';
import '../styles.css';
import './npcServicesPreview.css';

const SEED = 'npc-services-workshop';
const seasons: Record<Season, string> = { spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима' };
const descriptions: Record<NpcKind, string> = {
  merchant: 'Полные комплекты и способности. Ассортимент определяется сидом, покупки каждого героя независимы.',
  blacksmith: 'Надетые предметы можно усилить до следующей редкости. Их облик и принадлежность к комплекту сохраняются.',
  scribe: 'Мастер усиливает классовое умение, активное умение, пассивку и две выбранные способности.',
};
const firstHero = gameContent.characters.find(hero => hero.id === 'guardian') ?? gameContent.characters[0];

/** Only the workshop teleports: service commands still validate the real generated approach point. */
function atService(state: CoopState, heroId: string, kind: NpcKind, season: Season): CoopState {
  const graph = coopView(state, heroId, gameContent).world.graph;
  const chunkId = seasonNpcNodeIds(graph)[season][kind];
  const chunk = generateChunk(graph, chunkId);
  const poi = chunk.pois.find(candidate => candidate.kind === 'npc' && candidate.npcKind === kind);
  if (!poi) throw new Error(`Missing workshop service: ${season}/${kind}`);
  return { ...state, actors: state.actors.map(actor => actor.id !== heroId ? actor : {
    ...actor, chunkId, position: { ...poi.position }, path: [],
    visited: [...new Set([...actor.visited, chunkId])],
    ...(actor.movement ? { movement: { ...actor.movement, elapsedMs: 0 } } : {}),
  }) };
}

function createWorkshop(heroId: string, kind: NpcKind, season: Season): CoopState {
  const state = createCoopState(SEED, [heroId], gameContent);
  const learnable = gameContent.skills.filter(skill => skill.tags.includes('LEARNABLE') && !skill.tags.includes('UPGRADED') && skill.rarity === 'common');
  const extra = [learnable.find(skill => skill.id === 'ember_lance') ?? learnable[0], learnable.find(skill => skill.id === 'flame_tending') ?? learnable[1]];
  state.progression!.heroes[heroId] = { ...state.progression!.heroes[heroId], coins: 10_000, skills: [extra[0]?.id ?? null, extra[1]?.id ?? null] };
  return atService(state, heroId, kind, season);
}

function NpcServicesWorkshop() {
  const [heroId, setHeroId] = useState(firstHero.id);
  const [kind, setKind] = useState<NpcKind>('merchant');
  const [season, setSeason] = useState<Season>('spring');
  const [state, setState] = useState(() => createWorkshop(firstHero.id, 'merchant', 'spring'));
  const current = useRef(state);
  current.current = state;
  const [open, setOpen] = useState(true);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const close = useCallback(() => setOpen(false), []);
  const view = useMemo(() => coopView(state, heroId, gameContent), [state, heroId]);
  const poi = view.world.chunk.pois.find(candidate => candidate.kind === 'npc' && candidate.npcKind === kind)!;
  const progress = state.progression!.heroes[heroId];
  const actor = state.actors.find(candidate => candidate.id === heroId)!;
  const content = view.content ?? gameContent;
  const sheet = useMemo(() => createCombat({ seed: 'npc-workshop-sheet', characterIds: [heroId], encounterId: gameContent.encounters[0].id,
    heroBodies: actor.body ? { [heroId]: actor.body } : undefined }, content), [heroId, actor.body, content]);
  useEffect(initAudio, []);
  useEffect(() => setAudioScene({ kind: 'camp', season }), [season]);

  const replace = (next: CoopState) => { current.current = next; setState(next); };
  const send = (command: CoopCommand): boolean => {
    const result = commandCoop(current.current, heroId, command, gameContent);
    if (!result.accepted) { setMessage(result.reason ?? 'Услуга сейчас недоступна.'); return false; }
    replace(result.state);
    setMessage(command.type === 'npc-buy' ? 'Покупка в сумке.' : command.type === 'npc-upgrade-equipment' ? 'Предмет усилен.'
      : command.type === 'npc-upgrade-skill' ? 'Способность усилена.' : 'Снаряжение обновлено.');
    return true;
  };
  const visit = (nextKind: NpcKind, nextSeason: Season) => {
    if (open) return;
    replace(atService(current.current, heroId, nextKind, nextSeason));
    setKind(nextKind); setSeason(nextSeason); setMessage('');
  };
  const reset = (nextHero = heroId) => {
    replace(createWorkshop(nextHero, kind, season));
    setHeroId(nextHero); setRevision(value => value + 1); setMessage('Новый пример: 10 000 монет, две способности и начальная экипировка.');
  };

  return <main className="npc-workshop" data-service={kind}>
    <header className="npc-workshop-toolbar" inert={open} aria-hidden={open}>
      <div className="npc-workshop-brand"><span>Мастерская</span><strong>Странники и мастера</strong></div>
      <div className="npc-workshop-selectors">
        <label><span>Герой</span><select value={heroId} onChange={event => reset(event.target.value)}>
          {gameContent.characters.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select></label>
        <label><span>Мастер</span><select value={kind} onChange={event => visit(event.target.value as NpcKind, season)}>
          {NPC_KINDS.map(candidate => <option key={candidate} value={candidate}>{npcNames[candidate]}</option>)}
        </select></label>
        <label><span>Сезон</span><select value={season} onChange={event => visit(kind, event.target.value as Season)}>
          {Object.entries(seasons).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      </div>
    </header>
    <div className="npc-workshop-body" inert={open} aria-hidden={open}>
      <section className="npc-workshop-map" aria-label="Дом мастера в сгенерированном мире">
        <WorldCanvas state={view.world} controlledActorId={heroId} reducedMotion={reduced} onMove={() => {}} disabled paused={false} groups={[]}
          clearedPoiIds={view.clearedPoiIds} content={content} />
        <div className="npc-workshop-map-caption"><span>{seasons[season]} · {view.world.currentChunkId}</span><strong>{npcNames[kind]}</strong><small>Реальный дом, персонаж и свет факела</small></div>
      </section>
      <aside className="npc-workshop-panel">
        <span className="npc-workshop-eyebrow">Остановка в пути</span>
        <h1>{npcNames[kind]}</h1><p className="npc-workshop-description">{descriptions[kind]}</p>
        <dl className="npc-workshop-wallet"><div><dt>Монеты</dt><dd>{progress.coins.toLocaleString('ru-RU')}</dd></div><div><dt>В сумке</dt><dd>{progress.inventory?.length ?? 0}</dd></div></dl>
        <button type="button" className="npc-workshop-open" onClick={() => setOpen(true)}>Открыть услуги <span aria-hidden="true">↗</span></button>
        <p className="npc-workshop-help">Окно персонажа — в левом верхнем углу карты. Там можно надеть покупку или выбрать способность из сумки.</p>
        {!!progress.inventory?.length && <details className="npc-workshop-bag"><summary>Содержимое сумки · {progress.inventory.length}</summary><ul>{progress.inventory.map(reward => <li key={reward.id}><RewardArt reward={reward} /><span>{rewardName(reward)}</span></li>)}</ul></details>}
        <div className="npc-workshop-utilities"><label><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} /> Меньше движения</label><button type="button" onClick={() => reset()}>Сбросить пример</button></div>
        <p className="npc-workshop-status" role="status">{message}</p>
        <p className="npc-workshop-note">Демонстрационный поход. Покупки и улучшения используют правила игры. Только в этой вкладке, без сохранения и сетевого подключения.</p>
        <code className="npc-workshop-seed">Сид: {SEED}</code>
      </aside>
    </div>
    <div className="npc-workshop-sheet"><LoadoutHud key={`${heroId}:${revision}`} state={sheet} controlledActorId={heroId} content={content} disabled={open}
      progress={progress} onEquipInventory={(inventoryId, slot) => send({ type: 'equip-inventory', inventoryId, slot })} /></div>
    {open && <NpcServiceDialog key={`${heroId}:${kind}:${season}:${revision}`} kind={kind} seed={state.seed} poiId={poi.id} heroId={heroId} progress={progress} onClose={close}
      onBuy={offerId => send({ type: 'npc-buy', chunkId: view.world.currentChunkId, poiId: poi.id, offerId })}
      onUpgradeEquipment={(slot, expectedItemId) => send({ type: 'npc-upgrade-equipment', chunkId: view.world.currentChunkId, poiId: poi.id, slot, expectedItemId })}
      onUpgradeSkill={(slot, expectedId, expectedRarity) => send({ type: 'npc-upgrade-skill', chunkId: view.world.currentChunkId, poiId: poi.id, slot, expectedId, expectedRarity })} />}
  </main>;
}

createRoot(document.getElementById('root')!).render(<NpcServicesWorkshop />);
