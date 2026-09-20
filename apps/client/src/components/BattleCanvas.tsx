import { useEffect, useRef } from "react";
import type { CombatState } from "@shards/shared";
import type { BattleScene } from "../game/BattleScene";
import { mountBattle } from "../game/mountBattle";

export function BattleCanvas({
  state,
  selected,
  reducedMotion,
}: {
  state: CombatState;
  selected: string;
  reducedMotion: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BattleScene | null>(null);
  const presentation = useRef({ state, selected, reducedMotion });
  presentation.current = { state, selected, reducedMotion };
  useEffect(() => {
    if (!host.current) return;
    const dispose = mountBattle(
      host.current,
      (battle) => {
        scene.current = battle;
        const latest = presentation.current;
        battle.showCombat(latest.state, latest.selected, latest.reducedMotion);
      },
    );
    return () => {
      scene.current = null;
      dispose();
    };
  }, []);
  useEffect(() => {
    scene.current?.showCombat(state, selected, reducedMotion);
  }, [state, selected, reducedMotion]);
  return (
    <div
      className="battle-canvas"
      ref={host}
      role="img"
      aria-label={`Поле боя. Раунд ${state.round}. Союзников в строю: ${state.units.filter((unit) => unit.team === "heroes" && unit.hp > 0).length}; противников: ${state.units.filter((unit) => unit.team === "enemies" && unit.hp > 0).length}.`}
    />
  );
}
