import { AURA_TAU, auraEllipse, auraGlint, auraLayer, auraLine, auraMotion, auraMotif, auraPixel, auraPolygon, auraRibbon, auraRing, fract, type AuraBrush, type AuraPoint } from './auraDrawing';

/** Transparent sphere: separate surface, latitude lattice, moving meridians and travelling specular highlights. */
export function drawAuraDome(b: AuraBrush, divine = false): void {
  const c = b.canvas, r = b.radius * (0.97 + b.pulse * 0.03), h = b.height;
  auraEllipse(b, c.rear, 0, -h * 0.48, r * 2.1, h * 1.04, b.colors[0], divine ? 0.09 : 0.065, true);
  for (let i = 0; i < 3; i++) auraEllipse(b, c.rear, -r * 0.12, -h * 0.52, r * (1.94 - i * 0.13), h * (0.95 - i * 0.045), b.colors[1], 0.025, true);
  auraEllipse(b, c.rear, 0, -h * 0.48, r * 2, h, b.colors[1], 0.25 + b.pulse * 0.06);
  const bands = b.detail < 0.65 ? 3 : 5;
  for (let band = 1; band <= bands; band++) {
    const latitude = band / (bands + 1), width = r * Math.sin(latitude * Math.PI);
    auraRing(b, width, -h * latitude, 0.14, divine ? 0.14 : 0.1, b.time * 0.14, band % 2 ? 0 : 5);
  }
  for (let meridian = 0; meridian < 3; meridian++) {
    const longitude = b.time * 0.23 + b.phase + meridian * Math.PI / 3;
    const steps = b.detail < 0.65 ? 15 : 24;
    for (let i = 0; i < steps; i++) {
      const a = i / steps * AURA_TAU, z = (i + 1) / steps * AURA_TAU;
      const depth = Math.cos(a) * Math.sin(longitude);
      auraLine(b, auraLayer(b, depth), { x: Math.cos(a) * Math.cos(longitude) * r, y: -h * 0.48 + Math.sin(a) * h / 2 },
        { x: Math.cos(z) * Math.cos(longitude) * r, y: -h * 0.48 + Math.sin(z) * h / 2 }, b.colors[2], depth > 0 ? 0.16 : 0.08, 0.45);
    }
  }
  // Broken highlights follow the sphere, leaving the face and silhouette unobscured.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.9 + i * 0.06 + Math.sin(b.time * 0.4) * 0.08;
    auraLine(b, c.front, { x: Math.cos(a) * r, y: -h * 0.48 + Math.sin(a) * h / 2 },
      { x: Math.cos(a + 0.047) * r, y: -h * 0.48 + Math.sin(a + 0.047) * h / 2 }, b.colors[2], 0.42, 0.75);
  }
  for (let i = 0; i < Math.max(2, Math.ceil(b.count / 3)); i++) {
    const p = auraMotion(b, i, b.count / 3), angle = b.time * 0.4 + i * 2.399;
    const point = { x: Math.cos(angle) * r * 0.91, y: -h * 0.48 + Math.sin(angle) * h * 0.46, angle: 0 };
    auraGlint(b, auraLayer(b, p.depth ?? 0), point, 0.24 + Math.sin(b.time * 1.8 + i) ** 2 * 0.4, 1.6);
    if (i % 2 === 0) auraMotif(b, c.rear, { ...point, x: point.x * 0.8 }, 0.4, divine ? 'cross' : b.visual.motif, 0.4);
  }
  auraRing(b, r * 0.7, -0.5, 0.2, 0.24, -b.time * 0.2, 6, b.colors[2]);
}

