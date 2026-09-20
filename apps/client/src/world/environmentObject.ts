import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import type { Occluder } from './occlusion';

export interface EnvironmentObject {
  images: Phaser.GameObjects.Image[];
  /** Rendering parts share one reveal policy; low formations use revealable:false. */
  occluder: Omit<Occluder, 'id'>;
  foliage?: { image: Phaser.GameObjects.Image; x: number; y: number; phase: number };
  /** World-space mouth of an actual chimney, independent of roof transparency. */
  smokeSource?: GridPoint;
}
