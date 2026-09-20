import type { GridPoint } from '@shards/shared';

export interface AlphaMask { width: number; height: number; pixels: Uint8Array }
export interface VisibilityFrame {
  cutWidth: number; cutHeight: number; realWidth: number; realHeight: number;
  x: number; y: number; customPivot: boolean; source: { resolution: number };
}
export interface VisibilityImage<Frame extends VisibilityFrame> {
  frame: Frame;
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  displayOriginX: number; displayOriginY: number; flipX: boolean; flipY: boolean;
  alpha: number; visible: boolean; depth: number;
}
interface Cells { left: number; top: number; right: number; bottom: number }
interface Surface<Frame extends VisibilityFrame> {
  image: VisibilityImage<Frame>; frame?: Frame; mask?: AlphaMask; cells?: Cells;
  x: number; y: number; ia: number; ib: number; ic: number; id: number;
  left: number; top: number; resolution: number; alpha: number; depth: number;
}

/** Pixel transmission through root scene images, independent of their reveal policy.
 * Refresh after transforms/fades; queries only visit nearby cached alpha masks. */
export class RenderedVisibility<Frame extends VisibilityFrame> {
  private cells = new Map<string, Set<Surface<Frame>>>();
  private masks = new WeakMap<Frame, AlphaMask>();
  private surfaces: Surface<Frame>[];

  constructor(images: VisibilityImage<Frame>[], private readAlpha: (frame: Frame) => AlphaMask, private cellSize = 64) {
    this.surfaces = images.map(image => ({ image, x: 0, y: 0, ia: 0, ib: 0, ic: 0, id: 0,
      left: 0, top: 0, resolution: 1, alpha: 0, depth: 0 }));
    this.refresh();
  }

  refresh(): void {
    for (const surface of this.surfaces) {
      const image = surface.image;
      surface.alpha = image.visible ? Math.max(0, Math.min(1, image.alpha)) : 0;
      surface.depth = image.depth;
      if (!surface.alpha || !image.scaleX || !image.scaleY) { this.reindex(surface); continue; }
      const frame = image.frame;
      if (surface.frame !== frame) {
        let mask = this.masks.get(frame);
        if (!mask) { mask = this.readAlpha(frame); this.masks.set(frame, mask); }
        surface.frame = frame; surface.mask = mask;
      }
      // Match Phaser's image origin and flip offsets, including trimmed frames.
      const left = frame.x - image.displayOriginX
        + (image.flipX && !frame.customPivot ? -frame.realWidth + 2 * image.displayOriginX : 0);
      const top = frame.y - image.displayOriginY
        + (image.flipY && !frame.customPivot ? -frame.realHeight + 2 * image.displayOriginY : 0);
      const cos = Math.cos(image.rotation); const sin = Math.sin(image.rotation);
      const sx = image.scaleX * (image.flipX ? -1 : 1);
      const sy = image.scaleY * (image.flipY ? -1 : 1);
      const a = cos * sx; const b = sin * sx; const c = -sin * sy; const d = cos * sy;
      const determinant = a * d - b * c;
      surface.x = image.x; surface.y = image.y;
      surface.ia = d / determinant; surface.ib = -b / determinant;
      surface.ic = -c / determinant; surface.id = a / determinant;
      surface.left = left; surface.top = top; surface.resolution = frame.source.resolution;
      const right = left + frame.cutWidth / surface.resolution;
      const bottom = top + frame.cutHeight / surface.resolution;
      const x1 = image.x + a * left + c * top; const y1 = image.y + b * left + d * top;
      const x2 = image.x + a * right + c * top; const y2 = image.y + b * right + d * top;
      const x3 = image.x + a * left + c * bottom; const y3 = image.y + b * left + d * bottom;
      const x4 = image.x + a * right + c * bottom; const y4 = image.y + b * right + d * bottom;
      this.reindex(surface, {
        left: Math.floor(Math.min(x1, x2, x3, x4) / this.cellSize),
        top: Math.floor(Math.min(y1, y2, y3, y4) / this.cellSize),
        right: Math.floor(Math.max(x1, x2, x3, x4) / this.cellSize),
        bottom: Math.floor(Math.max(y1, y2, y3, y4) / this.cellSize),
      });
    }
  }

  pointVisibility(point: GridPoint, depth: number): number {
    const candidates = this.cells.get(`${Math.floor(point.x / this.cellSize)},${Math.floor(point.y / this.cellSize)}`);
    if (!candidates) return 1;
    let transmission = 1;
    for (const surface of candidates) {
      if (surface.depth <= depth || !surface.alpha) continue;
      const dx = point.x - surface.x; const dy = point.y - surface.y;
      const x = Math.floor((surface.ia * dx + surface.ic * dy - surface.left) * surface.resolution);
      const y = Math.floor((surface.ib * dx + surface.id * dy - surface.top) * surface.resolution);
      const mask = surface.mask!;
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
      transmission *= 1 - mask.pixels[y * mask.width + x] / 255 * surface.alpha;
      if (!transmission) return 0;
    }
    return transmission;
  }

  destroy(): void { this.cells.clear(); this.surfaces.length = 0; }

  private reindex(surface: Surface<Frame>, next?: Cells): void {
    const previous = surface.cells;
    if (previous && next && previous.left === next.left && previous.top === next.top
      && previous.right === next.right && previous.bottom === next.bottom) return;
    if (previous) this.visit(previous, key => {
      const entries = this.cells.get(key)!;
      entries.delete(surface);
      if (!entries.size) this.cells.delete(key);
    });
    if (next) this.visit(next, key => {
      let entries = this.cells.get(key);
      if (!entries) { entries = new Set(); this.cells.set(key, entries); }
      entries.add(surface);
    });
    surface.cells = next;
  }

  private visit(cells: Cells, callback: (key: string) => void): void {
    for (let y = cells.top; y <= cells.bottom; y++) for (let x = cells.left; x <= cells.right; x++) callback(`${x},${y}`);
  }
}
