import type { Combatant, GameContent, Team } from '@shards/shared';
import { findDefinition } from '../catalog';
import { enemyArtId, getEnemyAppearance } from '../art/enemyAppearance';

export interface BattlePlacement {
  x: number;
  y: number;
  scale: number;
  labelWidth: number;
  fontSize: number;
}

export interface BattleStage { width: number; height: number; insetTop?: number; insetBottom?: number }

export function battleUnitGeometry(placement: BattlePlacement, enemy = false) {
  if (!enemy) {
    const footprint = Math.max(.45, Math.min(1, placement.labelWidth / 80));
    return { footprint, barScale: footprint, labelY: 28, auraY: 43 };
  }
  const footprint = Math.max(.35, Math.min(placement.labelWidth / 80, placement.scale / 3.1));
  const barScale = Math.max(.45, Math.min(1.35, footprint));
  const labelY = Math.max(28, 20 * barScale + 6);
  return { footprint, barScale, labelY, auraY: labelY + 15 };
}

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

/** Bosses reserve their own body area; escorts keep the same underlying pixel scale. */
function scaledFormation(scales: readonly number[], bounds: FormationBounds, maximumScale: number, footer: number,
  front?: 'left' | 'right'): BattlePlacement[] {
  const weights = scales.map(scale => Number.isFinite(scale) ? Math.max(.5, Math.min(3, scale)) : 1);
  const bossIndex = weights.findIndex(scale => scale >= 2);
  if (front && bossIndex >= 0 && weights.filter(scale => scale >= 2).length === 1 && weights.length > 1) {
    const escortWidth = Math.max(76, Math.min(bounds.width * (weights.length > 6 ? .3 : .2), 150));
    const bossWidth = bounds.width - escortWidth - 12;
    const bossBounds = { ...bounds, left: front === 'left' ? bounds.left : bounds.left + escortWidth + 12, width: bossWidth };
    const bossScale = Math.max(.1, Math.min(maximumScale * weights[bossIndex], (bossWidth - 12) / 40, (bounds.height - footer) / 40));
    const boss: BattlePlacement = { x: bossBounds.left + bossWidth / 2,
      y: bounds.top + (bounds.height - footer + 40 * bossScale) / 2, scale: bossScale,
      labelWidth: Math.max(28, Math.min(170, bossWidth - 8)), fontSize: 12 };
    const escorts = scaledFormation(weights.filter((_, index) => index !== bossIndex), {
      ...bounds, left: front === 'left' ? bounds.left + bossWidth + 12 : bounds.left, width: escortWidth,
    }, Math.min(maximumScale, 2.3), footer);
    let escortIndex = 0;
    return weights.map((_, index) => index === bossIndex ? boss : escorts[escortIndex++]);
  }
  // The DOM's minimum 42px target must fit even beside a much larger boss.
  const maximumColumns = Math.min(weights.length, Math.max(1, Math.floor(bounds.width / 44)));
  let columns = maximumColumns, fittedScale = 0;
  for (let count = 1; count <= maximumColumns; count++) {
    const rows = Array.from({ length: Math.ceil(weights.length / count) }, (_, row) => weights.slice(row * count, (row + 1) * count));
    const rowWidths = rows.map(row => (bounds.width - row.length * 12) / (row.reduce((sum, value) => sum + value, 0) * 40));
    const height = rows.reduce((sum, row) => sum + Math.max(...row) * 40, 0);
    let candidate = Math.min(maximumScale, ...rowWidths, (bounds.height - rows.length * footer) / height);
    if (candidate > 0) {
      let low = 0, high = candidate;
      for (let step = 0; step < 16; step++) {
        const middle = (low + high) / 2;
        const fits = rows.every(row => row.reduce((sum, weight) => sum + Math.max(44, weight * middle * 40 + 12), 0) <= bounds.width);
        if (fits) low = middle; else high = middle;
      }
      candidate = low;
    }
    if (candidate > fittedScale) { columns = count; fittedScale = candidate; }
  }
  // Tiny viewports may not fit the full footer. Keep every body inside the reserved
  // field and compress the footer before permitting overlap with the queue or hand.
  const rowCount = Math.ceil(weights.length / columns);
  const bodyWeight = Array.from({ length: rowCount }, (_, row) => Math.max(...weights.slice(row * columns, (row + 1) * columns)) * 40)
    .reduce((sum, value) => sum + value, 0);
  const rowFooter = Math.min(footer, Math.max(0, (bounds.height - bodyWeight * .35) / rowCount));
  const widthLimit = Math.min(...Array.from({ length: rowCount }, (_, row) => {
    const values = weights.slice(row * columns, (row + 1) * columns);
    return (bounds.width - values.length * 12) / (values.reduce((sum, value) => sum + value, 0) * 40);
  }));
  const scale = Math.max(.05, Math.min(maximumScale, widthLimit,
    fittedScale || (bounds.height - rowCount * rowFooter) / bodyWeight));
  const occupiedHeight = bodyWeight * scale + rowCount * rowFooter;
  let y = bounds.top + Math.max(0, (bounds.height - occupiedHeight) / 2);
  const result: BattlePlacement[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const row = weights.slice(rowIndex * columns, (rowIndex + 1) * columns);
    const cellWidths = row.map(weight => Math.max(44, weight * scale * 40 + 12));
    const spareWidth = Math.max(0, bounds.width - cellWidths.reduce((sum, value) => sum + value, 0));
    const padding = front ? Math.min(20, spareWidth / row.length) : spareWidth / row.length;
    const occupiedWidth = cellWidths.reduce((sum, value) => sum + value + padding, 0);
    let x = bounds.left + (front === 'right' ? bounds.width - occupiedWidth : front === 'left' ? 0 : (bounds.width - occupiedWidth) / 2);
    y += Math.max(...row) * scale * 40;
    row.forEach((weight, index) => {
      const width = cellWidths[index] + padding;
      result.push({ x: x + width / 2, y, scale: scale * weight,
        labelWidth: Math.max(28, Math.min(170, width - 8)), fontSize: width < 76 ? 9 : width < 105 ? 10 : 12 });
      x += width;
    });
    y += rowFooter;
  }
  return result;
}

