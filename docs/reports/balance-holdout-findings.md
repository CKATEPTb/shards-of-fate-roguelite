# First independent holdout: calibration targets missed

**Status: not accepted as the final calibration.** Easy win rate 39.2% (95% CI 36.2–42.2%) excludes the 30% target; middle win rate 11.3% (9.5–13.4%) excludes the 15% target. Hard win rate 6.9% (5.5–8.7%) is within the 5–10% goal.

158/579 successful runs (27.3%) exceed 90 simulated minutes. Mean winning duration is 87.16 minutes; median is 86.30 and P90 is 93.50. These statistics describe the 60–90 minute target range; no rule requires all runs inside that range or a majority above 90 minutes. This candidate is rejected because of its easy/middle win rates.

These seeds are now observed validation data. Retuning requires separate training seeds and a fresh independent holdout; this report must not be presented as acceptance evidence for a later tuned candidate.

Frozen candidate 3 content: 3bc9af6c. Sources stable in both runs: true. Same source/data in both modes: true.

Progression: 3024 campaigns / 55922 battles. Starter control: 1512 campaigns / 13587 battles.

No content or source values were changed during this analysis. The rates below describe a deterministic bot on a scripted route, not a calibrated probability for human players.

## Progression win rates

| Difficulty | Wins / runs | Win rate | 95% Wilson interval |
| --- | ---: | ---: | --- |
| Лёгкая (normal) | 395/1008 | 39.2% | 36.2%–42.2% |
| Нормальная (hard) | 114/1008 | 11.3% | 9.5%–13.4% |
| Сложная (nightmare) | 70/1008 | 6.9% | 5.5%–8.7% |

## Party size

| Difficulty | Heroes | Wins / runs | Win rate | 95% Wilson interval |
| --- | ---: | ---: | ---: | --- |
| Лёгкая (normal) | 1 | 105/252 | 41.7% | 35.7%–47.8% |
| Лёгкая (normal) | 2 | 85/252 | 33.7% | 28.2%–39.8% |
| Лёгкая (normal) | 3 | 98/252 | 38.9% | 33.1%–45.0% |
| Лёгкая (normal) | 4 | 107/252 | 42.5% | 36.5%–48.6% |
| Нормальная (hard) | 1 | 26/252 | 10.3% | 7.1%–14.7% |
| Нормальная (hard) | 2 | 20/252 | 7.9% | 5.2%–11.9% |
| Нормальная (hard) | 3 | 28/252 | 11.1% | 7.8%–15.6% |
| Нормальная (hard) | 4 | 40/252 | 15.9% | 11.9%–20.9% |
| Сложная (nightmare) | 1 | 22/252 | 8.7% | 5.8%–12.9% |
| Сложная (nightmare) | 2 | 19/252 | 7.5% | 4.9%–11.5% |
| Сложная (nightmare) | 3 | 12/252 | 4.8% | 2.7%–8.1% |
| Сложная (nightmare) | 4 | 17/252 | 6.7% | 4.3%–10.5% |

## Successful duration and >90-minute fraction

Minutes are simulated game time. Over 90 is measured separately among all valid runs and among winners; timeout deadlines are 100 minutes.

| Difficulty | Winner mean / median / P90 | Winners >90 | Fraction (95% interval) | All runs >90 |
| --- | --- | ---: | --- | ---: |
| Лёгкая (normal) | 87.17 / 86.37 / 93.65 | 104/395 | 26.3% (22.2%–30.9%) | 270/1008 |
| Нормальная (hard) | 87.48 / 86.83 / 93.46 | 40/114 | 35.1% (26.9%–44.2%) | 141/1008 |
| Сложная (nightmare) | 86.60 / 85.08 / 92.55 | 14/70 | 20.0% (12.3%–30.8%) | 81/1008 |

## Solo heroes

Each hero has 28 held-out campaigns per difficulty. Intervals are wide; these are descriptive observations, not a precise ranking.

