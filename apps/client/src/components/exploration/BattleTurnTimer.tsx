import { useEffect, useState, type CSSProperties } from 'react';
import { COMBAT_CHOICE_TIMEOUT_MS, type CombatState } from '@shards/shared';
import { MOVEMENT_TICK_MS } from '@shards/game-core';
import './seasonBossTimer.css';

const finished = (state: CombatState) => ['victory', 'defeat', 'draw', 'escaped'].includes(state.status);

/** Only an already presented TURN_STARTED may identify the current participant. */
function visibleActorId(state: CombatState): string | undefined {
  if (state.pendingActorId) return state.pendingActorId;
  for (let index = state.events.length - 1; index >= 0; index--) {
    const event = state.events[index];
    if (event.type === 'TURN_ENDED' || event.type === 'ROUND_STARTED') return undefined;
    if (event.type === 'TURN_STARTED') return event.actorId;
  }
  return undefined;
}

/** Read-only countdown: the simulation, never the UI clock, decides when a turn expires. */
export function BattleTurnTimer({ state, presented, tick, choiceDeadlineTick, controllableActorIds,
  legacyDeadlineMs, reducedMotion = false }: {
  state: CombatState;
  presented?: CombatState;
  tick: number;
  choiceDeadlineTick?: number;
  controllableActorIds: readonly string[];
  legacyDeadlineMs?: number | null;
  reducedMotion?: boolean;
}) {
  const [legacyNow, setLegacyNow] = useState(() => performance.now());
  useEffect(() => {
    if (legacyDeadlineMs === undefined || legacyDeadlineMs === null) return;
    setLegacyNow(performance.now());
    const interval = window.setInterval(() => setLegacyNow(performance.now()), 250);
    return () => window.clearInterval(interval);
  }, [legacyDeadlineMs]);

  const visible = presented?.seed === state.seed && presented.encounterId === state.encounterId
    && presented.nextSequence <= state.nextSequence ? presented : undefined;
  const actorId = visible && visibleActorId(visible);
  const actor = visible?.units.find(unit => unit.id === actorId);
  const done = !!visible && finished(visible);
  const currentChoice = !done && !!visible?.pendingActorId && visible.pendingActorId === state.pendingActorId
    && visible.nextSequence === state.nextSequence && visible.turn === state.turn;
  const hasDeadline = choiceDeadlineTick !== undefined || legacyDeadlineMs !== undefined && legacyDeadlineMs !== null;
  const countingDown = currentChoice && actor?.team === 'heroes' && hasDeadline;
  const milliseconds = Math.max(0, Math.min(COMBAT_CHOICE_TIMEOUT_MS, choiceDeadlineTick !== undefined
    ? (choiceDeadlineTick - tick) * MOVEMENT_TICK_MS : legacyDeadlineMs !== undefined && legacyDeadlineMs !== null
      ? legacyDeadlineMs - legacyNow : COMBAT_CHOICE_TIMEOUT_MS));
  const seconds = Math.ceil(milliseconds / 1000);
  const urgent = countingDown && seconds <= 5;
  const ownTurn = !!actor && controllableActorIds.includes(actor.id);
  const preparing = !visible || visible.status === 'ready' || !visible.turnOrder.length;
  const label = done ? 'Бой завершён' : preparing ? 'Инициатива…'
    : actor?.team === 'enemies' ? 'Ход врага' : countingDown ? ownTurn ? 'Ваш ход' : 'Ход союзника'
      : currentChoice ? 'Подготовка хода…' : actor ? 'Действие…' : 'Подготовка хода…';
  const actorName = !done && !preparing ? actor?.name : undefined;
  const announcement = `${label}${actorName ? ` · ${actorName}` : ''}${countingDown ? `. Осталось ${seconds} сек.` : ''}`;

  return <section className="season-boss-timer battle-turn-timer" role={countingDown ? 'timer' : 'status'}
    aria-live={countingDown ? 'off' : 'polite'} aria-label={announcement}
    data-counting={countingDown} data-urgent={urgent} data-own-turn={ownTurn} data-reduced={reducedMotion}
    style={{ '--season-boss-remaining': countingDown ? milliseconds / COMBAT_CHOICE_TIMEOUT_MS : 0 } as CSSProperties}>
    <div className="battle-turn-countdown">
      <svg className="battle-turn-clock" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m12 2 8.7 5v10L12 22l-8.7-5V7Z" stroke="currentColor" strokeWidth=".8" opacity=".42" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M12 8v4l3 2M10 1h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="battle-turn-timer-label">{label}</span>
      {actorName && <span className="battle-turn-timer-actor">{actorName}</span>}
      {countingDown && <time>{seconds}<small>с</small></time>}
    </div>
    <div className="season-boss-track battle-turn-track" aria-hidden="true"><span /></div>
  </section>;
}
