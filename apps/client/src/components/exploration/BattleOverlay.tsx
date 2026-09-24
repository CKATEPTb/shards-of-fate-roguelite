import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CombatChoice, CombatState, GameContent } from '@shards/shared';
import { combatTargets, isBodyAlive, isRandomTargetSelector } from '@shards/game-core';
import { gameContent } from '../../catalog';
import type { BattleEnvironment } from '../../game/battleEnvironment';
import { BattleHand, type BattleCard } from './BattleHand';
import { cardsForActor } from './battleCards';
import { useBattleCardDrag } from './useBattleCardDrag';
import './manualCombat.css';
import './revival.css';

const BattleCanvas = lazy(() => import('../BattleCanvas').then(module => ({ default: module.BattleCanvas })));
const finished = (state: CombatState) => ['victory', 'defeat', 'draw', 'escaped'].includes(state.status);
const signature = (state: CombatState) => JSON.stringify([state.seed, state.encounterId]);
const rosterSignature = (state: CombatState) => state.units.map(unit => unit.id).join('|');

interface BattleOverlayProps {
  state: CombatState; selected: string; reducedMotion: boolean; environment?: BattleEnvironment;
  content?: GameContent;
  onAction: (choice: CombatChoice) => boolean | void; onContinue: () => void;
  onPresented?: (state: CombatState) => void;
  canControl?: boolean; multiplayer?: boolean; controllableActorIds?: string[];
  autoFinish?: boolean;
}

