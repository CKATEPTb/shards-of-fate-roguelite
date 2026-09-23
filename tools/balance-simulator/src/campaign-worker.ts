import { gameContent } from '@shards/game-data';
import { DIFFICULTY_IDS, type DifficultyId, type DifficultyProfile, type GameContent } from '@shards/shared';
import { simulateCampaign } from './campaign';

export interface CampaignJob {
  index: number;
  seed: string;
  characterIds: string[];
  difficultyId: DifficultyId;
  mode: 'progression' | 'starter';
}
export interface CampaignTuning {
  difficulties?: Partial<Record<DifficultyId, Partial<DifficultyProfile>>>;
  partyScaling?: GameContent['balance']['partyScaling'];
  bossHpMultiplier?: number;
  bossPowerMultiplier?: number;
}

export function tunedContent(tuning?: CampaignTuning): GameContent {
  if (!tuning) return gameContent;
  const content: GameContent = { ...gameContent, balance: { ...gameContent.balance,
    partyScaling: tuning.partyScaling ?? gameContent.balance.partyScaling },
    difficulties: tuning.difficulties ? Object.fromEntries(DIFFICULTY_IDS.map(id => [id,
      { ...gameContent.difficulties![id], ...tuning.difficulties?.[id], id }])) as GameContent['difficulties'] : gameContent.difficulties,
    enemies: gameContent.enemies.map(enemy => !enemy.tags.includes('BOSS') ? enemy : {
      ...enemy, stats: { ...enemy.stats,
        maxHp: Math.max(1, Math.round(enemy.stats.maxHp * (tuning.bossHpMultiplier ?? 1))),
        power: Math.max(0, Math.round(enemy.stats.power * (tuning.bossPowerMultiplier ?? 1))) },
    }),
  };
  return Object.freeze(content);
}

if (process.send) process.on('message', (message: { jobs: CampaignJob[]; tuning?: CampaignTuning }) => {
  try {
    const content = tunedContent(message.tuning);
    const results = message.jobs.map(job => ({ job, result: simulateCampaign(content, job) }));
    process.send!({ results });
  } catch (error) {
    process.send!({ error: error instanceof Error ? error.stack : String(error) });
  }
});
