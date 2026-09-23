import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCombat, syncBodyCombatant, bodyPartLossThreshold } from '@shards/game-core';
import { gameContent } from '../catalog';
import { LoadoutHud } from '../components/exploration/LoadoutHud';
import '../styles.css';
import '../world/gameViewport.css';
import './characterSheetPreview.css';

function CharacterWorkshop() {
  const [heroId, setHeroId] = useState('guardian');
  const [condition, setCondition] = useState('healthy');
  const [effect, setEffect] = useState('none');
  const [inCombat, setInCombat] = useState(true);
  const state = useMemo(() => {
    const next = createCombat({ seed: 'character-sheet-workshop', characterIds: [...new Set([heroId, 'priest', 'druid', 'necromancer'])], encounterId: 'preview', enemyIds: ['wolf'] }, gameContent);
    const hero = next.units[0];
    // The workshop presents a battle state without running turns or changing a saved expedition.
    next.status = inCombat ? 'running' : 'ready';
    if (hero.body) {
      if (condition === 'injured') {
        hero.body.torso.current = Math.ceil(hero.body.torso.max * .6);
        hero.body.leftArm.current = Math.ceil(hero.body.leftArm.max * .35);
        hero.body.rightLeg.current = Math.ceil(hero.body.rightLeg.max * .55);
      }
      if (condition === 'disabled') hero.body.rightArm.current = 0;
      if (condition === 'critical') { hero.body.head.current = -5; hero.body.torso.current = 0; }
      if (condition === 'lost') { hero.body.rightArm.current = bodyPartLossThreshold(hero.body.rightArm.max); hero.body.rightArm.lost = true; }
      syncBodyCombatant(hero, gameContent.characters.find(item => item.id === heroId)!);
    }
    if (inCombat) {
      const sourceFor = (id: string) => next.units.find(unit => unit.definitionId === id)?.id ?? hero.id;
      if (effect === 'blessing' || effect === 'mixed') hero.statuses.push({ id: 'inspired', instanceId: 'workshop-blessing', sourceId: sourceFor('priest'), remaining: 2, appliedTurn: 0 });
      if (effect === 'regrowth' || effect === 'mixed') hero.statuses.push({ id: 'regrowth', instanceId: 'workshop-regrowth', sourceId: sourceFor('druid'), remaining: 3, appliedTurn: 0 });
      if (effect === 'rage') hero.statuses.push({ id: 'rage', instanceId: 'workshop-rage', sourceId: hero.id, remaining: 3, appliedTurn: 0 });
      if (effect === 'bleeding') hero.statuses.push({ id: 'bleeding', instanceId: 'workshop-bleeding', sourceId: next.units.find(unit => unit.team === 'enemies')!.id, remaining: 3, appliedTurn: 0 });
      if (effect === 'shield') {
        hero.shield = 17;
        hero.shieldLayers = [{ sourceId: sourceFor('necromancer'), capacity: 17, remaining: 3, appliedTurn: 0 }];
      }
    }
    return next;
  }, [heroId, condition, effect, inCombat]);
  return <div className="character-workshop">
    <main className="game" aria-label="Предпросмотр окна персонажа"><LoadoutHud state={state} controlledActorId={heroId} disabled={false} initialOpen /></main>
    <header className="character-workshop-controls">
      <label><span className="sr-only">Персонаж</span><select value={heroId} onChange={event => setHeroId(event.target.value)}>{gameContent.characters.map(hero => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select></label>
      <label><span className="sr-only">Состояние тела</span><select value={condition} onChange={event => setCondition(event.target.value)}><option value="healthy">Без ранений</option><option value="injured">Ранения</option><option value="disabled">Правая рука не действует</option><option value="critical">Голова и торс ниже нуля</option><option value="lost">Утрачена правая рука</option></select></label>
      <label><span className="sr-only">Наложенные эффекты</span><select value={effect} onChange={event => setEffect(event.target.value)} disabled={!inCombat}>
        <option value="none">Без эффектов</option><option value="blessing">Благословение</option><option value="regrowth">Регенерация</option>
        <option value="rage">Ярость</option><option value="bleeding">Кровотечение</option><option value="shield">Костяной щит</option><option value="mixed">Благословение + регенерация</option>
      </select></label>
      <label><input type="checkbox" checked={inCombat} onChange={event => setInCombat(event.target.checked)} />В бою</label>
    </header>
  </div>;
}

createRoot(document.getElementById('root')!).render(<CharacterWorkshop />);
