import type { UnitDefinition } from "@shards/shared";
import { spritePixels } from "../art/sprites";

export function Portrait({
  unit,
  enemy = false,
}: {
  unit: UnitDefinition;
  enemy?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 26"
      className="portrait"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <ellipse cx="16" cy="22" rx="9" ry="2" fill="#050d0b" opacity=".5" />
      {spritePixels(unit.sprite || unit.id, unit.role, enemy).map((pixel) => (
        <rect
          key={`${pixel.x}:${pixel.y}`}
          x={pixel.x}
          y={pixel.y}
          width="1"
          height="1"
          fill={pixel.color}
        />
      ))}
    </svg>
  );
}
