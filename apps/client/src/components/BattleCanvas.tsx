import { useCallback, useEffect, useRef, useState } from "react";
import type { CombatState, GameContent } from "@shards/shared";
import { gameContent } from '../catalog';
import { isBodyAlive } from '@shards/game-core';
import type { BattleScene } from "../game/BattleScene";
import { mountBattle } from "../game/mountBattle";
import { battleRosterLayout, battleUnitGeometry, readBattleInsets, type BattleStage } from '../game/battleLayout';
import type { BattleEnvironment } from '../game/battleEnvironment';
import { AuraDescription, StatusBadges, unitAuras } from './StatusBadges';
import { BattleTurnQueue } from './BattleTurnQueue';
import type { InitiativePresentation } from '../game/initiativePresentation';
import '../game/battleTargets.css';

export function BattleCanvas({
  state,
  selected,
  reducedMotion,
  speed = 1,
  onPresented,
  visibleState = state,
  targetIds = [],
  selectedTarget,
  onTarget,
  onTargetHover,
  highlightedTargetIds = [],
  targeting = false,
  environment,
  content = gameContent,
}: {
  state: CombatState;
  selected: string;
  reducedMotion: boolean;
  speed?: number;
  onPresented?: (state: CombatState) => void;
  visibleState?: CombatState;
  targetIds?: string[];
  selectedTarget?: string;
  onTarget?: (unitId: string) => void;
  onTargetHover?: (unitId: string | undefined) => void;
  highlightedTargetIds?: string[];
  targeting?: boolean;
  environment?: BattleEnvironment;
  content?: GameContent;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BattleScene | null>(null);
  const [size, setSize] = useState<BattleStage>({ width: 1000, height: 620 });
  const [aura, setAura] = useState<{ unitId: string; auraId: string }>();
  const [queueState, setQueueState] = useState<CombatState>();
  const [initiative, setInitiative] = useState<InitiativePresentation>();
  const presentation = useRef({ state, selected, reducedMotion, speed, onPresented, environment, content });
  presentation.current = { state, selected, reducedMotion, speed, onPresented, environment, content };
  const present = useCallback((next: CombatState) => {
    setQueueState(next);
    presentation.current.onPresented?.(next);
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        const next = { width: Math.round(rect.width), height: Math.round(rect.height), ...readBattleInsets(host.current) };
        setSize(next);
        scene.current?.scale?.resize(next.width, next.height);
      }
    });
    observer.observe(host.current);
    const dispose = mountBattle(
      host.current,
      (battle) => {
        scene.current = battle;
        const latest = presentation.current;
        battle.showContent(latest.content);
        battle.showEnvironment(latest.environment);
        battle.showCombat(latest.state, latest.selected, latest.reducedMotion, latest.speed, present, setInitiative);
      },
    );
    return () => {
      scene.current = null;
      observer.disconnect();
      dispose();
    };
  }, []);
  useEffect(() => {
    scene.current?.showContent(content);
    scene.current?.showEnvironment(environment);
    scene.current?.showCombat(state, selected, reducedMotion, speed, present, setInitiative);
  }, [state, selected, reducedMotion, speed, present, environment, content]);
  useEffect(() => { if (targeting) setAura(undefined); }, [targeting]);
  const units = (['heroes', 'enemies'] as const).flatMap(team => {
    const members = visibleState.units.filter(unit => unit.team === team);
    const placements = battleRosterLayout(members, size, content);
    return members.map((unit, index) => ({ unit, position: placements[index] }));
  });
  const auraUnit = visibleState.units.find(unit => unit.id === aura?.unitId);
  const auraDetails = auraUnit && unitAuras(auraUnit, visibleState.units, content).find(item => item.id === aura?.auraId);
  const queue = queueState?.seed === state.seed && queueState.encounterId === state.encounterId
    && queueState.nextSequence <= state.nextSequence ? queueState : undefined;
  return (
    <div
      className="battle-canvas"
      data-targeting={targeting}
      role="group"
      aria-label={`Поле боя. Раунд ${queue?.round ?? 0}.`}
    >
      <BattleTurnQueue state={queue} roster={state.units} content={content} initiative={queue ? initiative : undefined} reducedMotion={reducedMotion} />
      <div className="battle-renderer" ref={host} aria-hidden="true" />
      <div className="battle-unit-controls">
        {units.filter(({ unit }) => !unit.escaped && (unit.body ? isBodyAlive(unit.body) : unit.hp > 0)).map(({ unit, position }) => {
          const valid = targetIds.includes(unit.id);
          const growth = unit.statuses.some(status => status.id === 'taunted') ? 1.32 : 1;
          const highlighted = highlightedTargetIds.includes(unit.id) || selectedTarget === unit.id;
          return <div className="battle-unit-anchor" key={unit.id} data-team={unit.team} data-highlighted={highlighted}
            data-valid={valid} style={{ left: position.x, top: position.y }}>
            <button className="battle-target-hit" data-battle-target={unit.id} aria-pressed={highlighted}
              aria-disabled={!valid} tabIndex={valid ? 0 : -1}
              aria-label={`Применить карту: ${unit.name}`} onClick={() => { if (valid) onTarget?.(unit.id); }}
              onPointerEnter={() => { if (valid) onTargetHover?.(unit.id); }} onPointerLeave={() => onTargetHover?.(undefined)}
              onFocus={() => { if (valid) onTargetHover?.(unit.id); }} onBlur={() => onTargetHover?.(undefined)}
              style={{ width: Math.max(42, 29 * position.scale * growth), height: Math.max(48, 29 * position.scale * growth) }}>
              <span className="battle-target-crown" aria-hidden="true">⌄</span>
              <span className="battle-target-ring" aria-hidden="true" />
            </button>
            <div className="battle-unit-auras" inert={targeting} style={{ top: battleUnitGeometry(position, unit.team === 'enemies').auraY, maxWidth: position.labelWidth }}>
              <StatusBadges unit={unit} roster={visibleState.units} content={content} onInspect={details => setAura({ unitId: unit.id, auraId: details.id })} />
            </div>
          </div>;
        })}
      </div>
      {auraDetails && auraUnit && <AuraDescription aura={auraDetails} unitName={auraUnit.name} onClose={() => setAura(undefined)} />}
    </div>
  );
}
