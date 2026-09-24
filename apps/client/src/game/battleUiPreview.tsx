import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCombat, createExploration, generateChunk, isTerminal, stepCombat, submitCombatAction } from '@shards/game-core';
import type { CombatChoice, CombatState, Season, UnitDefinition } from '@shards/shared';
import { gameContent } from '../catalog';
import { BattleOverlay } from '../components/exploration/BattleOverlay';
import { makeBattleEnvironment } from './battleEnvironment';
import '../styles.css';
import './battleUiPreview.css';

const world = createExploration({ seed: 'battle-workshop', characterIds: ['guardian', 'priest', 'mage', 'ranger'], structureVersion: 2 });
const bosses = gameContent.enemies.filter(enemy => enemy.tags.includes('BOSS'));
const seasons: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const selectStyle = { width: 'min(145px, 20vw)' };

function bossSeason(boss: UnitDefinition): Season {
  return seasons.find(season => boss.tags.includes(`SEASON_${season.toUpperCase()}`)) ?? 'spring';
}

function encounterEnemies(encounter: string): string[] {
  const boss = bosses.find(enemy => enemy.id === encounter);
  if (!boss) return ['wolf', 'goblin_scout', 'goblin_shaman'];
  const season = bossSeason(boss), tier = 2 + seasons.indexOf(season);
  const seasonal = gameContent.enemies.filter(enemy => enemy.id.startsWith('act1_')
    && enemy.tags.includes(`SEASON_${season.toUpperCase()}`) && !enemy.tags.includes('BASEMENT') && !enemy.tags.includes('AQUATIC'));
  const ranked = seasonal.filter(enemy => enemy.tags.includes(`TIER_${tier}`));
  const pool = ranked.length >= 2 ? ranked : seasonal;
  const first = pool.find(enemy => enemy.role === 'damage') ?? pool[0];
  const family = first.tags.find(tag => tag.startsWith('FAMILY_'));
  const relatives = pool.filter(enemy => enemy.id !== first.id && (!family || enemy.tags.includes(family)));
  const remaining = relatives.length ? relatives : pool.filter(enemy => enemy.id !== first.id);
  const second = remaining.find(enemy => enemy.role === (boss.role === 'healer' ? 'tank' : 'healer')) ?? remaining[0];
  return [boss.id, first.id, second.id];
}

function start(hero: string, encounter = 'normal'): CombatState {
  const characterIds = [...new Set([hero, 'guardian', 'priest', 'ranger'])].slice(0, 4);
  // Start before the first roll so the queue workshop presents every initiative die.
  return createCombat({ seed: `card-workshop-${hero}${encounter === 'normal' ? '' : `-${encounter}`}`,
    encounterId: 'roaming', characterIds, enemyIds: encounterEnemies(encounter) }, gameContent);
}

function BattleWorkshop() {
  const [hero, setHero] = useState('mage');
  const [encounter, setEncounter] = useState('normal');
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
  const reset = (next = hero, nextEncounter = encounter) => { setPresented(undefined); setState(start(next, nextEncounter)); };
  return <div className="battle-workshop">
    <header className="battle-workshop-tools">
      <span>Мастерская боя</span>
      <label><span className="sr-only">Персонаж</span><select style={selectStyle} value={hero} onChange={event => { setHero(event.target.value); reset(event.target.value); }}>{gameContent.characters.map(hero => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select></label>
      <label><span className="sr-only">Противники</span><select style={selectStyle} value={encounter} onChange={event => {
        const next = event.target.value;
        setEncounter(next);
        const boss = bosses.find(enemy => enemy.id === next);
        if (boss) setSeason(bossSeason(boss));
        reset(hero, next);
      }}><option value="normal">Обычный отряд</option>{bosses.map(boss => <option key={boss.id} value={boss.id}>{boss.name}</option>)}</select></label>
      <label><span className="sr-only">Время года</span><select style={selectStyle} value={season} onChange={event => setSeason(event.target.value as Season)}><option value="spring">Весна</option><option value="summer">Лето</option><option value="autumn">Осень</option><option value="winter">Зима</option></select></label>
      <label><span className="sr-only">Место встречи</span><select style={selectStyle} value={place} onChange={event => setPlace(event.target.value)}><option value="ruin">У строения</option><option value="water">У воды</option><option value="tree">В лесу</option><option value="path">На дороге</option><option value="campfire">У костра</option></select></label>
      <button onClick={() => reset()} aria-label="Начать бой заново">↻</button>
    </header>
    <main className={`game ${reduced ? 'reduced-motion' : ''}`} aria-label="Предпросмотр боя">
      <BattleOverlay state={state} environment={environment} selected={hero} reducedMotion={reduced}
        onAction={act} onContinue={() => reset()} onPresented={onPresented} />
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<BattleWorkshop />);
