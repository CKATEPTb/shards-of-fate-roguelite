import { memo } from 'react';
import type { UnitDefinition } from "@shards/shared";
import { spritePixels } from "../art/sprites";
import { unitFrameMetrics } from "../art/unitFrames";
import { enemyArtId } from "../art/enemyAppearance";
import { resolveHeroVisualLoadout, type HeroRenderState } from "../art/heroLoadout";

// World clock/movement updates do not change the portrait's pixels.
export const Portrait = memo(function Portrait({
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
  const artId = enemy ? enemyArtId(unit) : unit.sprite || unit.id;
  return (
    <svg
      viewBox={`0 ${-size / 8} ${size} ${size}`}
      className="portrait"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <ellipse cx={size / 2} cy={footY - 6 * scale} rx={9 * scale} ry={2 * scale} fill="#050d0b" opacity=".5" />
      {spritePixels(artId, unit.role, enemy, body, loadout).map((pixel) => (
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
});
