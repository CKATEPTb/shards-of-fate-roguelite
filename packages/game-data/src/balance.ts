import type { GameContent } from '@shards/shared';

export const balance: GameContent['balance'] = {
  maxRounds: 100,
  maxTriggerDepth: 12,
  maxEventsPerStep: 1000,
  armorFactor: 1,
  maxDamageReduction: 0.9,
  critMultiplier: 1.5,
  healThreshold: 0.78,
  partyScaling: {
    1: { hp: 1, damage: 1 },
    2: { hp: 1.65, damage: 1.12 },
    3: { hp: 2.2, damage: 1.2 },
    4: { hp: 2.7, damage: 1.27 },
  },
};
