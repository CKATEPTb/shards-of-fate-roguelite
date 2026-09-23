# Second independent holdout: candidate 4

**Win-rate check: compatible with the stated targets in this independent sample.**

Easy / middle / hard rates: 27.0% (95% 23.3%–31.0%); 16.5% (95% 13.5%–20.0%); 6.5% (95% 4.7%–9.1%). Targets: 30%, 15%, 5–10%.

Among successful runs, median 86.47 minutes, mean 87.15, P90 93.95. 65/252 (25.8%) exceed 90 minutes. The 60–90-minute range is reported descriptively; no all-runs-in-range or majority-over-90 rule is imposed.

Confidence-interval compatibility is not proof of exact win rates or equivalence. The simulation and sampling limits below apply.


Frozen candidate 4 content: 46142700. Sources stable in both runs: true. Same source/data in both modes: true.

Progression: 1512 campaigns / 27454 battles. Starter control: 648 campaigns / 5698 battles.

No content or source values were changed during this analysis. The rates below describe a deterministic bot on a scripted route, not a calibrated probability for human players.

## Progression win rates

| Difficulty | Wins / runs | Win rate | 95% Wilson interval |
| --- | ---: | ---: | --- |
| Лёгкая (normal) | 136/504 | 27.0% | 23.3%–31.0% |
| Нормальная (hard) | 83/504 | 16.5% | 13.5%–20.0% |
| Сложная (nightmare) | 33/504 | 6.5% | 4.7%–9.1% |

## Party size

| Difficulty | Heroes | Wins / runs | Win rate | 95% Wilson interval |
| --- | ---: | ---: | ---: | --- |
| Лёгкая (normal) | 1 | 33/126 | 26.2% | 19.3%–34.5% |
| Лёгкая (normal) | 2 | 30/126 | 23.8% | 17.2%–32.0% |
| Лёгкая (normal) | 3 | 37/126 | 29.4% | 22.1%–37.8% |
| Лёгкая (normal) | 4 | 36/126 | 28.6% | 21.4%–37.0% |
| Нормальная (hard) | 1 | 26/126 | 20.6% | 14.5%–28.5% |
| Нормальная (hard) | 2 | 16/126 | 12.7% | 8.0%–19.6% |
| Нормальная (hard) | 3 | 18/126 | 14.3% | 9.2%–21.5% |
| Нормальная (hard) | 4 | 23/126 | 18.3% | 12.5%–25.9% |
| Сложная (nightmare) | 1 | 9/126 | 7.1% | 3.8%–13.0% |
| Сложная (nightmare) | 2 | 7/126 | 5.6% | 2.7%–11.0% |
| Сложная (nightmare) | 3 | 7/126 | 5.6% | 2.7%–11.0% |
| Сложная (nightmare) | 4 | 10/126 | 7.9% | 4.4%–14.0% |

## Successful duration and >90-minute fraction

Minutes are simulated game time. Over 90 is measured separately among all valid runs and among winners; timeout deadlines are 100 minutes.

| Difficulty | Winner mean / median / P90 | Winners >90 | Fraction (95% interval) | All runs >90 |
| --- | --- | ---: | --- | ---: |
| Лёгкая (normal) | 87.23 / 86.84 / 94.17 | 35/136 | 25.7% (19.1%–33.7%) | 115/504 |
| Нормальная (hard) | 86.81 / 85.56 / 93.85 | 20/83 | 24.1% (16.2%–34.3%) | 74/504 |
| Сложная (nightmare) | 87.65 / 86.28 / 93.27 | 10/33 | 30.3% (17.4%–47.3%) | 44/504 |

## Solo heroes

Each hero has 14 held-out campaigns per difficulty. Intervals are wide; these are descriptive observations, not a precise ranking.

| Hero | Лёгкая: wins /14 (95% interval) | Нормальная: wins /14 (95% interval) | Сложная: wins /14 (95% interval) |
| --- | --- | --- | --- |
| druid | 4/14 (11.7%–54.6%) | 5/14 (16.3%–61.2%) | 2/14 (4.0%–39.9%) |
| guardian | 3/14 (7.6%–47.6%) | 2/14 (4.0%–39.9%) | 1/14 (1.3%–31.5%) |
| mage | 3/14 (7.6%–47.6%) | 3/14 (7.6%–47.6%) | 0/14 (0.0%–21.5%) |
| necromancer | 2/14 (4.0%–39.9%) | 2/14 (4.0%–39.9%) | 0/14 (0.0%–21.5%) |
| paladin | 6/14 (21.4%–67.4%) | 5/14 (16.3%–61.2%) | 1/14 (1.3%–31.5%) |
| priest | 5/14 (16.3%–61.2%) | 3/14 (7.6%–47.6%) | 1/14 (1.3%–31.5%) |
| ranger | 3/14 (7.6%–47.6%) | 2/14 (4.0%–39.9%) | 0/14 (0.0%–21.5%) |
| rogue | 5/14 (16.3%–61.2%) | 3/14 (7.6%–47.6%) | 2/14 (4.0%–39.9%) |
| vampire | 2/14 (4.0%–39.9%) | 1/14 (1.3%–31.5%) | 2/14 (4.0%–39.9%) |

