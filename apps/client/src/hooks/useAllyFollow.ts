import { useCallback, useEffect, useRef, useState } from 'react';
import { bodyMovementMultiplier, getCoopBattle, isBodyAlive, planCoopFollow } from '@shards/game-core';
import type { CoopCommand, ExpeditionState, GridPoint } from '@shards/shared';
import type { NetworkSession } from '../network/session';

const REPLAN_TICKS = 6;
const RETRY_TICKS = 50;
const pointKey = (point?: GridPoint) => point ? `${point.x},${point.y}` : '-';
const samePoint = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y;

/** Local travel intent. Peers receive the resulting routes through ordinary movement events. */
export function useAllyFollow(state: ExpeditionState, actorId: string, canControl: boolean,
  send: (command: CoopCommand) => boolean, network?: NetworkSession) {
  const [followingActorId, setFollowingActorId] = useState<string | null>(null);
  const target = useRef<string | null>(null);
  const evaluated = useRef<{ key: string; tick: number } | null>(null);
  const attempted = useRef<{ key: string; tick: number } | null>(null);

  const follow = useCallback((targetActorId: string) => {
    if (target.current === targetActorId) return;
    target.current = targetActorId;
    evaluated.current = null;
    attempted.current = null;
    setFollowingActorId(targetActorId);
  }, []);

  const cancelFollow = useCallback(() => {
    // Manual movement wins even before React commits the next render.
    target.current = null;
    evaluated.current = null;
    attempted.current = null;
    setFollowingActorId(null);
  }, []);

  useEffect(() => {
    const targetId = target.current;
    if (!targetId) return;
    const cooperative = network?.getCoopState() ?? state.cooperative;
    const actor = cooperative?.actors.find(candidate => candidate.id === actorId);
    const leader = cooperative?.actors.find(candidate => candidate.id === targetId);
    // Combat, disconnection and wounds suspend travel without losing the selection.
    if (!canControl || !cooperative || !actor || !leader || actorId === targetId
      || cooperative.failed || cooperative.completed || getCoopBattle(cooperative, actorId)
      || state.combat?.units.some(unit => unit.definitionId === actorId)
      || actor.body && (!isBodyAlive(actor.body) || bodyMovementMultiplier(actor.body) <= 0)) {
      evaluated.current = null;
      return;
    }

    const destination = actor.path.at(-1);
    const leaderDestination = leader.path.at(-1);
    // Extend a short route just before arrival to keep walking smoothly.
    // Longer legs stay intact until the leader changes their destination.
    const nearRouteEnd = actor.path.length <= 2;
    const key = [cooperative.seed, actor.chunkId, actor.transitions, destination ? 'moving' : pointKey(actor.position),
      pointKey(destination), leader.id, leader.chunkId, leader.transitions, leaderDestination ? 'moving' : 'stopped',
      pointKey(leaderDestination ?? leader.position), getCoopBattle(cooperative, targetId)?.id ?? '-',
      nearRouteEnd ? pointKey(leader.position) : '-',
      actor.body ? bodyMovementMultiplier(actor.body) : 1].join(':');
    const previous = evaluated.current;
    if (previous && cooperative.tick >= previous.tick && cooperative.tick - previous.tick < REPLAN_TICKS) return;
    const retryAt = attempted.current ? attempted.current.tick + RETRY_TICKS : Infinity;
    // A rejected prediction can roll back to the original idle key before we
    // ever observed the moving route. Give that intent one delayed recheck.
    const retryDue = previous && previous.tick < retryAt && cooperative.tick >= retryAt;
    if (previous?.key === key && cooperative.tick >= previous.tick && !retryDue) return;
    evaluated.current = { key, tick: cooperative.tick };

    const plan = planCoopFollow(cooperative, actorId, targetId);
    if (plan.type === 'wait') return;
    if (plan.type === 'move' && (destination && samePoint(destination, plan.position)
      || !destination && samePoint(actor.position, plan.position))) return;

    if (plan.type === 'interact' && network && !network.isHost) {
      const confirmed = network.getConfirmedCoopState();
      const confirmedActor = confirmed?.actors.find(candidate => candidate.id === actorId);
      // Transport interactions have no movement origin. Wait for real arrival;
      // ordinary route changes above remain autonomous at any network latency.
      if (!confirmed || !confirmedActor || confirmed.failed || confirmed.completed
        || confirmedActor.chunkId !== plan.chunkId || confirmedActor.transitions !== actor.transitions
        || confirmedActor.path.length || !samePoint(confirmedActor.position, plan.position)
        || getCoopBattle(confirmed, actorId)
        || confirmedActor.body && !isBodyAlive(confirmedActor.body)) {
        evaluated.current = null;
        return;
      }
    }

    const commandKey = `${actor.transitions}:${plan.chunkId}:${pointKey(actor.position)}:${plan.type}:${plan.type === 'move' ? pointKey(plan.position) : plan.poiId}`;
    const last = attempted.current;
    if (last?.key === commandKey && cooperative.tick >= last.tick && cooperative.tick - last.tick < RETRY_TICKS) {
      evaluated.current = null;
      return;
    }
    // Publish guards first: issuing a command can synchronously update the view.
    attempted.current = { key: commandKey, tick: cooperative.tick };
    const accepted = plan.type === 'move'
      ? send({ type: 'move', chunkId: plan.chunkId, from: { ...actor.position }, fromElapsedMs: plan.fromElapsedMs,
        x: plan.position.x, y: plan.position.y })
      : send({ type: 'interact', chunkId: plan.chunkId, poiId: plan.poiId });
    // Re-evaluate a failed intent or a pending transport after the retry delay.
    if (!accepted || plan.type === 'interact') evaluated.current = null;
  }, [state, actorId, canControl, send, network, followingActorId]);

  return { followingActorId, follow, cancelFollow };
}