export function drawAuraForm(b: AuraBrush): void {
  const c = b.canvas, r = b.radius, h = b.height, t = b.time, phase = b.phase;
  const n = b.count, motifSize = b.detail < 0.65 ? 0.48 : 0.6;
  switch (b.visual.form) {
    case 'dome': drawAuraDome(b); break;
    case 'halo': {
      const y = -h * 0.88;
      auraEllipse(b, c.rear, 0, y, r * 2.5, r * 0.65, b.colors[1], 0.065, true);
      auraRing(b, r * 0.83, y, 0.21, 0.63, t * 0.5 + phase, 6, b.colors[2]);
      auraRing(b, r * 1.05, y, 0.21, 0.23, -t * 0.3, 5);
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), angle = i / n * AURA_TAU + t * 0.3;
        const x = Math.cos(angle) * r, yy = y + Math.sin(angle) * r * 0.2;
        const g = auraLayer(b, Math.sin(angle));
        auraLine(b, g, { x, y: yy }, { x: x * 1.12, y: yy - 1.5 - b.pulse }, b.colors[2], 0.48);
        if (i % 3 === 0) auraMotif(b, g, { x, y: yy - 2, angle: 0, alpha: p.alpha }, motifSize * 0.8);
      }
      break;
    }
    case 'vortex': {
      const turn = b.visual.motion === 'fall' ? -t : t;
      auraEllipse(b, c.rear, 0, -1, r * 2.1, r * 0.42, b.colors[0], 0.1, true);
      auraRibbon(b, turn * 1.8 + phase, 1.7 + b.visual.variant % 3 * 0.3, 0.39);
      auraRibbon(b, -turn * 1.3 + phase + 2, 1.5, 0.2, b.colors[2], r * 0.92);
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i);
        auraMotif(b, auraLayer(b, p.depth ?? 0), p, motifSize, b.visual.motif, 0.75);
      }
      break;
    }
    case 'orbit': {
      const height = -h * (0.4 + b.visual.variant % 3 * 0.08);
      auraRing(b, r, height, 0.24, 0.16, t * 0.7 + phase, 5);
      if (b.detail > 0.6) auraRing(b, r * 0.78, height - 7, 0.47, 0.12, -t, 7);
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0);
        auraEllipse(b, g, p.x, p.y, 4.5, 3.5, b.colors[1], 0.045, true);
        auraMotif(b, g, { ...p, angle: -t * 0.35 + i }, motifSize, b.visual.motif, 0.78);
        auraLine(b, g, { x: p.x - Math.sin(p.angle ?? 0) * 3, y: p.y + 0.5 }, p, b.colors[2], 0.18);
      }
      break;
    }
    case 'runes': {
      for (let i = 0; i < n; i++) {
        const a = phase + i / n * AURA_TAU + t * 0.17, depth = Math.sin(a), g = auraLayer(b, depth);
        const y = -h * (0.28 + i % 3 * 0.2) + Math.sin(t + i) * 1.5;
        const x = Math.cos(a) * r;
        auraMotif(b, g, { x, y, angle: 0 }, motifSize * 1.15, b.visual.motif, 0.37 + b.pulse * 0.35);
        auraLine(b, g, { x, y: y + 4 }, { x, y: y + 6 + b.visual.variant % 3 }, b.colors[2], 0.35);
      }
      auraRing(b, r, -2, 0.23, 0.24, t * 0.1, 4);
      break;
    }
    case 'wings': {
      const flutter = Math.sin(t * 1.7) * (b.visual.motion === 'zigzag' ? 3 : 1.5), feathers = Math.max(4, Math.ceil(n / 2));
      for (const side of [-1, 1]) for (let i = feathers - 1; i >= 0; i--) {
        const p = i / (feathers - 1), root = { x: side * 4, y: -h * 0.5 };
        const tip = { x: side * (r * (1.25 - p * 0.42) + flutter), y: -h * (0.9 - p * 0.5) };
        auraPolygon(b, c.rear, [root, { x: tip.x - side * 3, y: tip.y - 3 }, tip, { x: root.x + side * 2, y: root.y + 6 }], b.colors[i % 2], 0.13 + p * 0.11);
        auraLine(b, c.rear, root, tip, b.colors[2], 0.36, 0.65);
        auraMotif(b, c.rear, { x: tip.x, y: tip.y + 1, angle: side * (0.5 + p) }, motifSize, b.visual.motif, 0.65);
      }
      break;
    }
    case 'chains': {
      for (let chain = 0; chain < 2; chain++) for (let i = 0; i < n; i++) {
        const p = i / Math.max(1, n - 1), a = phase + p * AURA_TAU * 1.35 + chain * Math.PI - t * 0.25;
        const depth = Math.sin(a), g = auraLayer(b, depth), x = Math.cos(a) * r;
        const y = -p * h + depth * 2;
        auraEllipse(b, g, x, y, i % 2 ? 3 : 1.8, 3, b.colors[1], 0.57);
        if (i % 4 === 0) auraMotif(b, g, { x, y, angle: a }, motifSize * 0.7, b.visual.motif, 0.63);
      }
      break;
    }
    case 'spikes': {
      for (let i = 0; i < n; i++) {
        const a = i / n * AURA_TAU + phase, depth = Math.sin(a), g = auraLayer(b, depth);
        const x = Math.cos(a) * r, y = depth * r * 0.2;
        const length = h * (0.19 + i % 3 * 0.055) * (0.8 + b.pulse * 0.2);
        const tip = { x: x * 1.13, y: y - length };
        auraPolygon(b, g, [{ x: x - 2, y }, tip, { x: x + 2, y }], b.colors[0], 0.52);
        auraPolygon(b, g, [{ x, y }, tip, { x: x + 2, y }], b.colors[1], 0.54);
        auraLine(b, g, tip, { x, y: y - 2 }, b.colors[2], 0.51);
        if (i % 3 === 0) auraMotif(b, g, { x: tip.x, y: tip.y - 2, angle: 0 }, motifSize * 0.6);
      }
      break;
    }
    case 'rain': {
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0);
        auraLine(b, g, { x: p.x - 0.8, y: p.y - 5 }, p, b.colors[1], (p.alpha ?? 1) * 0.25);
        auraMotif(b, g, { ...p, angle: -0.08 }, motifSize * 0.8, b.visual.motif, 0.8);
        const splash = fract(t * 0.4 + i / n);
        if (splash < 0.22) auraEllipse(b, g, p.x, Math.sin(i) * 3, 2 + splash * 16, 0.8 + splash * 4, b.colors[1], (1 - splash / 0.22) * 0.34);
      }
      break;
    }
    case 'flames': {
      for (let i = 0; i < n; i++) {
        const a = i / n * AURA_TAU + phase, depth = Math.sin(a), g = auraLayer(b, depth);
        const x = Math.cos(a) * r * 0.72, y = depth * r * 0.16;
        const wave = fract(t * 0.55 + i / n), length = (0.3 + Math.sin(wave * Math.PI) * 0.7) * h * 0.6;
        const lean = Math.sin(t * 2.3 + i) * 3;
        const points = [{ x: x - 2.5, y }, { x: x - 3, y: y - length * 0.45 }, { x: x + lean, y: y - length }, { x: x + 1, y: y - length * 0.6 }, { x: x + 3, y: y - length * 0.3 }, { x: x + 2, y }];
        auraPolygon(b, g, points, b.colors[0], 0.27);
        auraPolygon(b, g, [{ x: x - 1, y }, { x: x + lean * 0.5, y: y - length * 0.72 }, { x: x + 1.5, y }], b.colors[1], 0.34);
        if (i % 2 === 0) auraMotif(b, g, { x: x + lean, y: y - length - 2, alpha: 1 - wave }, motifSize * 0.8, b.visual.motif, 0.75);
      }
      break;
    }
    case 'mist': {
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0);
        const width = 8 + i % 3 * 5;
        auraEllipse(b, g, p.x * 0.7, p.y, width, 3 + i % 2, b.colors[0], (p.alpha ?? 1) * 0.095, true);
        auraLine(b, g, { x: p.x - width / 2, y: p.y }, { x: p.x + width / 2, y: p.y - 1.5 }, b.colors[1], 0.14);
        if (i % 2 === 0) auraMotif(b, g, { ...p, angle: Math.sin(t + i) * 0.5 }, motifSize * 0.8, b.visual.motif, 0.42);
      }
      break;
    }
    case 'shards': {
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0), length = 3 + i % 3 * 1.4;
        const top = { x: p.x + Math.sin(t + i), y: p.y - length }, bottom = { x: p.x - 1, y: p.y + length };
        auraPolygon(b, g, [top, { x: p.x - 2, y: p.y }, bottom], b.colors[0], 0.62);
        auraPolygon(b, g, [top, { x: p.x + 2, y: p.y }, bottom], b.colors[1], 0.55);
        auraLine(b, g, top, bottom, b.colors[2], 0.8);
        if (i % 3 === 0) auraMotif(b, g, { x: p.x, y: p.y - length - 2 }, motifSize * 0.6);
      }
      break;
    }
    case 'roots': {
      const vines = Math.max(3, Math.ceil(n / 2));
      for (let i = 0; i < vines; i++) {
        const a = i / vines * AURA_TAU + phase, depth = Math.sin(a), g = auraLayer(b, depth);
        let prev = { x: Math.cos(a) * r, y: depth * 3 };
        for (let node = 1; node <= 6; node++) {
          const amount = node / 6;
          const next = { x: Math.cos(a + amount * 1.1) * r * (1 - amount * 0.44) + Math.sin(t * 0.6 + node) * 0.7, y: -amount * h * 0.63 + depth * 3 };
          auraLine(b, g, prev, next, node < 3 ? b.colors[0] : b.colors[1], 0.65, 1 - amount * 0.55);
          if (node % 2 === 0) {
            const tip = { x: next.x + Math.sin(a) * 3, y: next.y - 3, angle: a };
            auraLine(b, g, next, tip, b.colors[1], 0.42);
            auraMotif(b, g, tip, motifSize * 0.8, b.visual.motif, 0.73);
          }
          prev = next;
        }
      }
      break;
    }
    case 'waves': {
      for (let wave = 0; wave < Math.min(5, n); wave++) {
        const p = fract(t * 0.35 + wave / 5), y = -h * p;
        const radius = r * (0.55 + p * 0.6);
        auraRing(b, radius, y, 0.2 + wave % 2 * 0.12, Math.sin(p * Math.PI) * 0.5, phase + t * (wave % 2 ? -1 : 1), 4, b.colors[wave % 3]);
        const angle = t * 0.7 + wave * 2;
        auraMotif(b, auraLayer(b, Math.sin(angle)), { x: Math.cos(angle) * radius, y: y + Math.sin(angle) * radius * 0.2, angle }, motifSize * 0.7, b.visual.motif, Math.sin(p * Math.PI) * 0.65);
      }
      break;
    }
    case 'crown': {
      const y = -h * 0.85, crownRadius = r * 0.65;
      auraRing(b, crownRadius, y, 0.24, 0.42, phase + t * 0.15, 0);
      for (let i = 0; i < n; i++) {
        const a = i / n * AURA_TAU + phase + t * (b.visual.motion === 'orbit' ? 0.6 : 0.2), depth = Math.sin(a), g = auraLayer(b, depth);
        const x = Math.cos(a) * crownRadius, bottom = y + depth * crownRadius * 0.24;
        const top = bottom - 4 - (i % 2 ? 0 : 2) - b.pulse;
        auraPolygon(b, g, [{ x: x - 2, y: bottom }, { x: x * 1.1, y: top }, { x: x + 2, y: bottom }], b.colors[1], 0.4);
        auraMotif(b, g, { x: x * 1.1, y: top - 2, angle: b.visual.motif === 'blade' ? -0.65 : 0 }, motifSize * 0.85, b.visual.motif, depth < 0 ? 0.4 : 0.84);
      }
      break;
    }
    case 'eyes': {
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0), blink = Math.max(0.15, Math.abs(Math.sin(t * 0.67 + i * 1.9)));
        const width = 3 + i % 2;
        auraPolygon(b, g, [{ x: p.x - width, y: p.y }, { x: p.x, y: p.y - blink * 2 }, { x: p.x + width, y: p.y }, { x: p.x, y: p.y + blink * 2 }], b.colors[0], 0.53);
        auraLine(b, g, { x: p.x - width, y: p.y }, { x: p.x, y: p.y - blink * 2 }, b.colors[2], 0.55);
        auraPixel(b, g, p.x + Math.sin(t + i) * 0.8, p.y - blink * 0.8, b.colors[2], 0.83, 0.8);
        if (i % 3 === 0 && b.visual.motif !== 'eye') auraMotif(b, g, { ...p, y: p.y + 4 }, motifSize * 0.55, b.visual.motif, 0.48);
      }
      break;
    }
    case 'feathers': {
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0), angle = Math.sin(t * 1.7 + i) * 0.9;
        auraMotif(b, g, { ...p, angle }, motifSize * 1.15, b.visual.motif, 0.83);
        auraLine(b, g, { x: p.x - Math.sin(angle) * 3, y: p.y + 2 }, { x: p.x + Math.sin(angle) * 2, y: p.y - 3 }, b.colors[2], 0.34);
      }
      break;
    }
    case 'embers': {
      for (let i = 0; i < n; i++) {
        const p = auraMotion(b, i), g = auraLayer(b, p.depth ?? 0);
        for (let trail = 2; trail >= 0; trail--) auraPixel(b, g, p.x + Math.sin(t + i) * trail, p.y + trail * 1.8, b.colors[Math.max(0, 2 - trail)], (p.alpha ?? 1) * (0.7 - trail * 0.18), trail ? 0.5 : 1);
        if (i % 3 === 0) auraMotif(b, g, { ...p, angle: t + i }, motifSize * 0.6, b.visual.motif, 0.58);
      }
      break;
    }
    case 'arcs': {
      const arcs = Math.max(2, Math.ceil(n / 3));
      for (let i = 0; i < arcs; i++) {
        const a = phase + i / arcs * AURA_TAU + t * 0.8, g = auraLayer(b, Math.sin(a));
        let previous = { x: Math.cos(a) * r, y: -h * 0.5 + Math.sin(a) * h * 0.4 };
        for (let j = 1; j <= 7; j++) {
          const angle = a + j * 0.12, fork = Math.sin(j * 7 + Math.floor(t * 7)) * 1.2;
          const next = { x: Math.cos(angle) * (r + fork), y: -h * 0.5 + Math.sin(angle) * h * 0.4 };
          auraLine(b, g, previous, next, j % 2 ? b.colors[1] : b.colors[2], 0.37 + b.pulse * 0.24, 0.55);
          previous = next;
        }
        auraMotif(b, g, { ...previous, angle: a }, motifSize * 0.8, b.visual.motif, 0.7);
      }
      break;
    }
    case 'sigil': {
      auraRing(b, r, -0.7, 0.26, 0.52, phase, 0, b.colors[2]);
      auraRing(b, r * 0.8, -0.7, 0.26, 0.35, phase, 5);
      const corners = 3 + b.visual.variant % 4;
      for (let i = 0; i < corners; i++) {
        const a = i / corners * AURA_TAU + phase + t * 0.17, z = a + AURA_TAU * (corners === 5 ? 2 : 1) / corners;
        auraLine(b, auraLayer(b, Math.sin(a)), { x: Math.cos(a) * r * 0.76, y: -0.7 + Math.sin(a) * r * 0.2 },
          { x: Math.cos(z) * r * 0.76, y: -0.7 + Math.sin(z) * r * 0.2 }, b.colors[1], 0.45);
        auraMotif(b, auraLayer(b, Math.sin(a)), { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.26 - 2, angle: 0 }, motifSize * 0.8, b.visual.motif, 0.75);
      }
      for (let i = 0; i < Math.ceil(n / 3); i++) {
        const p = auraMotion(b, i);
        auraPixel(b, auraLayer(b, p.depth ?? 0), p.x * 0.65, p.y * 0.45, b.colors[2], (p.alpha ?? 1) * 0.5);
      }
      break;
    }
  }
}

