# Candidate 4 census: all enemy definitions

33,000 isolated battles; all 500 mobs and 50 bosses; 6,600 enemy/fixture/difficulty cells with five seeds each. Completed in 259.2 seconds. Full rare solo sets and a full epic balanced party, all at full health; no learned extra skills.

Outcomes: victory 31140, defeat 1841, draw 19, escaped 0, error 0. All 19 draws are mutual elimination; no round-limit draws. Maximum 77 rounds.

Engine and policy fingerprints stayed unchanged. Data checksum: 9e3b9b58. No source or content changes were made by the census.

## Paired comparison with candidate 3

All seeds and fixtures are identical to the historical census; only easy and middle difficulty profiles changed.

| Difficulty ID | Before wins /11,000 | Current wins /11,000 | Gains | Losses |
| --- | ---: | ---: | ---: | ---: |
| normal | 10569 | 10497 | 10 | 82 |
| hard | 10346 | 10400 | 62 | 8 |
| nightmare | 10243 | 10243 | 0 | 0 |

## Boss season rates

| Season | Win rate across fixed fixtures/difficulties |
| --- | ---: |
| spring | 91.8% |
| summer | 67.4% |
| autumn | 40.8% |
| winter | 6.1% |

## Hardest bosses

| Boss | Season | Hero wins / trials | Mean rounds |
| --- | --- | ---: | ---: |
| boss_grave_frost | winter | 0/60 | 20.28 |
| boss_iron_icebreaker | winter | 0/60 | 18.80 |
| boss_heart_of_last_glacier | winter | 0/60 | 16.40 |
| boss_ossuary_archon | autumn | 0/60 | 15.22 |
| boss_glass_empress | winter | 0/60 | 12.82 |
| boss_frozen_executioner | winter | 0/60 | 11.75 |
| boss_white_sovereign | winter | 1/60 | 16.63 |
| boss_polar_devourer | winter | 1/60 | 10.42 |

## Interpretation

- These results screen isolated enemies with fixed complete sets. They do not estimate campaign wins, early starter fights, roaming packs, or optimized endgame builds.
- Mixed fixtures and gear tiers confound a class-only or party-size-only interpretation. Per-cell five-seed samples have wide uncertainty; pooled rankings identify candidates for follow-up, not proof that a specific enemy needs a stat change.
- Use the separate independent campaign validation to assess the 30% / 15% / 5–10% win-rate goals. This census cannot establish that calibration passes.
- Exact fingerprints, coverage checks and paired counts: combat-census-v2-validation.json. Every seed result and full frozen inputs: combat-census-v2.json.
