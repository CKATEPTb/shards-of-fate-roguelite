import type { Team } from '@shards/shared';

export interface BattlePlacement {
  x: number;
  y: number;
  scale: number;
  labelWidth: number;
  fontSize: number;
}

/** Ground anchors within the 1000 × 620 battle canvas, with room for sprites and labels. */
export function battleLayout(team: Team, total: number): BattlePlacement[] {
  const maximum = team === 'heroes' ? 4 : 16;
  if (!Number.isInteger(total) || total < 1 || total > maximum) throw new Error(`Invalid ${team} battle roster size`);
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
