import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { approachCampfire, chooseExpeditionCombatAction, commandCoop, coopView, createCombat, enableRoaming, isBodyAlive, leaveEncounter, moveExpedition, partyBodies, stepCoop, stepExpedition, stepExpeditionCombat, upgradeSoloAdventure, MOVEMENT_TICK_MS } from '@shards/game-core';
import { SEASON_BOSS_ORDER, type CombatChoice, type CombatState, type CoopCommand, type ExpeditionState, type GridPoint, type InventoryTarget, type RewardResolution, type Season } from '@shards/shared';
import { gameContent, isFinished } from '../catalog';
import type { NetworkSession } from '../network/session';
import { needsCheckpoint, sessionEnded } from '../session/storage';
import { planPoiApproach, poiApproachReadiness, type PoiApproach } from './poiApproach';

const subscribeLocal = () => () => undefined;
const getLocalConnection = () => null;
interface BossSummonRequest { poiId: string; chunkId: string; transitions: number; season: Season }

/** One clock drives solo and network worlds, including fires during cards and rewards. */
export function useExpedition(initial: ExpeditionState, onCheckpoint: (state: ExpeditionState) => boolean, onEnded: () => void, network?: NetworkSession) {
  const connection = useSyncExternalStore<ReturnType<NetworkSession['getSnapshot']> | null>(network?.subscribe ?? subscribeLocal, network?.getSnapshot ?? getLocalConnection);
  const controlledActorId = useRef(network?.controlledHeroId ?? initial.world.actors[0].id).current;
  const canControl = !network || connection?.status === 'connected';
  const [state, setState] = useState(() => network ? initial : upgradeSoloAdventure(initial, gameContent));
  const current = useRef(state);
  const [presentedCombat, setPresentedCombat] = useState<CombatState | null>(null);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const seenRewards = useRef(new Set<string>());
  const pendingInteraction = useRef<PoiApproach | null>(null);
  const [bossSummon, setBossSummon] = useState<BossSummonRequest | null>(null);
  const pendingSummon = useRef<BossSummonRequest | null>(null);
  const seenBosses = useRef(new Set((initial.bosses ?? initial.cooperative?.bosses)?.spawned.map(spawn => spawn.mobId) ?? []));
  const bossNoticesReady = useRef(true);
  const localBody = state.world.actors.find(actor => actor.id === controlledActorId)?.body;
  const defeated = !state.combat && (!!state.failed || !!localBody && !isBodyAlive(localBody));
  const content = state.content ?? gameContent;
  const progress = state.progression?.heroes[controlledActorId];

  useEffect(() => { if (connection?.error) setNotice(connection.error); }, [connection?.error]);
  useEffect(() => {
    const confirmed = network?.getConfirmedCoopState();
    const bosses = network ? confirmed?.bosses : state.bosses ?? state.cooperative?.bosses;
    if (!canControl || network && !confirmed) { bossNoticesReady.current = false; return; }
    if (!bosses) return;
    const unseen = bosses.spawned.filter(spawn => !seenBosses.current.has(spawn.mobId));
    for (const spawn of bosses.spawned) seenBosses.current.add(spawn.mobId);
    // Loading a checkpoint establishes a baseline; only later live summons are announced.
    if (!bossNoticesReady.current) { bossNoticesReady.current = true; return; }
    const latest = unseen.at(-1);
    if (!latest) return;
    const season = { spring: 'весны', summer: 'лета', autumn: 'осени', winter: 'зимы' }[latest.season];
    const boss = content.enemies.find(enemy => enemy.id === latest.enemyId)?.name ?? `Босс ${season}`;
    const hero = content.characters.find(character => character.id === latest.actorId)?.name ?? latest.actorId;
    setNotice(`Босс ${season}: ${boss}. Он появился ${latest.actorId === controlledActorId ? 'рядом с вами' : `рядом с героем «${hero}»`}.`);
  }, [state, canControl, network, content, controlledActorId]);
  useEffect(() => {
    if (state.combat || defeated) {
      setRewardsOpen(false);
      // An encounter interrupts fitting without accepting or forfeiting its offers.
      if (state.combat) for (const reward of progress?.rewards ?? []) seenRewards.current.delete(reward.id);
      return;
    }
    const rewards = progress?.rewards ?? [];
    if (rewards.some(reward => !seenRewards.current.has(reward.id))) setRewardsOpen(true);
    for (const reward of rewards) seenRewards.current.add(reward.id);
  }, [progress?.rewards, !!state.combat, defeated]);

  const commit = useCallback((next: ExpeditionState) => {
    if (network || next === current.current) return;
    const previous = current.current;
    current.current = next; setState(next);
    if (sessionEnded(next)) { if (!sessionEnded(previous)) onEnded(); }
    else if (needsCheckpoint(previous, next)) onCheckpoint(next);
  }, [network, onCheckpoint, onEnded]);

  useEffect(() => {
    if (!network) return;
    return network.subscribeState(next => { current.current = next; setState(next); });
  }, [network]);

  useEffect(() => {
    if (network || !canControl || state.completed || state.failed && !state.combat) return;
    let nextTick = performance.now() + MOVEMENT_TICK_MS;
    const timer = window.setInterval(() => {
      try {
        const now = performance.now();
        let count = Math.min(5, Math.max(0, Math.floor((now - nextTick) / MOVEMENT_TICK_MS) + 1));
        nextTick += count * MOVEMENT_TICK_MS;
        while (count-- > 0) {
          const previous = current.current;
          if (previous.cooperative) {
            const cooperative = stepCoop(previous.cooperative, gameContent).state;
            if (cooperative !== previous.cooperative) commit({ ...coopView(cooperative, controlledActorId, gameContent), cooperative });
          } else if (!paused && !previous.combat) {
            commit(upgradeSoloAdventure(stepExpedition(enableRoaming(previous, gameContent), gameContent, MOVEMENT_TICK_MS), gameContent));
          }
        }
      } catch (error) { console.error('World step failed', error); setNotice('Не удалось продолжить симуляцию. Сохранение доступно в главном меню.'); }
    }, MOVEMENT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [commit, network, canControl, paused, state.completed, state.failed, !!state.combat, controlledActorId]);

  // Finish a battle loaded from the previous solo format before its one-time migration.
  useEffect(() => {
    if (network || state.cooperative || !state.combat || paused) return;
    if (isFinished(state.combat)) {
      const timer = window.setTimeout(() => commit(upgradeSoloAdventure(leaveEncounter(current.current), gameContent)), 900);
      return () => window.clearTimeout(timer);
    }
    if (state.combat.pendingActorId || presentedCombat?.nextSequence !== state.combat.nextSequence) return;
    const timer = window.setTimeout(() => commit(stepExpeditionCombat(current.current, gameContent)), MOVEMENT_TICK_MS);
    return () => window.clearTimeout(timer);
  }, [network, state.cooperative, state.combat, paused, presentedCombat, commit]);

  const send = useCallback((command: CoopCommand): boolean => {
    if (!canControl) return false;
    if (network) return network.sendCommand(command);
    const cooperative = current.current.cooperative;
    if (!cooperative) return false;
    try {
      const result = commandCoop(cooperative, controlledActorId, command, gameContent);
      if (result.accepted === false) { setNotice(result.reason ?? 'Сейчас это недоступно.'); return false; }
      commit({ ...coopView(result.state, controlledActorId, gameContent), cooperative: result.state });
      setNotice(''); return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Действие недоступно.'); return false; }
  }, [network, canControl, controlledActorId, commit]);

  const cancelBossSummon = useCallback(() => { pendingSummon.current = null; setBossSummon(null); }, []);
  const offerInteraction = useCallback((chunkId: string, poiId: string) => {
    const previous = current.current;
    if (previous.world.currentChunkId !== chunkId) return;
    const poi = previous.world.chunk.pois.find(candidate => candidate.id === poiId);
    if (poi?.kind !== 'altar') { send({ type: 'interact', chunkId, poiId }); return; }
    const plan = planPoiApproach(previous, controlledActorId, poiId);
    if (plan.type !== 'interact' || !poi.bossSeason) {
      if (plan.type === 'unavailable') setNotice(plan.reason);
      return;
    }
    const actor = previous.world.actors.find(candidate => candidate.id === controlledActorId)!;
    // Stop an existing route while the player decides whether to summon.
    if (actor.path.length && !send({ type: 'move', chunkId, from: actor.position, x: actor.position.x, y: actor.position.y })) return;
    const request = { poiId, chunkId, transitions: previous.world.transitions, season: poi.bossSeason };
    pendingSummon.current = request;
    setRewardsOpen(false);
    setBossSummon(request);
  }, [controlledActorId, send]);

  useEffect(() => {
    const request = pendingSummon.current;
    if (!request) return;
    const bosses = state.bosses ?? state.cooperative?.bosses;
    const nextSeason = bosses && SEASON_BOSS_ORDER.find(season => !bosses.spawned.some(spawn => spawn.season === season));
    if (!canControl || state.combat || defeated || state.failed || state.completed
      || state.world.currentChunkId !== request.chunkId || state.world.transitions !== request.transitions
      || nextSeason !== request.season || !state.world.chunk.pois.some(poi => poi.id === request.poiId && poi.bossSeason === request.season)) cancelBossSummon();
  }, [state, canControl, defeated, cancelBossSummon]);

  const confirmBossSummon = useCallback(() => {
    const request = pendingSummon.current;
    // Clear synchronously: double clicks cannot send a second summon command.
    cancelBossSummon();
    const previous = current.current;
    if (!request || !canControl || previous.combat || previous.failed || previous.completed
      || previous.world.currentChunkId !== request.chunkId || previous.world.transitions !== request.transitions) return;
    const actor = previous.world.actors.find(candidate => candidate.id === controlledActorId);
    const poi = previous.world.chunk.pois.find(candidate => candidate.id === request.poiId);
    if (!actor || actor.body && !isBodyAlive(actor.body) || poi?.bossSeason !== request.season) return;
    const plan = planPoiApproach(previous, controlledActorId, request.poiId);
    if (plan.type !== 'interact') {
      setNotice(plan.type === 'unavailable' ? plan.reason : 'Подойдите к алтарю, чтобы призвать босса.');
      return;
    }
    send({ type: 'interact', chunkId: request.chunkId, poiId: request.poiId });
  }, [canControl, controlledActorId, cancelBossSummon, send]);

  const combatPresented = useCallback((combat: CombatState) => { if (!network) setPresentedCombat(combat); }, [network]);
  const chooseCombatAction = useCallback((choice: CombatChoice) => {
    const cooperative = network?.getCoopState() ?? current.current.cooperative;
    const battle = cooperative?.battles.find(item => item.combat === current.current.combat);
    if (battle) return send({ type: 'battle', battleId: battle.id, action: 'choose', choice });
    if (network || !current.current.combat) return false;
    try { commit(chooseExpeditionCombatAction(current.current, gameContent, choice)); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Действие недоступно.'); return false; }
  }, [network, send, commit]);

  const move = useCallback((point: GridPoint) => {
    pendingInteraction.current = null;
    cancelBossSummon();
    const previous = current.current;
    const actor = previous.world.actors.find(hero => hero.id === controlledActorId);
    if (!actor || previous.combat || defeated) return;
    const fire = previous.world.chunk.pois.find(poi => poi.kind === 'campfire' && poi.position.x === point.x && poi.position.y === point.y);
    const movement = fire ? approachCampfire(previous, controlledActorId, fire.id) : moveExpedition(previous, controlledActorId, point);
    if (!movement.accepted) return;
    const target = fire ? movement.state.world.actors.find(hero => hero.id === controlledActorId)?.path.at(-1) ?? actor.position : point;
    if (network || previous.cooperative) send({ type: 'move', chunkId: previous.world.currentChunkId, from: actor.position,
      fromElapsedMs: movement.state.world.actors.find(hero => hero.id === controlledActorId)?.movement?.elapsedMs ?? 0, x: target.x, y: target.y });
    else commit(movement.state);
  }, [controlledActorId, defeated, network, send, commit, cancelBossSummon]);

  const interact = useCallback((poiId: string) => {
    const previous = current.current;
    if (!canControl || previous.combat || previous.completed || previous.failed || defeated) return;
    const pending = pendingInteraction.current;
    // Repeated clicks keep the original route and its one-shot arrival action.
    // In particular, a guest must not bypass its pending host-arrival check.
    if (pending?.poiId === poiId && poiApproachReadiness(pending, previous, controlledActorId,
      network && !network.isHost ? network.getConfirmedCoopState() : undefined) === 'wait') return;
    pendingInteraction.current = null;
    cancelBossSummon();
    const plan = planPoiApproach(previous, controlledActorId, poiId);
    if (plan.type === 'unavailable') { setNotice(plan.reason); return; }
    setNotice('');
    if (plan.type === 'interact') {
      const readiness = poiApproachReadiness(plan.approach, previous, controlledActorId,
        network && !network.isHost ? network.getConfirmedCoopState() : undefined);
      if (readiness === 'wait') pendingInteraction.current = plan.approach;
      else if (readiness === 'ready') offerInteraction(previous.world.currentChunkId, poiId);
      return;
    }
    const actor = previous.world.actors.find(hero => hero.id === controlledActorId)!;
    pendingInteraction.current = plan.approach;
    if (!send({ type: 'move', chunkId: plan.approach.chunkId, from: actor.position,
      x: plan.approach.position.x, y: plan.approach.position.y })) pendingInteraction.current = null;
  }, [canControl, controlledActorId, defeated, send, offerInteraction, cancelBossSummon, network]);

  useEffect(() => {
    const pending = pendingInteraction.current;
    if (!pending) return;
    if (!canControl) { pendingInteraction.current = null; return; }
    const readiness = poiApproachReadiness(pending, state, controlledActorId,
      network && !network.isHost ? network.getConfirmedCoopState() : undefined);
    if (readiness === 'wait') return;
    // Clear first: sending publishes the next state synchronously. Arrival is one-shot.
    pendingInteraction.current = null;
    if (readiness === 'ready') offerInteraction(pending.chunkId, pending.poiId);
  }, [state, canControl, controlledActorId, network, offerInteraction]);

  const resolveRewards = useCallback((resolution: RewardResolution) => send({ type: 'resolve-rewards', ...resolution }), [send]);
  const collectReward = useCallback((rewardId: string) => send({ type: 'collect-reward', rewardId }), [send]);
  const equipInventory = useCallback((inventoryId: string, slot: InventoryTarget) => send({ type: 'equip-inventory', inventoryId, slot }), [send]);
  const continueExploration = useCallback(() => {
    const cooperative = network?.getCoopState() ?? current.current.cooperative;
    const battle = cooperative?.battles.find(item => item.combat === current.current.combat);
    if (battle) send({ type: 'battle', battleId: battle.id, action: 'continue' });
    else if (!network) commit(upgradeSoloAdventure(leaveEncounter(current.current), gameContent));
  }, [network, send, commit]);

  const partyKey = state.world.actors.map(actor => actor.id).join(',');
  const healthKey = JSON.stringify(partyBodies(state.world.actors));
  const preview = useMemo(() => createCombat({ seed: state.world.graph.seed, characterIds: partyKey.split(','), heroBodies: partyBodies(state.world.actors),
    encounterId: content.encounters[0].id, difficultyId: state.difficultyId }, content), [state.world.graph.seed, partyKey, healthKey, state.difficultyId, content]);
  const controlledHeroes = network?.controllableHeroIds ?? state.world.actors.map(actor => actor.id);
  const controllableActorIds = state.combat?.units.filter(unit => unit.team === 'heroes' && controlledHeroes.includes(unit.definitionId)).map(unit => unit.id) ?? [];
  return {
    world: state.world, content, controlledActorId, move, interact, combat: state.combat,
    groups: state.roaming?.chunks[state.world.currentChunkId], partyState: state.combat ?? preview,
    chooseCombatAction, combatPresented, controllableActorIds, continueExploration, canControl,
    current, difficultyId: state.difficultyId ?? 'normal', notice, setNotice, clearedPoiIds: state.clearedPoiIds,
    reducedMotion, setReducedMotion, setPaused, defeated, failed: !!state.failed, completed: !!state.completed,
    bosses: state.bosses ?? state.cooperative?.bosses, bossSummon, cancelBossSummon, confirmBossSummon,
    campfires: state.progression?.campfires, progress, rewardsOpen, setRewardsOpen, resolveRewards, collectReward, equipInventory,
    networkInfo: connection?.room ? { code: connection.room.code, isHost: network!.isHost } : undefined,
  };
}