/** Family materials add a second, deliberately different layer beyond the main silhouette. */
export function drawAuraMaterial(b: AuraBrush): void {
  const c = b.canvas, t = b.time, r = b.radius;
  switch (b.visual.family) {
    case 'blood':
      for (let i = 0; i < 3; i++) auraEllipse(b, c.rear, Math.sin(i * 2.4) * r * 0.6, Math.cos(i) * 2, 3 + b.pulse * 2, 1.2, b.colors[0], 0.18, true);
      break;
    case 'holy':
      for (const side of [-1, 1]) auraLine(b, c.rear, { x: side * r * 0.6, y: -2 }, { x: side * r * 0.6, y: -b.height * 0.9 }, b.colors[1], 0.035 + b.pulse * 0.02, 2);
      break;
    case 'nature':
      for (let i = 0; i < 3; i++) auraMotif(b, auraLayer(b, Math.sin(i * 2)), { x: Math.cos(i * 2) * r * 0.75, y: Math.sin(i * 2) * 3, angle: i }, 0.4, 'leaf', 0.44);
      break;
    case 'shadow': auraEllipse(b, c.rear, Math.sin(t * 0.6) * 2, -2, r * 1.8, 7, b.colors[0], 0.1 + b.pulse * 0.06, true); break;
    case 'arcane': auraRing(b, r * 0.65, -b.height * 0.5, 0.55, 0.12, -t * 0.3, 3); break;
    case 'fire':
      for (let i = 0; i < 3; i++) auraPixel(b, c.front, Math.sin(i * 2.4) * r * 0.4, -fract(t * 0.4 + i / 3) * 7, b.colors[2], 0.45, 0.6);
      break;
    case 'frost':
      for (let i = 0; i < 3; i++) auraLine(b, c.rear, { x: 0, y: -1 }, { x: Math.cos(i * 2.1) * r * 0.7, y: Math.sin(i * 2.1) * 3 }, b.colors[2], 0.19);
      break;
    case 'storm': {
      const x = Math.sin(Math.floor(t * 6)) * r;
      auraLine(b, c.front, { x: x - 2, y: -8 }, { x: x + 1, y: -11 }, b.colors[2], 0.35);
      auraLine(b, c.front, { x: x + 1, y: -11 }, { x: x - 1, y: -14 }, b.colors[1], 0.28);
      break;
    }
    case 'stone':
      for (let i = 0; i < 3; i++) { const x = Math.cos(i * 2.4) * r * 0.6; auraLine(b, c.rear, { x, y: 0 }, { x: x + 2, y: -2 }, b.colors[0], 0.42, 1); auraLine(b, c.rear, { x: x + 2, y: -2 }, { x: x + 4, y: -1 }, b.colors[1], 0.3); }
      break;
    case 'metal':
      for (const side of [-1, 1]) auraGlint(b, c.front, { x: side * r * 0.85, y: -b.height * 0.4 }, Math.sin(t * 1.7 + side) ** 6 * 0.68, 1.3);
      break;
    case 'venom':
      for (let i = 0; i < 3; i++) { const phase = fract(t * 0.23 + i / 3); auraEllipse(b, c.rear, Math.sin(i * 2.4) * r * 0.7, -phase * 9, 1 + phase * 2, 1 + phase * 2, b.colors[1], Math.sin(phase * Math.PI) * 0.35); }
      break;
    case 'spirit': auraMotif(b, c.rear, { x: Math.sin(t * 0.4) * 4, y: -b.height * 0.7, angle: Math.sin(t) * 0.3 }, 0.5, 'wisp', 0.2 + b.pulse * 0.15); break;
    case 'time':
      for (let i = 0; i < 5; i++) { const a = i * AURA_TAU / 5 - t * 0.1; auraLine(b, auraLayer(b, Math.sin(a)), { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.2 }, { x: Math.cos(a) * (r + 1.5), y: Math.sin(a) * (r + 1.5) * 0.2 }, b.colors[2], 0.33); }
      break;
    case 'war':
      for (let i = 0; i < 3; i++) auraLine(b, c.rear, { x: -r * 0.65 + i * 4, y: -1 }, { x: -r * 0.4 + i * 4, y: -5 - b.pulse * 2 }, b.colors[1], 0.32, 0.7);
      break;
    case 'astral':
      for (let i = 0; i < 3; i++) auraGlint(b, i % 2 ? c.front : c.rear, { x: Math.sin(i * 2.4 + t * 0.3) * r, y: -b.height * (0.2 + i * 0.24) }, 0.15 + Math.sin(t + i) ** 2 * 0.32, 1.2);
      break;
  }
}

