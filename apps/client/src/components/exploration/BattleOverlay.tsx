import { lazy, Suspense } from "react";
import type { CombatState } from "@shards/shared";
import { gameContent, isFinished } from "../../catalog";
import { Icon } from "../Icon";
import { isBodyAlive } from '@shards/game-core';

const BattleCanvas = lazy(() => import("../BattleCanvas").then((module) => ({ default: module.BattleCanvas })));

export function BattleOverlay({ state, selected, playing, speed, reducedMotion, onPlay, onStep, onSpeed, onContinue }: { state: CombatState; selected: string; playing: boolean; speed: number; reducedMotion: boolean; onPlay: () => void; onStep: () => void; onSpeed: (value: number) => void; onContinue: () => void }) {
  const encounter = gameContent.encounters.find((item) => item.id === state.encounterId);
  const done = isFinished(state);
  const controlled = state.units.find(unit => unit.team === 'heroes' && (unit.id === selected || unit.definitionId === selected));
  const runEnds = state.status !== 'victory' || Boolean(controlled?.body && !isBodyAlive(controlled.body));
  return <section className="combat-phase" aria-label="Боевая встреча">
    <div className="combat-scene"><Suspense fallback={<div className="scene-loading">Встреча на тропе…</div>}><BattleCanvas state={state} selected={selected} reducedMotion={reducedMotion} /></Suspense></div>
    <header className="combat-heading glass-panel"><div><span className="eyebrow">Встреча на тропе</span><h2>{encounter?.name ?? 'Столкновение'}</h2></div><div className="combat-round"><span>Раунд</span><strong>{state.round}</strong></div></header>
    <div className="combat-enemies" aria-label="Противники" data-large={state.units.filter(unit => unit.team === 'enemies').length > 4}>{state.units.filter((unit) => unit.team === "enemies").map((unit) => <div key={unit.id} className={`enemy-status glass-panel ${unit.hp <= 0 ? "fallen" : ""}`}><span>{unit.name}</span><small>{unit.hp} / {unit.stats.maxHp}</small></div>)}</div>
    {!done && <div className="combat-actions glass-panel"><button className="primary-button" onClick={onPlay}><Icon name={playing ? "pause" : "play"} />{playing ? "Пауза" : state.status === "ready" ? "Начать бой" : "Продолжить"}</button><button className="icon-button" onClick={onStep} disabled={playing} aria-label="Выполнить один ход"><Icon name="step" /></button><div className="speed-group" role="group" aria-label="Скорость автобоя">{[1, 2, 4].map((value) => <button key={value} onClick={() => onSpeed(value)} aria-pressed={speed === value}>{value}×</button>)}</div></div>}
    {done && <div className={`battle-result result-${state.status}`} role="status"><span className="result-rune" aria-hidden="true">✦</span><span className="eyebrow">{runEnds ? 'Поход завершён' : 'Тропа свободна'}</span><h2>{state.status === "victory" ? "Победа" : state.status === "defeat" ? "Отряд пал" : "Ничья"}</h2><p>{state.round} раундов <span>·</span> {state.turn} ходов</p><button className="primary-button" onClick={onContinue}>{runEnds ? 'Завершить поход' : 'Продолжить путь'}<span aria-hidden="true">→</span></button></div>}
  </section>;
}
