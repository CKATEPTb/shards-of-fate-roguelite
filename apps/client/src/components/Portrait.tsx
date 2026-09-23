import type { UnitDefinition } from "@shards/shared";
import { spritePixels } from "../art/sprites";
import { unitFrameMetrics } from "../art/unitFrames";
import { resolveHeroVisualLoadout, type HeroRenderState } from "../art/heroLoadout";

export function Portrait({
  unit,
  enemy = false,
  body,
  equipment,
}: {
  unit: UnitDefinition;
  enemy?: boolean;
} & HeroRenderState) {
  const { size, footY } = unitFrameMetrics(enemy);
  const scale = size / 32;
  const loadout = enemy ? undefined : resolveHeroVisualLoadout(unit, equipment);
  return (
    <svg
      viewBox={enemy ? `0 0 ${size} ${footY - 2 * scale}` : `0 ${-size / 8} ${size} ${size}`}
      className="portrait"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <ellipse cx={size / 2} cy={footY - 6 * scale} rx={9 * scale} ry={2 * scale} fill="#050d0b" opacity=".5" />
      {spritePixels(unit.sprite || unit.id, unit.role, enemy, body, loadout).map((pixel) => (
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
