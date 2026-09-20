import type { Season } from '@shards/shared';

export interface EnvironmentPalette {
  ground: number[];
  grass: number;
  flower: number;
  path: number[];
  leaf: number[];
  darkLeaf: number[];
  water: number[];
  rock: number[];
  bark: number[];
  moss: number;
}

/** The battle clearing is the common material reference for both game views. */
export const environmentPalettes: Record<Season, EnvironmentPalette> = {
  spring: { ground: [0x293d2f, 0x2d4131, 0x304332, 0x293b2d], grass: 0x536047, flower: 0x879374, path: [0x455047, 0x4e584b, 0x3d4b40], leaf: [0x1c382a, 0x284832, 0x365639, 0x496044], darkLeaf: [0x10281e, 0x173323, 0x1d3c28, 0x24472c], water: [0x213d3a, 0x30514a, 0x526c59], rock: [0x334439, 0x68745d, 0x879079], bark: [0x27382a, 0x4b4a32], moss: 0x394e31 },
  summer: { ground: [0x323e29, 0x37422b, 0x39432c, 0x303b27], grass: 0x687347, flower: 0xb6aa61, path: [0x4a5140, 0x59604a, 0x414c38], leaf: [0x293e25, 0x3b502e, 0x526638, 0x6a7747], darkLeaf: [0x1b3020, 0x263d24, 0x324a2c, 0x405936], water: [0x24433b, 0x365a49, 0x5a7660], rock: [0x404939, 0x74795e, 0x9a9b77], bark: [0x363b27, 0x565033], moss: 0x495b32 },
  autumn: { ground: [0x3a382b, 0x403b2c, 0x433d2e, 0x38352a], grass: 0x796443, flower: 0xbb854f, path: [0x504b3e, 0x605848, 0x454537], leaf: [0x493a2b, 0x734632, 0x93623a, 0xb27b43], darkLeaf: [0x332e25, 0x4b3528, 0x654230, 0x805436], water: [0x34413d, 0x4a554b, 0x667261], rock: [0x48483c, 0x736f5b, 0x958d72], bark: [0x3b3729, 0x5b4a33], moss: 0x4b5335 },
  winter: { ground: [0x84938b, 0x8c9a91, 0x939f96, 0x7f8e86], grass: 0x667b6b, flower: 0xc2cfc0, path: [0x61736a, 0x74847a, 0x55695f], leaf: [0x294238, 0x3a594b, 0x819889, 0xb0c1b2], darkLeaf: [0x243b34, 0x344d42, 0x617b6c, 0x8fa493], water: [0x425f62, 0x648181, 0x91a9a3], rock: [0x4d6259, 0x7f9181, 0xb7c7b7], bark: [0x334439, 0x58614a], moss: 0x526950 },
};

/** Cosmetic variation never consumes a gameplay RNG stream. */
export function grain(x: number, y: number, salt: number): number {
  return (Math.imul(x + 31, 73856093) ^ Math.imul(y + 53, 19349663) ^ Math.imul(salt + 7, 83492791)) >>> 0;
}
