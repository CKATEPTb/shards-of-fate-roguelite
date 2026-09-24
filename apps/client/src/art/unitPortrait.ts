import { getEnemyAppearance, type BossForm, type EnemyForm } from './enemyAppearance';
import { unitFrameMetrics } from './unitFrames';

type Crop = readonly [x: number, y: number, size: number];

const enemyCrops: Record<EnemyForm, Crop> = {
  raider: [13, 2, 38], archer: [13, 2, 38], shaman: [13, 2, 38], bulwark: [13, 2, 38], stalker: [15, 10, 36],
  skeleton: [14, 2, 36], revenant: [14, 2, 36], lich: [14, 2, 36], wraith: [13, 4, 38],
  treant: [10, 3, 42], thorn: [13, 4, 38], mushroom: [10, 4, 42], flower: [9, 2, 44],
  eye: [8, 4, 46], crab: [6, 13, 50], spider: [10, 17, 43], larva: [13, 16, 37], leech: [13, 16, 37],
  rat: [17, 29, 30], wolf: [14, 20, 36], boar: [12, 18, 40], wyrm: [11, 2, 40],
};

const bossCrops: Record<BossForm, Crop> = {
  colossus: [12, 5, 38], golem: [12, 2, 38], antlerTitan: [6, 2, 50], jotunn: [12, 2, 38],
  boneSovereign: [10, 2, 42], oracle: [12, 2, 38], reaper: [13, 3, 36], crystal: [9, 5, 44],
  broodQueen: [15, 26, 32], leviathan: [2, 3, 59], drake: [10, 3, 42], behemoth: [7, 6, 48],
  phoenix: [12, 2, 38], locust: [10, 2, 42],
};
const individualCrops: Record<string, Crop> = { boss_meltwater_lady: [13, 2, 36] };

/** Front-facing crops share the same anatomy in the queue and knowledge catalog. */
export function unitPortraitViewBox(artId: string, enemy: boolean): string {
  if (!enemy) return '18 3 28 28';
  const appearance = getEnemyAppearance(artId);
  const crop = individualCrops[artId]
    ?? (appearance?.bossForm ? bossCrops[appearance.bossForm] : appearance ? enemyCrops[appearance.form] : undefined);
  const [x, y, extent] = crop ?? [0, 0, 64];
  const resolution = unitFrameMetrics(true).size / 64;
  return `${x * resolution} ${y * resolution} ${extent * resolution} ${extent * resolution}`;
}
