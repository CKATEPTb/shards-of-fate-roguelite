import type { GameContent } from '@shards/shared';

/** Campaign calibration; authored boss drafts retain their relative health. */
export const BOSS_HEALTH_SCALE = 0.6;

export const balance: GameContent['balance'] = {
  maxRounds: 100,
  maxTriggerDepth: 12,
  maxEventsPerStep: 1000,
  armorFactor: 1,
  maxDamageReduction: 30,
  healThreshold: 0.78,
  partyScaling: {
    1: { hp: 0.33, damage: 0.5 },
    2: { hp: 0.9, damage: 0.94 },
    3: { hp: 1.6, damage: 1.18 },
    4: { hp: 2.4, damage: 1.48 },
  },
};