export function BattleOverlay({ state, selected, reducedMotion, environment, content = gameContent, onAction, onContinue, onPresented, canControl = true, multiplayer = false, controllableActorIds, autoFinish = false }: BattleOverlayProps) {
  const root = useRef<HTMLElement>(null);
  const [presented, setPresented] = useState(state);
  const [selectedCardId, setSelectedCardId] = useState<string>();
  const [hoveredTarget, setHoveredTarget] = useState<string>();
  const [lastActorId, setLastActorId] = useState<string>();
  const [submitted, setSubmitted] = useState<string>();
  const submission = useRef<string | undefined>(undefined);
  const [canvasReady, setCanvasReady] = useState(false);
  const present = useCallback((next: CombatState) => { setCanvasReady(true); setPresented(next); onPresented?.(next); }, [onPresented]);
  const sameCombat = signature(presented) === signature(state);
  const visible = sameCombat && presented.nextSequence <= state.nextSequence ? presented : state;
  const done = canvasReady && sameCombat && finished(visible);
  const resolving = !canvasReady || !sameCombat || rosterSignature(presented) !== rosterSignature(state)
    || visible.nextSequence < state.nextSequence || visible.status !== state.status || visible.pendingActorId !== state.pendingActorId;
  const turnKey = `${signature(state)}:${state.turn}:${state.nextSequence}:${state.pendingActorId ?? ''}`;
  const actor = state.units.find(unit => unit.id === state.pendingActorId);
  const permitted = controllableActorIds ?? (multiplayer ? [] : state.units.filter(unit => unit.team === 'heroes').map(unit => unit.id));
  const alive = (unit: CombatState['units'][number]) => unit.hp > 0 && !unit.escaped && (!unit.body || isBodyAlive(unit.body));
  const active = canvasReady && canControl && Boolean(actor && alive(actor) && permitted.includes(actor.id)) && !resolving && submitted !== turnKey && !finished(state);
  const handActor = actor && permitted.includes(actor.id) ? actor : state.units.find(unit => unit.id === lastActorId && permitted.includes(unit.id))
    ?? state.units.find(unit => permitted.includes(unit.id) && (unit.id === selected || unit.definitionId === selected))
    ?? state.units.find(unit => permitted.includes(unit.id));
  const cards = handActor ? cardsForActor(handActor, content) : [];
  const selectedCard = active ? cards.find(card => card.id === selectedCardId && card.available) : undefined;

  useEffect(() => {
    setSubmitted(undefined);
    submission.current = undefined;
    setSelectedCardId(undefined);
    setHoveredTarget(undefined);
  }, [turnKey]);
  useEffect(() => {
    if (actor && permitted.includes(actor.id)) setLastActorId(actor.id);
  }, [actor?.id, permitted.join('|')]);

  const targetsFor = (card: BattleCard) => card.choice.type === 'flee' ? [card.choice.actorId]
    : combatTargets(state, content, card.choice).map(target => target.id);
  const automaticTargetFor = (card: BattleCard): string | undefined => {
    const targets = targetsFor(card);
    const selector = content.skills.find(item => item.id === card.choice.skillId)?.target;
    const automatic = card.choice.type === 'flee' || selector === 'self' || selector === 'allAllies' || selector === 'allEnemies'
      || selector && isRandomTargetSelector(selector) || targets.length === 1;
    return automatic ? targets[0] : undefined;
  };
  const submit = (cardId: string, targetId: string) => {
    const card = cards.find(item => item.id === cardId);
    if (!active || submission.current === turnKey || !card?.available || !targetsFor(card).includes(targetId)) return;
    submission.current = turnKey;
    setSubmitted(turnKey);
    setSelectedCardId(undefined);
    const definition = content.skills.find(item => item.id === card.choice.skillId);
    const choice = card.choice.type === 'flee' || definition && isRandomTargetSelector(definition.target)
      ? card.choice : { ...card.choice, targetId };
    const accepted = onAction(choice);
    if (accepted === false) { submission.current = undefined; setSubmitted(undefined); }
  };
  const gesture = useBattleCardDrag({
    root, enabled: active, turnKey,
    allowedTargets: cardId => {
      const card = cards.find(item => item.id === cardId);
      return card?.available && active ? targetsFor(card) : [];
    },
    automaticTarget: cardId => {
      const card = cards.find(item => item.id === cardId);
      return card?.available && active ? automaticTargetFor(card) : undefined;
    },
    onPick: setSelectedCardId, onDrop: submit, onCancel: () => setSelectedCardId(undefined),
  });
  const targets = selectedCard ? targetsFor(selectedCard) : [];
  const skill = content.skills.find(item => item.id === selectedCard?.choice.skillId);
  const group = skill?.target === 'allAllies' || skill?.target === 'allEnemies';
  const automatic = selectedCard && automaticTargetFor(selectedCard) !== undefined;
  const random = skill && isRandomTargetSelector(skill.target);
  const hovered = gesture.drag ? gesture.drag.targetId : automatic ? undefined
    : hoveredTarget && targets.includes(hoveredTarget) ? hoveredTarget : undefined;
  const highlighted = gesture.drag?.cancelling ? [] : automatic ? random ? [] : targets : hovered ? [hovered] : [];
  const targetName = gesture.drag?.cancelling ? undefined : automatic && random ? 'Цель выберет кубик'
    : automatic && group && targets.length > 1 ? skill?.target === 'allAllies' ? 'Весь отряд' : 'Все противники'
    : visible.units.find(unit => unit.id === (gesture.drag?.targetId ?? (automatic ? targets[0] : undefined)))?.name;
  const selectedHero = visible.units.find(unit => unit.team === 'heroes' && (unit.id === selected || unit.definitionId === selected));
  const spectating = multiplayer && !!selectedHero && !selectedHero.escaped && !alive(selectedHero);
  const runEnds = !multiplayer && visible.status !== 'escaped' && (visible.status !== 'victory' || Boolean(selectedHero && (selectedHero.hp <= 0 || selectedHero.body && !isBodyAlive(selectedHero.body))));
  const currentId = visible.pendingActorId ?? visible.turnOrder[visible.turnIndex];
  const currentUnit = visible.units.find(unit => unit.id === currentId);
  const caption = resolving ? 'Броски и действия…' : actor ? active ? `Ваш ход · ${actor.name}` : `Ход ${actor.name}`
    : currentUnit ? `Ход ${currentUnit.name}` : 'Инициатива…';

  return <section ref={root} className="combat-phase manual-combat" data-targeting={Boolean(selectedCard)} aria-label="Пошаговый бой"
    onPointerDown={event => { if (selectedCard && !(event.target as Element).closest('.battle-card, [data-battle-target]')) gesture.cancel(); }}>
    <div className="combat-scene"><Suspense fallback={<div className="scene-loading">Встреча на тропе…</div>}>
      <BattleCanvas state={state} content={content} visibleState={visible} selected={currentId ?? selected} reducedMotion={reducedMotion} environment={environment} onPresented={present}
        targetIds={gesture.drag?.cancelling || random ? [] : targets} selectedTarget={gesture.drag?.cancelling || random ? undefined : hovered} highlightedTargetIds={highlighted} targeting={Boolean(selectedCard)} onTargetHover={setHoveredTarget}
        onTarget={targetId => { if (selectedCard) submit(selectedCard.id, targetId); }} />
    </Suspense></div>
    {!done && <div className="combat-sr-only" role="status">Раунд {visible.round || '—'} · {caption}</div>}
    <ol className="combat-sr-only" aria-label="События боя" aria-live="polite" aria-relevant="additions">{visible.events.map(event => <li key={event.sequence}>{event.message}</li>)}</ol>
    {spectating && !done && <div className="battle-spectator-notice" role="status"><span aria-hidden="true">◇</span><div><strong>Вы наблюдаете за боем</strong><p>После боя у союзников будет 3 минуты, чтобы вас поднять.</p></div></div>}
    {!done && !spectating && cards.length > 0 && <BattleHand cards={cards} selectedId={selectedCard?.id} active={active} gesture={gesture} targetName={targetName} reducedMotion={reducedMotion} automatic={Boolean(automatic)}
      onSelect={id => {
        const card = cards.find(item => item.id === id);
        const automaticTarget = card && automaticTargetFor(card);
        if (automaticTarget) { submit(id, automaticTarget); return; }
        if (selectedCard?.id === id) { setSelectedCardId(undefined); return; }
        setSelectedCardId(id);
        requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[data-battle-target][aria-disabled="false"]')?.focus({ preventScroll: true }));
      }} />}
    {done && !autoFinish && <div className={`battle-result result-${visible.status}`} role="status"><span className="result-rune" aria-hidden="true">✦</span><span className="eyebrow">{runEnds ? 'Поход завершён' : visible.status === 'escaped' ? 'Отступление' : visible.status === 'victory' ? 'Тропа свободна' : 'Бой завершён'}</span>
      <h2>{visible.status === 'victory' ? 'Победа' : visible.status === 'escaped' ? 'Вы сбежали' : visible.status === 'defeat' ? multiplayer ? 'Поражение' : 'Отряд пал' : 'Ничья'}</h2>
      <p>{visible.round} раундов <span>·</span> {visible.turn} ходов</p>{multiplayer && visible.status === 'escaped' ? <p>Возвращаемся к миру…</p> : canControl ? <button className="primary-button" onClick={onContinue}>{multiplayer ? 'Вернуться к миру' : runEnds ? 'Завершить поход' : 'Продолжить путь'}<span aria-hidden="true">→</span></button> : <p>Ожидаем решения участников боя.</p>}
    </div>}
  </section>;
}
