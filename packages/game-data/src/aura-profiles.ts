import { AURA_FAMILIES, AURA_FORMS, AURA_MOTIONS, type AuraVisualDefinition } from '@shards/shared';

export type AuraFamily = AuraVisualDefinition['family'];
export type AuraDesign = Partial<Omit<AuraVisualDefinition, 'family' | 'variant'>>;

const palettes: Record<AuraFamily, [string, string, string]> = {
  blood: ['#b52c50', '#e96377', '#ffd3bd'], holy: ['#ab792d', '#f4cb64', '#fff4c2'],
  nature: ['#34774e', '#92bf69', '#e1efb0'], shadow: ['#4b3e78', '#8f78bc', '#d7bee7'],
  arcane: ['#385eac', '#858ae3', '#d6d9ff'], fire: ['#a33622', '#ee8640', '#fff0a2'],
  frost: ['#417f9f', '#97d6df', '#e9ffff'], storm: ['#546795', '#a7beea', '#f2efff'],
  stone: ['#6b6654', '#b4a482', '#e8d8b1'], metal: ['#566d79', '#aabfc6', '#f1e8d0'],
  venom: ['#587432', '#b4c75f', '#eaf9a5'], spirit: ['#427b75', '#92bfae', '#dceac7'],
  time: ['#9d7543', '#d4b574', '#f8e8b7'], war: ['#8d4240', '#db865e', '#fbd6a0'],
  astral: ['#574e98', '#a899d6', '#f1e5fc'],
};
const motifs: Record<AuraFamily, AuraVisualDefinition['motif']> = {
  blood: 'drop', holy: 'cross', nature: 'leaf', shadow: 'eye', arcane: 'rune',
  fire: 'flame', frost: 'crystal', storm: 'bolt', stone: 'rock', metal: 'blade',
  venom: 'fang', spirit: 'wisp', time: 'hourglass', war: 'claw', astral: 'moon',
};

/** Every slot changes silhouette, travel path, density and proportions, not only its palette. */
export function auraVisual(family: AuraFamily, slot: number, design: AuraDesign = {}): AuraVisualDefinition {
  const familyIndex = AURA_FAMILIES.indexOf(family);
  const variant = familyIndex * 10 + slot;
  return {
    family, variant,
    form: AURA_FORMS[(slot * 2 + Math.floor(familyIndex / 7)) % AURA_FORMS.length],
    motion: AURA_MOTIONS[(familyIndex + slot) % AURA_MOTIONS.length],
    motif: motifs[family], colors: [...palettes[family]],
    count: 5 + (slot * 3 + familyIndex) % 12,
    radius: 10 + (slot * 5 + familyIndex * 3) % 12,
    height: 23 + (slot * 7 + familyIndex * 2) % 25,
    speed: Number((0.65 + (slot * 11 + familyIndex * 7) % 101 / 100).toFixed(2)),
    ...design,
  };
}
