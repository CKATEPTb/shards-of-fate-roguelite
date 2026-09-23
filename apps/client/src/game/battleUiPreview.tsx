import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCombat, createExploration, generateChunk, isTerminal, stepCombat, submitCombatAction } from '@shards/game-core';
import type { CombatChoice, CombatState, Season } from '@shards/shared';
import { gameContent } from '../catalog';
import { BattleOverlay } from '../components/exploration/BattleOverlay';
import { makeBattleEnvironment } from './battleEnvironment';
import '../styles.css';
import './battleUiPreview.css';

const world = createExploration({ seed: 'battle-workshop', characterIds: ['guardian', 'priest', 'mage', 'ranger'], structureVersion: 2 });

function start(hero: string): CombatState {
  const characterIds = [...new Set([hero, 'guardian', 'priest', 'ranger'])].slice(0, 4);
  // Start before the first roll so the queue workshop presents every initiative die.
  return createCombat({ seed: `card-workshop-${hero}`, encounterId: 'roaming', characterIds, enemyIds: ['wolf', 'goblin_scout', 'goblin_shaman'] }, gameContent);
}

function BattleWorkshop() {
  const [hero, setHero] = useState('mage');
  const [season, setSeason] = useState<Season>('autumn');
  const [place, setPlace] = useState('ruin');
  const [state, setState] = useState(() => start('mage'));
  const [presented, setPresented] = useState<CombatState>();
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const environment = useMemo(() => {
    const node = world.graph.nodes.find(node => node.season === season)!;
    const chunk = generateChunk(world.graph, node.id);
    const structure = chunk.structures.find(structure => structure.kind === place) ?? chunk.structures[0];
    const terrainIndex = chunk.tiles.findIndex(tile => tile.terrain === place);
    const focus = place === 'campfire' ? chunk.pois.find(poi => poi.kind === 'campfire')?.position ?? chunk.spawn
      : terrainIndex >= 0 ? { x: terrainIndex % chunk.size, y: Math.floor(terrainIndex / chunk.size) }
      : structure?.approach ?? chunk.spawn;
    return makeBattleEnvironment({ ...world, chunk, currentChunkId: chunk.id }, focus);
  }, [season, place]);
  const onPresented = useCallback((next: CombatState) => setPresented(next), []);
  useEffect(() => {
    if (isTerminal(state) || state.pendingActorId || presented?.nextSequence !== state.nextSequence) return;
    const timer = window.setTimeout(() => setState(current => stepCombat(current, gameContent)), 100);
    return () => clearTimeout(timer);
  }, [state, presented]);
  const act = (choice: CombatChoice) => { setState(current => submitCombatAction(current, gameContent, choice)); return true; };
  const reset = (next = hero) => { setPresented(undefined); setState(start(next)); };
  return <div className="battle-workshop">
    <header className="battle-workshop-tools">
      <span>Мастерская боя</span>
      <label><span className="sr-only">Персонаж</span><select value={hero} onChange={event => { setHero(event.target.value); reset(event.target.value); }}>{gameContent.characters.map(hero => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select></label>
      <label><span className="sr-only">Время года</span><select value={season} onChange={event => setSeason(event.target.value as Season)}><option value="spring">Весна</option><option value="summer">Лето</option><option value="autumn">Осень</option><option value="winter">Зима</option></select></label>
      <label><span className="sr-only">Место встречи</span><select value={place} onChange={event => setPlace(event.target.value)}><option value="ruin">У строения</option><option value="water">У воды</option><option value="tree">В лесу</option><option value="path">На дороге</option><option value="campfire">У костра</option></select></label>
      <button onClick={() => reset()} aria-label="Начать бой заново">↻</button>
    </header>
    <main className={`game ${reduced ? 'reduced-motion' : ''}`} aria-label="Предпросмотр боя">
      <BattleOverlay state={state} environment={environment} selected={hero} reducedMotion={reduced}
        onAction={act} onContinue={() => reset()} onPresented={onPresented} />
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<BattleWorkshop />);
