import type Phaser from 'phaser';
import type { EnvironmentPalette } from './palette';

type Art = Phaser.GameObjects.Graphics;

export interface TreeStyle { scale: number; narrow?: boolean; dark?: boolean; birch?: boolean }

function treeRect(art: Art, x: number, y: number, style: TreeStyle) {
  const sx = style.scale * (style.narrow ? 0.75 : 1);
  return (dx: number, dy: number, width: number, height: number, colour: number) => {
    art.fillStyle(colour).fillRect(Math.round(x + dx * sx), Math.round(y + dy * style.scale), Math.round(width * sx), Math.round(height * style.scale));
  };
}

/** Native tree coordinates are shared with the original battle clearing. */
export function drawTreeTrunk(art: Art, x: number, y: number, palette: EnvironmentPalette, style: TreeStyle) {
  const rect = treeRect(art, x, y, style);
  rect(-9, -78, 20, 87, style.birch ? 0x8f9280 : palette.bark[0]);
  rect(-4, -65, 7, 69, style.birch ? 0xd0cfab : palette.bark[1]);
  rect(-20, 2, 16, 9, palette.bark[0]);
  rect(7, 0, 21, 10, palette.bark[0]);
  if (style.birch) for (let row = -55; row < 0; row += 13) rect(-8, row, 8, 3, 0x51584c);
}

export function drawTreeCrown(art: Art, x: number, y: number, palette: EnvironmentPalette, style: TreeStyle) {
  const rect = treeRect(art, x, y, style);
  const shades = style.dark ? palette.darkLeaf : palette.leaf;
  const tiers = [[-48, -112, 98, 34], [-38, -139, 73, 35], [-24, -161, 49, 38], [-67, -89, 129, 31], [-58, -66, 116, 23]];
  tiers.forEach(([dx, dy, width, height], i) => {
    rect(dx, dy, width, height, shades[i % shades.length]);
    rect(dx + 10, dy - 5, width - 25, 9, shades[(i + 1) % shades.length]);
    rect(dx - 7, dy + 8, 14, height - 12, shades[i % shades.length]);
    rect(dx + width - 9, dy + 8, 18, height - 15, shades[i % shades.length]);
  });
  rect(-36, -118, 22, 4, style.dark ? palette.darkLeaf[3] : palette.leaf[3]);
  rect(5, -145, 17, 4, style.dark ? palette.darkLeaf[3] : palette.leaf[3]);
}

export function drawTreeShadow(art: Art, x: number, y: number, scale: number) {
  art.fillStyle(0x091b15, 0.5).fillEllipse(x, y + 8 * scale, 130 * scale, 32 * scale);
}

/** Mossy, broken paving is the same material in the arena and exploration. */
export function drawStoneSlab(art: Art, x: number, y: number, palette: EnvironmentPalette, variant: number, scale = 1) {
  const rect = (dx: number, dy: number, width: number, height: number, colour: number, alpha = 1) => {
    art.fillStyle(colour, alpha).fillRect(Math.round(x + dx * scale), Math.round(y + dy * scale), Math.round(width * scale), Math.round(height * scale));
  };
  rect(-3, 3, 34, 19, 0x1e3029);
  rect(0, 0, 28, 15, palette.path[variant % palette.path.length]);
  rect(3, 0, 21, 2, palette.rock[2], 0.35);
  if (variant % 5 < 2) rect(15, 9, 17, 7, palette.moss);
  if (variant % 7 === 0) rect(8, 6, 2, 8, palette.path[2]);
}

export function drawGroundFleck(art: Art, x: number, y: number, palette: EnvironmentPalette, variant: number) {
  const colours = [palette.ground[1], palette.ground[0], palette.grass, 0x14251e, palette.moss];
  art.fillStyle(colours[variant % colours.length], 0.55).fillRect(x, y, 2 + variant % 3 * 2, 2);
  if (variant % 7 === 0) art.fillRect(x, y - 4, 2, 6);
}
