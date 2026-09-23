import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { previewCoopEncounter, previewRoamingEncounter } from '@shards/game-core';
import { useExpedition } from "./hooks/useExpedition";
import { GameDialog } from "./components/exploration/GameDialog";
import { InformationHud } from "./components/exploration/InformationHud";
import { LoadoutHud } from "./components/exploration/LoadoutHud";
import { MenuPanel } from "./components/exploration/MenuPanel";
import { BattleOverlay } from "./components/exploration/BattleOverlay";
import { AdventureRewards } from './components/exploration/AdventureRewards';
import { SeasonBossTimer } from './components/exploration/SeasonBossTimer';
import { BossSummonDialog } from './components/exploration/BossSummonDialog';
import type { ExpeditionState } from '@shards/shared';
import type { NetworkSession } from './network/session';
import { makeBattleEnvironment } from './game/battleEnvironment';
import { useGameAudio } from './audio/useGameAudio';

const WorldCanvas = lazy(() => import("./world/WorldCanvas").then((module) => ({ default: module.WorldCanvas })));

export function ExpeditionGame({ initial, onCheckpoint, onEnded, onLeave, network }: { initial: ExpeditionState; onCheckpoint: (state: ExpeditionState) => boolean; onEnded: () => void; onLeave: (state: ExpeditionState) => void; network?: NetworkSession }) {
  const expedition = useExpedition(initial, onCheckpoint, onEnded, network);
  const { world, controlledActorId, combat, partyState, reducedMotion, notice, setPaused, defeated } = expedition;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [inspectedGroupId, setInspectedGroupId] = useState<string | null>(null);
  const inspectMob = useCallback((id: string | null) => {
    setInspectedGroupId(id);
    if (id) expedition.setNotice('');
  }, [expedition.setNotice]);
  const groups = expedition.groups;
  const cooperative = network?.getCoopState() ?? expedition.current.current.cooperative;
  const expeditionState = expedition.current.current;
  const activeBattle = cooperative?.battles.find(battle => battle.combat === combat);
  const battleKey = combat ? JSON.stringify([world.graph.seed, activeBattle?.id
    ?? `${world.currentChunkId}:${expeditionState.roaming?.battleSerial ?? 0}:${expeditionState.activePoiId ?? combat.encounterId}`]) : undefined;
  useGameAudio(expeditionState, expedition.content, controlledActorId, battleKey, network?.getPresentationEpoch());
  // Encounter mobs stay locked in place even if the initiating hero later escapes.
  // Capture the local scenery once; action updates and late reinforcements keep it stable.
  const battleEnvironment = useMemo(() => {
    if (!combat) return undefined;
    const mobId = activeBattle?.initiatorMobId ?? expeditionState.roaming?.active?.mobId;
    const focus = (groups ?? []).flatMap(group => group.members).find(mob => mob.id === mobId)?.position
      ?? world.chunk.pois.find(poi => poi.id === expeditionState.activePoiId)?.position
      ?? world.actors.find(actor => actor.id === (activeBattle?.initiatorActorId ?? expeditionState.roaming?.active?.actorId ?? controlledActorId))?.position
      ?? world.chunk.spawn;
    return makeBattleEnvironment(world, focus, expedition.campfires);
  }, [battleKey]);
  const coopEncounters = useMemo(() => cooperative ? (groups ?? []).map(group => previewCoopEncounter(cooperative, controlledActorId, group.id)) : undefined,
    [cooperative, controlledActorId, groups]);
  const encounters = useMemo(() => coopEncounters ?? (groups ?? []).map(group => previewRoamingEncounter(world.chunk, groups ?? [], world.actors, group.id)), [coopEncounters, world.chunk, world.actors, groups]);
  const inspected = groups?.find(group => group.id === inspectedGroupId);
  const encounter = inspected ? encounters[groups!.indexOf(inspected)] : undefined;
  useEffect(() => { setInspectedGroupId(null); }, [world.currentChunkId, world.graph, combat !== null, menuOpen, expedition.rewardsOpen, !!expedition.bossSummon, defeated]);
  const victorious = expedition.completed && !expedition.failed;
  const runEnded = victorious || (network ? expedition.failed : defeated);
  const dialogOpen = menuOpen || expedition.rewardsOpen && !combat || !!expedition.bossSummon || runEnded;
  const victoryRewards = victorious && !defeated && (expedition.rewardsOpen || !!expedition.progress?.rewards.length);

  useEffect(() => { setPaused(!network && menuOpen); }, [menuOpen, network, setPaused]);

  return (
    <main className={`game ${reducedMotion ? "reduced-motion" : ""}`} data-season-bosses={!!expedition.bosses} aria-label="Осколки судьбы">
      <div className="game-playfield" inert={dialogOpen}>
        <div className="world-stage" aria-hidden={combat ? true : undefined}>
          <Suspense fallback={<div className="scene-loading" role="status">Лес просыпается…</div>}>
            <WorldCanvas content={expedition.content} campfires={expedition.campfires} onInteract={expedition.interact} state={world} controlledActorId={controlledActorId} reducedMotion={reducedMotion} onMove={expedition.move} disabled={dialogOpen || combat !== null || defeated} paused={combat !== null || runEnded} inCombat={combat !== null} clearedPoiIds={expedition.clearedPoiIds}
              groups={groups} previewGroupIds={encounter?.groupIds} onInspectMob={inspectMob} inspectedGroupId={inspectedGroupId} />
          </Suspense>
        </div>
        <div className="world-shade" />
        {!combat && <InformationHud content={expedition.content} world={world} state={partyState} selected={controlledActorId} disabled={dialogOpen} />}
        {!combat && <LoadoutHud content={expedition.content} state={partyState} controlledActorId={controlledActorId} disabled={dialogOpen}
          progress={expedition.progress} onEquipInventory={expedition.equipInventory} />}
        {combat && <BattleOverlay content={expedition.content} autoFinish state={combat} environment={battleEnvironment} selected={controlledActorId} reducedMotion={reducedMotion} onAction={expedition.chooseCombatAction} onPresented={expedition.combatPresented} controllableActorIds={expedition.controllableActorIds} onContinue={expedition.continueExploration} canControl={expedition.canControl} multiplayer={!!network} />}
        {!combat && expedition.progress && (expedition.progress.rewards.length > 0
          ? <button className="adventure-bag-button" onClick={() => expedition.setRewardsOpen(true)} aria-label="Неподобранная добыча">
            Добыча <b>{expedition.progress.rewards.length}</b><span aria-hidden="true">◇</span> {expedition.progress.coins} <small>монет</small>
          </button>
          : <div className="adventure-bag-button adventure-coin-counter" aria-label={`${expedition.progress.coins} монет`}>
            <span aria-hidden="true">◇</span> {expedition.progress.coins} <small>монет</small>
          </div>)}
        {!combat && <button className="game-menu-button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog"><span aria-hidden="true">☰</span>Меню</button>}
      </div>
      {expedition.bosses && <SeasonBossTimer progress={expedition.bosses} tick={world.tick} completed={victorious} />}
      {menuOpen && <GameDialog title="Привал" onClose={closeMenu} className="panel-menu">
        <MenuPanel reducedMotion={reducedMotion} onReducedMotion={expedition.setReducedMotion} onLeave={() => onLeave(expedition.current.current)} onResume={closeMenu} network={expedition.networkInfo} />
      </GameDialog>}
      {!menuOpen && !combat && !defeated && !expedition.bossSummon && expedition.rewardsOpen && expedition.progress && <AdventureRewards
        heroId={controlledActorId} progress={expedition.progress} body={world.actors.find(actor => actor.id === controlledActorId)?.body}
        onCollect={expedition.collectReward} onResolve={expedition.resolveRewards} onClose={() => expedition.setRewardsOpen(false)} />}
      {!menuOpen && !combat && expedition.bossSummon && <BossSummonDialog season={expedition.bossSummon.season} onCancel={expedition.cancelBossSummon} onConfirm={expedition.confirmBossSummon} />}
      {!menuOpen && !combat && runEnded && !victoryRewards && <GameDialog title={victorious ? 'Четыре сезона пройдены' : 'Поход завершён'} onClose={() => setMenuOpen(true)} className="panel-expedition-ended">
        <div className="expedition-ended-panel" data-testid="expedition-ended">
          <p>{victorious ? 'Боссы весны, лета, осени и зимы повержены. Ваш отряд победил!' : network ? 'Поход отряда завершён. Для нового путешествия создайте новую комнату.' : 'Сессия завершена. Следующее путешествие начнётся у нового костра.'}</p>
          <div className="expedition-ended-actions">
            <button className="primary-button" onClick={() => onLeave(expedition.current.current)}>В главное меню</button>
          </div>
        </div>
      </GameDialog>}
      {network && !notice && !menuOpen && defeated && !runEnded && <div className="game-notice glass-panel" role="status"><span>Ваш герой погиб. Можно наблюдать за отрядом или выйти через меню.{network.isHost ? ' Ваш выход закроет комнату; поход останется в сохранении.' : ''}</span></div>}
      {notice && <div className="game-notice glass-panel" role="status"><span>{notice}</span><button onClick={() => expedition.setNotice("")} aria-label="Закрыть уведомление">×</button></div>}
    </main>
  );
}
