import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import { tileCenter } from './projection';

/** Shared by the hovered cell and the destination at the end of a walking route. */
export function drawMovementCursor(art: Phaser.GameObjects.Graphics, tile: GridPoint, blocked = false): void {
  const { x, y } = tileCenter(tile);
  const color = blocked ? 0xd18b76 : 0xe8d8a1;
  art.lineStyle(2.5, color, 0.95).strokeCircle(x, y, 12);
  if (blocked) {
    art.beginPath().moveTo(x - 5, y - 5).lineTo(x + 5, y + 5)
      .moveTo(x + 5, y - 5).lineTo(x - 5, y + 5).strokePath();
  }
}