/** Named signatures make the most common combat states recognisable at a glance. */
export function drawAuraSignature(b: AuraBrush, id: string): void {
  const c = b.canvas;
  if (id === 'bleeding') {
    const heartbeat = Math.sin(b.time * 4) ** 6;
    auraEllipse(b, c.rear, 0, -1, b.radius * (1.1 + heartbeat * 0.25), 4, b.colors[0], 0.18 + heartbeat * 0.12, true);
    for (const side of [-1, 1]) auraMotif(b, c.front, { x: side * 5, y: -b.height * fract(b.time * 0.24 + (side + 1) * 0.25) }, 0.64, 'drop', 0.55);
  } else if (id === 'evasiveness') {
    for (const side of [-1, 1]) {
      const offset = side * (b.radius * 0.9 + Math.sin(b.time * 3) * 3);
      const points: AuraPoint[] = [{ x: offset, y: -b.height * 0.85 }, { x: offset - side * 3, y: -b.height * 0.67 }, { x: offset + side * 2, y: -b.height * 0.36 }, { x: offset - side * 2, y: -3 }];
      for (let i = 1; i < points.length; i++) auraLine(b, c.rear, points[i - 1], points[i], b.colors[2], 0.13, 1.2);
    }
  } else if (id === 'rage') {
    for (const side of [-1, 1]) {
      const x = side * b.radius * 0.82;
      auraPolygon(b, c.rear, [{ x: x - side * 3, y: -3 }, { x: x + side * 3, y: -b.height * 0.64 }, { x, y: -b.height * 0.43 }, { x: x - side * 2, y: -b.height * 0.82 }], b.colors[1], 0.16 + b.pulse * 0.15);
      auraMotif(b, c.front, { x, y: -b.height * 0.45, angle: side * 0.35 }, 0.65, 'claw', 0.45 + b.pulse * 0.15);
    }
  } else if (id === 'lethality') {
    const phase = fract(b.time * 0.4), radius = b.radius * (0.65 + phase * 0.4);
    for (const side of [-1, 1]) {
      const point = { x: side * radius, y: -b.height * 0.45 + Math.sin(b.time) * 3 };
      auraLine(b, c.front, { x: point.x - side * 6, y: point.y + 4 }, { x: point.x + side * 3, y: point.y - 5 }, b.colors[2], Math.sin(phase * Math.PI) * 0.5, 0.6);
      auraMotif(b, c.front, { ...point, angle: side > 0 ? 0 : Math.PI }, 0.7, 'blade', 0.6);
    }
  }
}
