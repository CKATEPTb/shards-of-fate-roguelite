import { useEffect, useRef, type CSSProperties } from 'react';
import type { CombatEvent, CombatState, Combatant, GameContent } from '@shards/shared';
import { gameContent } from '../catalog';
import { COMBAT_DIE_MS, COMBAT_DICE_BONUS_MS } from '@shards/shared';
import { isBodyAlive } from '@shards/game-core';
import type { InitiativePresentation } from '../game/initiativePresentation';
import { BattleQueuePortrait } from './BattleQueuePortrait';
import './battleTurnQueue.css';

const living = (unit: Combatant) => !unit.escaped && (unit.body ? isBodyAlive(unit.body) : unit.hp > 0);

function InitiativeDie({ event, clock, reduced }: { event: CombatEvent; clock: InitiativePresentation; reduced: boolean }) {
  const settled = clock.finished || clock.elapsed >= COMBAT_DIE_MS * .73;
  const modifier = event.modifier ?? 0;
  const bonusProgress = Math.max(0, Math.min(1, (clock.elapsed - COMBAT_DIE_MS) / (COMBAT_DICE_BONUS_MS * .62)));
  const merged = clock.finished || modifier !== 0 && bonusProgress === 1;
  const rolled = (event.rolls ?? []).reduce((sum, value) => sum + value, 0);
  const result = event.amount ?? rolled + modifier;
  // This deterministic decorative cycle is unrelated to the room dice stream.
  const value = settled ? merged ? result : rolled : reduced ? '·' : (event.sequence * 7 + Math.floor(clock.elapsed / 46) * 7) % 20 + 1;
  const momentum = settled || reduced ? 0 : 1 - Math.min(1, clock.elapsed / (COMBAT_DIE_MS * .73));
  const rotate = Math.sin(clock.elapsed / 45 + event.sequence) * momentum * 17;
  const bounce = Math.abs(Math.sin(clock.elapsed / 64 + event.sequence)) * momentum * 4;
  const signed = `${modifier > 0 ? '+' : '−'}${Math.abs(modifier)}`;
  return <div className="battle-initiative-roll" data-tie={clock.tie} data-settled={settled}
    aria-label={settled ? `${clock.tie ? 'Повторный бросок' : 'Инициатива'}: ${rolled}${modifier ? ` ${signed}${merged ? ` = ${result}` : ''}` : ''}` : 'Бросок 1d20'}>
    <svg viewBox="0 0 44 44" aria-hidden="true" style={{ transform: `translateY(${-bounce}px) rotate(${rotate}deg)` }}>
      <path d="M22 2 39 12 39 32 22 42 5 32 5 12Z" fill="#c8ad73" stroke="#ffe7a4" strokeWidth="1" />
      <path d="M22 2 11 16 5 12ZM39 12 33 16 22 2Z" fill="#f1d697" />
      <path d="M5 12 11 16 22 36 5 32ZM39 12 33 16 22 36 39 32Z" fill="#6f674d" />
      <path d="M11 16 33 16 22 36Z" fill="#8d7954" stroke="#e8cc8b" strokeWidth=".7" />
      <path d="M5 32 22 36 39 32 22 42Z" fill="#4d4a3c" />
      <text x="22" y="25.5" textAnchor="middle" dominantBaseline="middle">{value}</text>
    </svg>
    {modifier !== 0 && <span className="battle-initiative-bonus" aria-hidden="true" style={{ opacity: merged ? 0 : reduced ? 1 : 1 - bonusProgress, transform: reduced ? undefined : `translateY(${-bonusProgress * 20}px)` }}>{signed}</span>}
    <small aria-hidden="true">{clock.tie ? 'повтор' : '1d20'}</small>
  </div>;
}

export function BattleTurnQueue({ state, roster, initiative, reducedMotion, content = gameContent }: {
  state?: CombatState; roster: Combatant[]; initiative?: InitiativePresentation; reducedMotion: boolean; content?: GameContent;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const units = (state?.units ?? roster).filter(living);
  const byId = new Map(units.map(unit => [unit.id, unit]));
  const sourceOrder = state?.turnOrder ?? [];
  const cursor = state?.pendingActorId ? Math.max(0, sourceOrder.indexOf(state.pendingActorId)) : Math.min(sourceOrder.length, state?.turnIndex ?? 0);
  const rotated = [...sourceOrder.slice(cursor), ...sourceOrder.slice(0, cursor)];
  const order = [...new Set([...rotated, ...units.map(unit => unit.id)])].filter(id => byId.has(id));
  const ordered = order.map(id => byId.get(id)!);
  const orderKey = order.join('|');
  useEffect(() => { scroll.current?.scrollTo({ left: 0, behavior: reducedMotion ? 'instant' : 'smooth' }); }, [orderKey, reducedMotion]);
  const currentId = sourceOrder.length && !initiative ? rotated.find(id => byId.has(id)) : undefined;
  const finished = state && ['victory', 'defeat', 'draw', 'escaped'].includes(state.status);
  const caption = initiative ? initiative.tie ? 'Равная инициатива · повторный 1d20' : 'Определяем инициативу · 1d20 + бонус'
    : !state || !sourceOrder.length ? 'Определяем порядок ходов' : finished ? 'Бой завершён'
      : currentId ? `Ходит: ${byId.get(currentId)?.name}` : 'Порядок ходов';
  const nextId = currentId ? ordered[1]?.id : undefined;
  return <section className="battle-turn-queue" data-reduced={reducedMotion} data-rolling={Boolean(initiative)} aria-label="Очередь участников боя">
    <div className="battle-queue-heading"><span>{caption}</span><small>{state?.round ? `Раунд ${state.round}` : 'Инициатива'}</small></div>
    <div className="battle-queue-scroll" ref={scroll} tabIndex={ordered.length > 5 ? 0 : undefined} aria-label="Портреты по порядку хода; прокрутите для остальных участников">
      <ol className="battle-queue-track" style={{ '--queue-count': ordered.length } as CSSProperties}>
        {ordered.map((unit, index) => {
          const roll = initiative?.events.find(event => event.actorId === unit.id);
          const total = state?.initiative?.[unit.id];
          const active = !finished && currentId === unit.id;
          const next = !finished && nextId === unit.id;
          const label = active ? 'Ходит' : next ? 'Далее' : total === undefined ? 'Ждёт' : String(index + 1);
          return <li key={unit.id} className="battle-queue-entry" data-team={unit.team} data-current={active} data-next={next} data-rolling={Boolean(roll)}
            style={{ '--queue-position': index } as CSSProperties} title={`${unit.name} · ${unit.team === 'heroes' ? 'Союзник' : 'Противник'}${total === undefined ? '' : ` · Инициатива ${total}`}`}>
            <span className="battle-queue-position">{roll ? initiative?.tie ? 'Спор' : 'Бросок' : label}</span>
            <div className="battle-queue-art"><BattleQueuePortrait unit={unit} content={content} />
              {roll && initiative ? <InitiativeDie event={roll} clock={initiative} reduced={reducedMotion} />
                : total !== undefined && <span className="battle-queue-total" aria-label={`Инициатива ${total}`}>{total}</span>}
            </div>
            <span className="battle-queue-name">{unit.name}</span>
          </li>;
        })}
      </ol>
    </div>
  </section>;
}
