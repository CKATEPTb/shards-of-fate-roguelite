import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { previewRoamingEncounter } from '@shards/game-core';
import { useExpedition } from "./hooks/useExpedition";
import { GameDialog } from "./components/exploration/GameDialog";
import { InformationHud } from "./components/exploration/InformationHud";
import { LoadoutHud } from "./components/exploration/LoadoutHud";
import { MenuPanel } from "./components/exploration/MenuPanel";
import { BattleOverlay } from "./components/exploration/BattleOverlay";
import { useVictoryChance } from './hooks/useVictoryChance';
import { CampfirePanel } from './components/exploration/CampfirePanel';
import type { ExpeditionState } from '@shards/shared';

const WorldCanvas = lazy(() => import("./world/WorldCanvas").then((module) => ({ default: module.WorldCanvas })));

export function ExpeditionGame({ initial, onCheckpoint, onEnded, onLeave }: { initial: ExpeditionState; onCheckpoint: (state: ExpeditionState) => boolean; onEnded: () => void; onLeave: (state: ExpeditionState) => void }) {
  const expedition = useExpedition(initial, onCheckpoint, onEnded);
  const { world, controlledActorId, combat, partyState, reducedMotion, notice, setPaused, campfire, defeated } = expedition;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [inspectedGroupId, setInspectedGroupId] = useState<string | null>(null);
  const inspectMob = useCallback((id: string | null) => {
    setInspectedGroupId(id);
    if (id) expedition.setNotice('');
  }, [expedition.setNotice]);
  const groups = expedition.groups;
  const encounters = useMemo(() => (groups ?? []).map(group => previewRoamingEncounter(world.chunk, groups ?? [], world.actors, group.id)), [world.chunk, world.actors, groups]);
  const inspected = groups?.find(group => group.id === inspectedGroupId);
  const encounter = inspected ? encounters[groups!.indexOf(inspected)] : undefined;
  const chance = useVictoryChance(world.actors.map(actor => actor.id), encounters.map(item => item?.enemyIds ?? []), encounter?.enemyIds, world.actors, expedition.difficultyId);
  const groupChances = useMemo(() => Object.fromEntries((groups ?? []).map((group, index) =>
    [group.id, chance.results[index]?.percent])), [groups, chance.results]);
  useEffect(() => { setInspectedGroupId(null); }, [world.currentChunkId, world.graph, combat !== null, menuOpen, campfire !== null, defeated]);
  const dialogOpen = menuOpen || campfire !== null || defeated;

  useEffect(() => { setPaused(menuOpen); }, [menuOpen, setPaused]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (menuOpen || !combat || event.target instanceof HTMLElement && event.target.closest("button,input,select,textarea") || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.code === "Space") { event.preventDefault(); expedition.toggleCombat(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen, combat, expedition.toggleCombat]);

  return (
    <main className={`game ${reducedMotion ? "reduced-motion" : ""}`} aria-label="Осколки судьбы">
      <div className="game-playfield" inert={dialogOpen}>
        <div className="world-stage" aria-hidden={combat ? true : undefined}>
          <Suspense fallback={<div className="scene-loading" role="status">Лес просыпается…</div>}>
            <WorldCanvas state={world} controlledActorId={controlledActorId} reducedMotion={reducedMotion} onMove={expedition.move} disabled={menuOpen || combat !== null || defeated} inCombat={combat !== null} clearedPoiIds={expedition.clearedPoiIds}
              groups={groups} previewGroupIds={encounter?.groupIds} onInspectMob={inspectMob} inspectedGroupId={inspectedGroupId} groupChances={groupChances} />
          </Suspense>
        </div>
        <div className="world-shade" />
        <InformationHud world={world} state={partyState} selected={controlledActorId} disabled={dialogOpen} />
        <LoadoutHud state={partyState} controlledActorId={controlledActorId} disabled={dialogOpen} />
        {combat && <BattleOverlay state={combat} selected={controlledActorId} playing={expedition.playing} speed={expedition.speed} reducedMotion={reducedMotion} onPlay={expedition.toggleCombat} onStep={expedition.stepCombat} onSpeed={expedition.setSpeed} onContinue={expedition.continueExploration} />}
        <button className="game-menu-button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog"><span aria-hidden="true">☰</span>Меню</button>
      </div>
      {menuOpen && <GameDialog title="Привал" onClose={closeMenu} className="panel-menu">
        <MenuPanel reducedMotion={reducedMotion} onReducedMotion={expedition.setReducedMotion} onLeave={() => onLeave(expedition.current.current)} onResume={closeMenu} />
      </GameDialog>}
      {!menuOpen && !combat && !defeated && campfire && <GameDialog title="У костра" onClose={expedition.closeCampfire} className="panel-campfire">
        <CampfirePanel canRest={campfire.canRest} reason={campfire.reason} onRest={expedition.rest} />
      </GameDialog>}
      {!menuOpen && !combat && defeated && <GameDialog title="Поход завершён" onClose={() => setMenuOpen(true)} className="panel-expedition-ended">
        <div className="expedition-ended-panel" data-testid="expedition-ended">
          <p>Сессия завершена. Следующее путешествие начнётся у нового костра.</p>
          <div className="expedition-ended-actions">
            <button className="primary-button" onClick={() => onLeave(expedition.current.current)}>В главное меню</button>
          </div>
        </div>
      </GameDialog>}
      {notice && <div className="game-notice glass-panel" role="status"><span>{notice}</span><button onClick={() => expedition.setNotice("")} aria-label="Закрыть уведомление">×</button></div>}
    </main>
  );
}