| Hero | Лёгкая: wins /28 (95% interval) | Нормальная: wins /28 (95% interval) | Сложная: wins /28 (95% interval) |
| --- | --- | --- | --- |
| druid | 15/28 (35.8%–70.5%) | 4/28 (5.7%–31.5%) | 5/28 (7.9%–35.6%) |
| guardian | 9/28 (17.9%–50.7%) | 2/28 (2.0%–22.6%) | 0/28 (0.0%–12.1%) |
| mage | 12/28 (26.5%–60.9%) | 7/28 (12.7%–43.4%) | 0/28 (0.0%–12.1%) |
| necromancer | 9/28 (17.9%–50.7%) | 1/28 (0.6%–17.7%) | 3/28 (3.7%–27.2%) |
| paladin | 9/28 (17.9%–50.7%) | 0/28 (0.0%–12.1%) | 3/28 (3.7%–27.2%) |
| priest | 14/28 (32.6%–67.4%) | 4/28 (5.7%–31.5%) | 3/28 (3.7%–27.2%) |
| ranger | 9/28 (17.9%–50.7%) | 3/28 (3.7%–27.2%) | 3/28 (3.7%–27.2%) |
| rogue | 13/28 (29.5%–64.2%) | 2/28 (2.0%–22.6%) | 2/28 (2.0%–22.6%) |
| vampire | 15/28 (35.8%–70.5%) | 3/28 (3.7%–27.2%) | 3/28 (3.7%–27.2%) |

## Starter control and paired progression effect

The control collected loot but never equipped items or learned extra skills. It measures a lack of all progression, not an equipment-only intervention.

| Difficulty | Starter wins / runs | 95% upper bound | Matched progression wins / pairs | Paired gain (95% interval) |
| --- | ---: | ---: | ---: | --- |
| Лёгкая (normal) | 0/504 | 0.8% | 210/504 | 41.7% (37.4%–46.0%) |
| Нормальная (hard) | 0/504 | 0.8% | 54/504 | 10.7% (8.0%–13.4%) |
| Сложная (nightmare) | 0/504 | 0.8% | 38/504 | 7.5% (5.2%–9.8%) |

All first 126 seed indices for each party size and difficulty matched: 1512/1512. Starter-only wins: 0. Missing pairs: 0.

The paired gain interval uses the repository paired-difference estimator (normal approximation with a finite-sample Wilson floor). Different outcomes alter subsequent clock time, encounters and loot decisions even when the starting seed is matched.

## Outcome labels and timeout categories

| Mode | Victories | Defeats | Escapes | Timeouts | Errors | Invalid labels |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Progression | 579 | 1909 | 20 | 516 | 0 | 0 |
| Starter | 0 | 1429 | 18 | 65 | 0 | 0 |

| Mode | Timeout category | Count | Mean campaign minute |
| --- | --- | ---: | ---: |
| Progression | combat_round_limit | 326 | 67.67 |
| Progression | time_limit_between_battles | 53 | 100.00 |
| Progression | time_limit_in_battle | 137 | 100.00 |
| Starter | combat_round_limit | 65 | 40.66 |

A 100-round combat draw is classified as campaign timeout even when the run ends before 100 minutes. The raw records are retained; no invalid or error outcome is silently counted as defeat.

Most frequent progression enemies in 100-round draws: boss_ossuary_archon (50), boss_salt_prophet (46), act1_briar_court_19 (19), boss_ember_phoenix (17), act1_briar_court_18 (16), boss_buried_bell (15), boss_grave_frost (13), boss_iron_icebreaker (12), boss_black_snow_abbess (12), boss_rot_gardener (11), boss_glass_seed (11), act1_briar_court_16 (10).

## Confidence and practical limits

- Held-out seeds assess this deterministic combat policy and scripted route, not human win probability. No human navigation, simultaneous split groups, roaming reinforcements, connection delay or decision time.
- The party stays together, prefers normal encounters, follows the radial route, and uses generated campfires and a greedy gear/skill policy. Changing those decisions can materially change success.
- Difficulty comparisons reuse seeds and party rosters. Aggregate observations across difficulties are correlated; use per-difficulty intervals and paired differences.
- Per-hero solo samples are 28 campaigns per difficulty. Wide intervals and multiple comparisons prevent a precise hero balance ranking.
- The starter control also forbids learned skills, so its contrast measures the combined benefit of progression equipment and skills, not equipment alone.
- Zero wins in a finite control sample is not proof of impossibility. Control and progression routes can diverge after combat timing, injuries and equipment choices change.
- The experiment stops at 100 simulated minutes and combat at 100 rounds. Timeout outcomes include stalemates and deadline censorship, not automatic player deaths.
- Successful-duration summaries exclude defeats, escapes and timeouts; they cannot be read as the average length of every run.

## Provenance

- Progression input: balance-holdout-final.json / balance-holdout-final.json.gz.
- Control input: balance-starter-control.json / balance-starter-control.json.gz.
- Compact reproducible tables, duration intervals, timeout categories, solo rates and validation checks: balance-holdout-findings.json.
- Source SHA256: 9f7a515bf3fc2d94546312ed8929d8a5f6634589cfe4f67ca4134cebcfe035b0.
- Seed prefix: balance-holdout-v1.
