export type Pixel = { x: number; y: number; color: string };

/** Tiny deterministic rasterizer shared by portraits and the runtime sprite atlas. */
export class PixelCanvas {
  private readonly pixels = new Map<number, Pixel>();

  constructor(readonly size = 32) {}

  point(x: number, y: number, color: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.size && y < this.size) {
      this.pixels.set(y * this.size + x, { x, y, color });
    }
  }

  rect(x: number, y: number, width: number, height: number, color: string) {
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) this.point(x + column, y + row, color);
    }
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number, color: string) {
    for (let row = -radiusY; row <= radiusY; row++) {
      for (let column = -radiusX; column <= radiusX; column++) {
        if ((column / radiusX) ** 2 + (row / radiusY) ** 2 <= 1.1) this.point(x + column, y + row, color);
      }
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let step = 0; step <= steps; step++) {
      this.rect(x1 + (x2 - x1) * step / steps, y1 + (y2 - y1) * step / steps, thickness, thickness, color);
    }
  }

  /** Scan-convert a rigid skin piece without antialiasing or fractional edge pixels. */
  polygon(points: readonly { x: number; y: number }[], color: string) {
    if (points.length < 3) return;
    const first = Math.max(0, Math.floor(Math.min(...points.map(point => point.y))));
    const last = Math.min(this.size - 1, Math.ceil(Math.max(...points.map(point => point.y))));
    for (let y = first; y <= last; y++) {
      const crossings: number[] = [];
      const scan = y + 0.5;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a.y <= scan && b.y > scan) || (b.y <= scan && a.y > scan)) {
          crossings.push(a.x + (scan - a.y) * (b.x - a.x) / (b.y - a.y));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const from = Math.max(0, Math.ceil(crossings[i] - 0.5));
        const to = Math.min(this.size - 1, Math.floor(crossings[i + 1] - 0.5));
        for (let x = from; x <= to; x++) this.point(x, y, color);
      }
    }
  }

  result(): Pixel[] {
    return [...this.pixels.values()].sort((left, right) => left.y - right.y || left.x - right.x);
  }
}
