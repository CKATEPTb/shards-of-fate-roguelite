/** Authored presentation data; rendering never consumes the combat dice stream. */
export const AURA_FAMILIES = ['blood', 'holy', 'nature', 'shadow', 'arcane', 'fire', 'frost', 'storm', 'stone', 'metal', 'venom', 'spirit', 'time', 'war', 'astral'] as const;
export const AURA_FORMS = ['dome', 'halo', 'vortex', 'orbit', 'runes', 'wings', 'chains', 'spikes', 'rain', 'flames', 'mist', 'shards', 'roots', 'waves', 'crown', 'eyes', 'feathers', 'embers', 'arcs', 'sigil'] as const;
export const AURA_MOTIONS = ['orbit', 'rise', 'fall', 'pulse', 'spiral', 'zigzag', 'breathe'] as const;
export const AURA_MOTIFS = ['drop', 'cross', 'leaf', 'skull', 'star', 'flame', 'crystal', 'bolt', 'rock', 'blade', 'fang', 'wisp', 'hourglass', 'claw', 'moon', 'bone', 'eye', 'feather', 'rune', 'shield'] as const;
export interface AuraVisualDefinition {
  family: typeof AURA_FAMILIES[number];
  form: typeof AURA_FORMS[number];
  motion: typeof AURA_MOTIONS[number];
  motif: typeof AURA_MOTIFS[number];
  colors: [string, string, string];
  /** Stable design variation, not random state. */
  variant: number;
  count: number;
  radius: number;
  height: number;
  speed: number;
}
export const PROJECTILE_KINDS = ['arrow', 'fire', 'frost', 'lightning', 'holy', 'shadow', 'nature', 'blood', 'arcane', 'poison', 'bone', 'stone'] as const;
export type ProjectileKind = typeof PROJECTILE_KINDS[number];
