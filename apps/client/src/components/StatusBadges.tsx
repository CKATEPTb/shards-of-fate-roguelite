import type { Combatant } from "@shards/shared";
import { gameContent } from "../catalog";

export function StatusBadges({ unit }: { unit: Combatant }) {
  if (!unit.shield && !unit.statuses.length) return null;
  return (
    <div className="hero-statuses" aria-label={`Эффекты: ${unit.name}`}>
      {unit.shield > 0 && <span>Щит {unit.shield}</span>}
      {unit.statuses.map((status) => {
        const definition = gameContent.statuses.find(
          (item) => item.id === status.id,
        );
        return (
          <span
            key={`${status.id}:${status.sourceId}`}
            title={definition?.description}
          >
            {definition?.name ?? status.id} · {status.remaining} ход.
          </span>
        );
      })}
    </div>
  );
}
