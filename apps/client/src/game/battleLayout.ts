import type { Team } from '@shards/shared';

export interface BattlePlacement {
  x: number;
  y: number;
  scale: number;
  labelWidth: number;
  fontSize: number;
}

export interface BattleStage { width: number; height: number; insetTop?: number; insetBottom?: number }

/** Read once when a canvas is mounted/resized; CSS resolves platform safe-area values. */
export function readBattleInsets(element: Element | null | undefined): Pick<BattleStage, 'insetTop' | 'insetBottom'> {
  if (!element) return {};
  const style = getComputedStyle(element);
  return {
    insetTop: (Number.parseFloat(style.getPropertyValue('--battle-inset-top')) || 0)
      + (Number.parseFloat(style.getPropertyValue('--battle-season-offset')) || 0),
    insetBottom: Number.parseFloat(style.getPropertyValue('--battle-inset-bottom')) || 0,
  };
}

interface FormationBounds { left: number; top: number; width: number; height: number }

/** Fit the formation itself, leaving the landscape visible behind every UI layer. */
function formation(total: number, bounds: FormationBounds, maximumScale: number, footer: number, singleRow = false): BattlePlacement[] {
  let columns = total;
  let fittedScale = -Infinity;
  const firstColumn = singleRow ? total : 1;
  for (let count = firstColumn; count <= total; count += 1) {
    const rows = Math.ceil(total / count);
    // Forty logical pixels also accommodate the enlarged guardian and its target hitbox.
    const candidate = Math.min(maximumScale, (bounds.width / count - 12) / 40,
      (bounds.height / rows - footer) / 40);
    if (candidate > fittedScale) { columns = count; fittedScale = candidate; }
  }
  const rows = Math.ceil(total / columns);
  const scale = Math.max(.4, fittedScale);
  const spacing = bounds.width / columns;
  const bodyHeight = Math.max(48, scale * 40);
  const occupiedHeight = rows * (bodyHeight + footer);
  const start = bounds.top + Math.max(0, (bounds.height - occupiedHeight) / 2) + bodyHeight;
  const end = bounds.top + bounds.height - footer;
  const rowStride = rows <= 1 ? 0 : Math.min(bodyHeight + footer, Math.max(0, end - start) / (rows - 1));
  return Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / columns);
    const count = Math.min(columns, total - row * columns);
    return {
      x: bounds.left + bounds.width / 2 + (index % columns - (count - 1) / 2) * spacing,
      y: Math.min(end, start + row * rowStride), scale,
      labelWidth: Math.max(28, Math.min(150, spacing - 8)),
      fontSize: spacing < 76 ? 9 : spacing < 105 ? 10 : 12,
    };
  });
}

/** Ground anchors share the full-screen canvas; queue/cards only reserve formation space. */
export function battleLayout(team: Team, total: number, stage?: BattleStage): BattlePlacement[] {
  const maximum = team === 'heroes' ? 4 : 16;
  if (!Number.isInteger(total) || total < 1 || total > maximum) throw new Error(`Invalid ${team} battle roster size`);
  if (stage) {
    const width = Math.max(1, stage.width), height = Math.max(1, stage.height);
    // Keep these responsive sizes aligned with battleTurnQueue.css / manualCombat.css.
    // The hand reservation includes its hint and the selected card's 22 px lift.
    const short = height <= 540, narrow = width <= 600;
    const top = (short ? 96 : narrow ? 119 : 137) + Math.max(0, (stage.insetTop ?? 0) - (short ? 4 : narrow ? 5 : 8));
    const bottom = (short ? 180 : narrow ? 202 : 236) + Math.max(0, (stage.insetBottom ?? 0) - (short ? 3 : narrow ? 5 : 8));
    const fieldHeight = Math.max(1, height - top - bottom);
    const footer = narrow ? 63 : 70;
    if (width < 640 && height > width * 0.8) {
      // Heroes hold the near rank. Dense enemy groups gain columns before losing legibility.
      const heroHeight = Math.min(160, Math.max(111, fieldHeight * .31));
      const bounds = team === 'heroes'
        ? { left: 16, top: top + fieldHeight - heroHeight, width: width - 32, height: heroHeight }
        : { left: 16, top, width: width - 32, height: Math.max(1, fieldHeight - heroHeight - 12) };
      return formation(total, bounds, team === 'heroes' ? 2.85 : 2.5, footer, team === 'heroes');
    }
    const margin = Math.max(18, Math.min(64, width * .035));
    const bounds = team === 'heroes'
      ? { left: margin, top, width: width * .38 - margin, height: fieldHeight }
      : { left: width * .46, top, width: width * .54 - margin, height: fieldHeight };
    return formation(total, bounds, team === 'heroes' ? 3.1 : 2.8, footer);
  }
  if (total <= 3) return Array.from({ length: total }, (_, row) => ({
    x: (team === 'heroes' ? 335 : 679) + (row === 1 ? 40 : 0),
    y: 338 + (row - (total - 1) / 2) * 128,
    scale: 3.1, labelWidth: 160, fontSize: 13,
  }));
  if (team === 'heroes') return Array.from({ length: total }, (_, index) => ({
    x: 245 + Math.floor(index / 2) * 165,
    y: 265 + index % 2 * 150,
    scale: 3.1, labelWidth: 150, fontSize: 13,
  }));
  const rows = total <= 9 ? 3 : 4;
  const columns = Math.ceil(total / rows);
  const spacing = columns === 2 ? 174 : columns === 3 ? 145 : 106;
  const scale = columns === 2 ? 3 : columns === 3 ? 2.6 : 2.1;
  return Array.from({ length: total }, (_, index) => {
    const column = Math.floor(index / rows);
    const count = Math.min(rows, total - column * rows);
    return {
      x: 740 + (column - (columns - 1) / 2) * spacing,
      y: 345 + (index % rows - (count - 1) / 2) * (rows === 3 ? 128 : 112),
      scale, labelWidth: spacing - 12, fontSize: columns === 4 ? 11 : 12,
    };
  });
}
