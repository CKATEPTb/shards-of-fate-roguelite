import type { Season } from '@shards/shared';

export interface MusicScene {
  kind: 'menu' | 'camp' | 'exploration' | 'battle' | 'boss' | 'victory' | 'defeat';
  season?: Season;
  threat?: 0 | 1 | 2;
  underground?: boolean;
}

export type SoundCue = 'ui' | 'select' | 'cancel' | 'equip' | 'loot' | 'coin' | 'step'
  | 'chest' | 'well' | 'portal' | 'stairs' | 'campfire' | 'bossArrival'
  | 'dice' | 'turn' | 'sword' | 'dagger' | 'heavy' | 'bow' | 'staff' | 'magic'
  | 'fire' | 'frost' | 'lightning' | 'nature' | 'holy' | 'shadow' | 'blood' | 'arcane'
  | 'heal' | 'shield' | 'aura' | 'hit' | 'critical' | 'block' | 'dodge' | 'death'
  | 'victory' | 'defeat' | 'flee';

export interface SoundOptions { volume?: number; pan?: number; intensity?: number }
export interface AudioVoice { stop(): void; duration: number }
export interface MusicTrack { dispose(): void }