## Starter control and paired progression effect

The control collected loot but never equipped items or learned extra skills. It measures a lack of all progression, not an equipment-only intervention.

| Difficulty | Starter wins / runs | 95% upper bound | Matched progression wins / pairs | Paired gain (95% interval) |
| --- | ---: | ---: | ---: | --- |
| Лёгкая (normal) | 0/216 | 1.7% | 53/216 | 24.5% (18.8%–30.3%) |
| Нормальная (hard) | 0/216 | 1.7% | 36/216 | 16.7% (11.7%–21.6%) |
| Сложная (nightmare) | 0/216 | 1.7% | 16/216 | 7.4% (3.9%–10.9%) |

All first 54 seed indices for each party size and difficulty matched: 648/648. Starter-only wins: 0. Missing pairs: 0.

The paired gain interval uses the repository paired-difference estimator (normal approximation with a finite-sample Wilson floor). Different outcomes alter subsequent clock time, encounters and loot decisions even when the starting seed is matched.

## Outcome labels and timeout categories

| Mode | Victories | Defeats | Escapes | Timeouts | Errors | Invalid labels |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Progression | 252 | 982 | 14 | 264 | 0 | 0 |
| Starter | 0 | 615 | 5 | 28 | 0 | 0 |

| Mode | Timeout category | Count | Mean campaign minute |
| --- | --- | ---: | ---: |
| Progression | combat_round_limit | 159 | 66.79 |
| Progression | time_limit_between_battles | 24 | 100.00 |
| Progression | time_limit_in_battle | 81 | 100.00 |
| Starter | combat_round_limit | 28 | 44.97 |

A 100-round combat draw is classified as campaign timeout even when the run ends before 100 minutes. The raw records are retained; no invalid or error outcome is silently counted as defeat.

Most frequent progression enemies in 100-round draws: boss_ossuary_archon (25), boss_salt_prophet (24), act1_briar_court_19 (10), act1_briar_court_18 (9), boss_locust_emperor (9), boss_grave_frost (9), boss_buried_bell (9), boss_briar_king (7), boss_last_lantern (6), act1_briar_court_17 (5), boss_ashen_pilgrim (5), boss_rot_gardener (5).

## Confidence and practical limits

- Held-out seeds assess this deterministic combat policy and scripted route, not human win probability. No human navigation, simultaneous split groups, roaming reinforcements, connection delay or decision time.
- The party stays together, prefers normal encounters, follows the radial route, and uses generated campfires and a greedy gear/skill policy. Changing those decisions can materially change success.
- Difficulty comparisons reuse seeds and party rosters. Aggregate observations across difficulties are correlated; use per-difficulty intervals and paired differences.
- Per-hero solo samples are 14 campaigns per difficulty. Wide intervals and multiple comparisons prevent a precise hero balance ranking.
- The starter control also forbids learned skills, so its contrast measures the combined benefit of progression equipment and skills, not equipment alone.
- Zero wins in a finite control sample is not proof of impossibility. Control and progression routes can diverge after combat timing, injuries and equipment choices change.
- The experiment stops at 100 simulated minutes and combat at 100 rounds. Timeout outcomes include stalemates and deadline censorship, not automatic player deaths.
- Successful-duration summaries exclude defeats, escapes and timeouts; they cannot be read as the average length of every run.

## Provenance

- Progression input: balance-validation-v2.json / balance-validation-v2.json.gz.
- Control input: balance-control-v2.json / balance-control-v2.json.gz.
- Compact reproducible tables, duration intervals, timeout categories, solo rates and validation checks: balance-validation-v2-findings.json.
- Source SHA256: 3555649422868a0d009a10792944f8d890924904a2fa232851a21e06e11d6598.
- Seed prefix: balance-holdout-v2.