/** Fit the formation itself, leaving the landscape visible behind every UI layer. */
function formation(total: number, bounds: FormationBounds, maximumScale: number, footer: number, singleRow = false,
  front?: 'left' | 'right', visualScales?: readonly number[]): BattlePlacement[] {
  if (visualScales?.length === total) return scaledFormation(visualScales, bounds, maximumScale, footer, front);
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
  // Pack desktop ranks towards the opposing team instead of filling an entire flank.
  const spacing = front ? Math.min(bounds.width / columns, scale * 40 + 32) : bounds.width / columns;
  const center = bounds.left + (front === 'right' ? bounds.width - spacing * columns / 2
    : front === 'left' ? spacing * columns / 2 : bounds.width / 2);
  const bodyHeight = Math.max(48, scale * 40);
  const occupiedHeight = rows * (bodyHeight + footer);
  const start = bounds.top + Math.max(0, (bounds.height - occupiedHeight) / 2) + bodyHeight;
  const end = bounds.top + bounds.height - footer;
  const rowStride = rows <= 1 ? 0 : Math.min(bodyHeight + footer, Math.max(0, end - start) / (rows - 1));
  return Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / columns);
    const count = Math.min(columns, total - row * columns);
    return {
      x: center + (index % columns - (count - 1) / 2) * spacing,
      y: Math.min(end, start + row * rowStride), scale,
      labelWidth: Math.max(28, Math.min(150, spacing - 8)),
      fontSize: spacing < 76 ? 9 : spacing < 105 ? 10 : 12,
    };
  });
}

/** Ground anchors share the full-screen canvas; queue/cards only reserve formation space. */
export function battleLayout(team: Team, total: number, stage?: BattleStage, visualScales?: readonly number[]): BattlePlacement[] {
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
      return formation(total, bounds, team === 'heroes' ? 2.85 : 2.5, footer, team === 'heroes', undefined, visualScales);
    }
    const margin = Math.max(18, Math.min(64, width * .035));
    if (width >= 900 && !short) {
      // Frame both formations together on wide displays. Keep the canvas full-screen
      // and share these larger placements with DOM targets, auras and projectile anchors.
      const fieldWidth = Math.min(width - margin * 2, Math.max(880, Math.min(1200, fieldHeight * 2.2)));
      const left = (width - fieldWidth) / 2;
      const gap = Math.min(76, fieldWidth * .07);
      const flank = (fieldWidth - gap) / 2;
      const bounds = { left: team === 'heroes' ? left : left + flank + gap, top, width: flank, height: fieldHeight };
      return formation(total, bounds, team === 'heroes' ? 5 : 4.6, footer, false,
        team === 'heroes' ? 'right' : 'left', visualScales);
    }
    const bounds = team === 'heroes'
      ? { left: margin, top, width: width * .38 - margin, height: fieldHeight }
      : { left: width * .46, top, width: width * .54 - margin, height: fieldHeight };
    return formation(total, bounds, team === 'heroes' ? 3.1 : 2.8, footer, false, undefined, visualScales);
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

/** Phaser bodies and DOM targets must consume exactly the same model-aware placements. */
export function battleRosterLayout(units: readonly Combatant[], stage: BattleStage, content: GameContent): BattlePlacement[] {
  if (!units.length) return [];
  const team = units[0].team;
  const scales = team === 'enemies' ? units.map(unit => getEnemyAppearance(enemyArtId(findDefinition(unit.definitionId, content)))?.scale ?? 1) : undefined;
  return battleLayout(team, units.length, stage, scales);
}
