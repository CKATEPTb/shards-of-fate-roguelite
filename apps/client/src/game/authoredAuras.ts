import type { AuraVisualDefinition } from '@shards/shared';
import type { AuraCanvas } from './auraVisuals';
import { drawAuraDome, drawAuraForm, drawAuraMaterial, drawAuraSignature } from './auraForms';
import { auraLayer, auraMotion, auraMotif, type AuraBrush } from './auraDrawing';

export interface ActiveAuraVisual { id: string; visual: AuraVisualDefinition; stacks: number }
interface PreparedAura extends ActiveAuraVisual { colors: readonly [number, number, number] }
interface AuraPlan { ids: ReadonlySet<string>; effects: readonly PreparedAura[]; withBone: readonly PreparedAura[] }

/** Icon lists remain complete; six persistent compositions keep the body and action target legible. */
export const MAX_VISIBLE_AURA_EFFECTS = 6;
const plans = new WeakMap<readonly ActiveAuraVisual[], AuraPlan>();
const colors = new Map<string, readonly [number, number, number]>();
const EMPTY: AuraPlan = { ids: new Set(), effects: [], withBone: [] };
const PRIORITY: Record<string, number> = { divine_protection: 100, bastion: 95, taunted: 90, bleeding: 85, poisoned: 80, burning: 80, rage: 75, lethality: 75, evasiveness: 75 };

export function auraVisualKey(visual: AuraVisualDefinition): string {
  return [visual.family, visual.form, visual.motion, visual.motif, ...visual.colors, visual.variant, visual.count, visual.radius, visual.height, visual.speed].join(':');
}

export function activeAurasKey(auras?: readonly ActiveAuraVisual[]): string {
  return auras?.map(aura => `${aura.id}:${aura.stacks}:${auraVisualKey(aura.visual)}`).sort().join('|') ?? '';
}

function prepare(auras?: readonly ActiveAuraVisual[]): AuraPlan {
  if (!auras?.length) return EMPTY;
  const existing = plans.get(auras);
  if (existing) return existing;
  const grouped = new Map<string, ActiveAuraVisual>();
  for (const aura of auras) {
    const previous = grouped.get(aura.id);
    grouped.set(aura.id, { ...aura, stacks: Math.max(1, aura.stacks) + (previous?.stacks ?? 0) });
  }
  const effects = [...grouped.values()].sort((a, b) => {
    const priority = (aura: ActiveAuraVisual) => (PRIORITY[aura.id] ?? (aura.visual.form === 'dome' ? 60 : 20)) + Math.min(12, aura.stacks);
    return priority(b) - priority(a) || a.id.localeCompare(b.id);
  }).slice(0, MAX_VISIBLE_AURA_EFFECTS).map(aura => {
    const key = aura.visual.colors.join(':');
    let palette = colors.get(key);
    if (!palette) {
      palette = aura.visual.colors.map(color => Number.parseInt(color.replace('#', ''), 16)) as [number, number, number];
      // This cache is a renderer convenience, not an unbounded cache of user-authored variants.
      if (colors.size >= 256) colors.delete(colors.keys().next().value!);
      colors.set(key, palette);
    }
    return { ...aura, colors: aura.id === 'divine_protection' ? [0xa47a24, 0xe9be51, 0xffedb0] as const : palette };
  });
  // Painter order and the reduced bone-shield budget are also cached with the active set.
  const paintOrder = (a: PreparedAura, b: PreparedAura) => Number(b.visual.form === 'dome' || b.visual.form === 'mist') - Number(a.visual.form === 'dome' || a.visual.form === 'mist');
  const withBone = effects.filter(aura => aura.id !== 'bone_cyclone').slice(0, MAX_VISIBLE_AURA_EFFECTS - 1).sort(paintOrder);
  const plan = { ids: new Set(grouped.keys()), effects: effects.sort(paintOrder), withBone };
  plans.set(auras, plan);
  return plan;
}

export function authoredAuraIds(auras?: readonly ActiveAuraVisual[]): ReadonlySet<string> { return prepare(auras).ids; }

export function drawAuthoredAuras(canvas: AuraCanvas, auras?: readonly ActiveAuraVisual[], boneShield = false): void {
  const plan = prepare(auras);
  const effects = boneShield ? plan.withBone : plan.effects;
  const total = effects.length + (boneShield ? 1 : 0);
  const detail = total <= 2 ? 1 : total <= 4 ? 0.72 : 0.52;
  for (const aura of effects) {
    const v = aura.visual;
    const time = canvas.time * Math.max(0.15, Math.min(3, v.speed));
    const phase = v.variant * 2.399963;
    const pulseSpeed = v.motion === 'pulse' ? 3.8 : v.motion === 'zigzag' ? 2.7 : 1.3;
    const pulse = (Math.sin(time * pulseSpeed + phase) + 1) * 0.5;
    const expansion = v.motion === 'pulse' ? 0.88 + pulse * 0.17 : v.motion === 'breathe' ? 0.95 + pulse * 0.05 : 1;
    const brush: AuraBrush = {
      canvas, visual: v, colors: aura.colors, time, phase, detail,
      radius: Math.max(5, Math.min(28, v.radius)) * expansion, height: Math.max(12, Math.min(54, v.height)),
      count: Math.max(3, Math.min(16, Math.round(v.count * detail + Math.min(2, Math.max(0, aura.stacks - 1) / 3)))),
      alpha: (total <= 2 ? 1 : total <= 4 ? 0.82 : 0.69) * Math.min(1.13, 1 + Math.max(0, aura.stacks - 1) * 0.016),
      pulse,
    };
    if (aura.id === 'divine_protection') drawAuraDome(brush, true);
    else drawAuraForm(brush);
    drawAuraMaterial(brush);
    drawAuraSignature(brush, aura.id);
    // Architectural forms still expose their authored travel rhythm in two small free motifs.
    if (['dome', 'halo', 'wings', 'chains', 'spikes', 'roots', 'crown', 'sigil'].includes(v.form)) {
      for (let i = 0; i < 2; i++) {
        const point = auraMotion(brush, i, 2);
        auraMotif(brush, auraLayer(brush, point.depth ?? 0), point, detail < 0.65 ? 0.4 : 0.48, v.motif, 0.4);
      }
    }
  }
}
