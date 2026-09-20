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

  result(): Pixel[] {
    return [...this.pixels.values()].sort((left, right) => left.y - right.y || left.x - right.x);
  }
}
