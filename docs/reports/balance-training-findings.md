# Candidate 3 training findings

Read-only analysis of `balance-training-candidate-3.json` and its compressed detailed report. This is training evidence, not an independent holdout result. No holdout data was read and no gameplay or simulator source was changed for this analysis.

## Provenance and limits

- Completed campaigns: **1512/1512**, all progression mode; **28,384 battles**.
- Seed prefix: `balance-train-v2`; content hash: `3bc9af6c`.
- Source hash at both start and finish: `47a5c9b95af561c153e9bf8d09428d321ab2f048978d1e6ea2e6abc05bf0d9d8`; `sourcesUnchanged=true`. These hashes describe the historical candidate run, before the completion fix and later live-data application.
- Detailed gzip SHA-256: `0f7971b174ef3a0b2e490f0789708c0f6a85c1f72070ed0c8e78c36914509cb7`.
- Summary difficulty counts agree with the detailed 1,512 entries. No error outcomes.
- Each difficulty/party-size cell has 126 campaigns. Every distinct composition is represented, but most have very few seeds. Difficulty comparisons reuse seeds; those outcomes are paired, not independent replications.
- Candidate selection reused training seeds. Wilson intervals below describe sample uncertainty and are not adjusted for tuning, multiple comparisons, or selection.
- These are scripted bot outcomes. Navigation, reinforcement, human decisions and network delays are absent. Bosses summon at 20/40/60/80 virtual minutes, so the successful-duration lower bound is imposed by the schedule.

## Main findings

1. **The completion bug did not inflate this candidate's wins:** none of 287 reported victories ends with every hero dead; every victory has four bosses defeated and a final combat victory.
2. **Duration still misses a strict 60–90 minute goal:** 80/287 wins (27.9%) take more than 90 virtual minutes. The strongest duration signal is normal four-player runs: median 91.39, with 26/44 wins above 90. Nightmare four-player wins have median 93.10, 8/13 above 90.
3. **Aggregate win rates are near the requested bands**, but hard four-player performance is lower than its nominal 15% target (13/126, 10.3%). Its wide 95% interval still contains 15%; this training cell alone does not establish a mismatch.
4. **Solo hero warnings remain exploratory:** guardian/ranger have 0/14 hard wins; priest/paladin have 0/14 nightmare wins. A 0/14 Wilson 95% interval extends to 21.5%, so these do not establish impossibility.
5. **Stalemates are material:** 179/1,512 runs (11.8%) end at the 100-round combat cap; another 119 (7.9%) reach the 100-minute campaign cap. Late wins and timeouts must remain visible alongside win rates.

## Difficulty outcomes

| Difficulty | Wins / runs | Win rate (95% Wilson) | Defeat | Timeout | Escaped | Win by 90 / all runs |
| --- | --- | --- | --- | --- | --- | --- |
| normal | 171/504 | 33.9% (29.9%–38.2%) | 193 | 137 | 3 | 126/504 (25.0%) |
| hard | 68/504 | 13.5% (10.8%–16.8%) | 343 | 86 | 7 | 48/504 (9.5%) |
| nightmare | 48/504 | 9.5% (7.3%–12.4%) | 379 | 75 | 2 | 33/504 (6.5%) |

The requested approximate win targets are normal 30%, hard 15%, nightmare 5–10%. Winning by 90 minutes is a stricter joint requirement: it is only 25.0% / 9.5% / 6.5% here. Do not present the unrestricted win rate as the probability of completing within 90 minutes.

## Party sizes

| Difficulty | Heroes | Wins / 126 | Win rate (95% Wilson) | Defeat / timeout / escaped |
| --- | --- | --- | --- | --- |
| normal | 1 | 43/126 | 34.1% (26.4%–42.8%) | 59 / 23 / 1 |
| normal | 2 | 39/126 | 31.0% (23.5%–39.5%) | 42 / 44 / 1 |
| normal | 3 | 45/126 | 35.7% (27.9%–44.4%) | 46 / 34 / 1 |
| normal | 4 | 44/126 | 34.9% (27.2%–43.6%) | 46 / 36 / 0 |
| hard | 1 | 16/126 | 12.7% (8.0%–19.6%) | 94 / 15 / 1 |
| hard | 2 | 19/126 | 15.1% (9.9%–22.4%) | 85 / 22 / 0 |
| hard | 3 | 20/126 | 15.9% (10.5%–23.2%) | 79 / 27 / 0 |
| hard | 4 | 13/126 | 10.3% (6.1%–16.9%) | 85 / 22 / 6 |
| nightmare | 1 | 12/126 | 9.5% (5.5%–15.9%) | 100 / 14 / 0 |
| nightmare | 2 | 12/126 | 9.5% (5.5%–15.9%) | 99 / 15 / 0 |
| nightmare | 3 | 11/126 | 8.7% (4.9%–15.0%) | 90 / 25 / 0 |
| nightmare | 4 | 13/126 | 10.3% (6.1%–16.9%) | 90 / 21 / 2 |

No party-size cell loses every run. Normal rates span 31.0–35.7%; hard 10.3–15.9%; nightmare 8.7–10.3%. Size-specific uncertainty is substantially wider than the aggregate intervals.

## Solo heroes

| Hero | Normal wins / 14 | Hard wins / 14 | Nightmare wins / 14 |
| --- | --- | --- | --- |
| guardian | 3/14 (21.4%) | 0/14 (0.0%) | 1/14 (7.1%) |
| priest | 3/14 (21.4%) | 1/14 (7.1%) | 0/14 (0.0%) |
| mage | 3/14 (21.4%) | 2/14 (14.3%) | 4/14 (28.6%) |
| vampire | 3/14 (21.4%) | 2/14 (14.3%) | 2/14 (14.3%) |
| paladin | 6/14 (42.9%) | 2/14 (14.3%) | 0/14 (0.0%) |
| druid | 7/14 (50.0%) | 3/14 (21.4%) | 2/14 (14.3%) |
| necromancer | 7/14 (50.0%) | 2/14 (14.3%) | 1/14 (7.1%) |
| rogue | 7/14 (50.0%) | 4/14 (28.6%) | 1/14 (7.1%) |
| ranger | 4/14 (28.6%) | 0/14 (0.0%) | 1/14 (7.1%) |

All solo heroes win at least once on normal. Druid, necromancer and rogue lead normal at 7/14; guardian, priest, mage and vampire have 3/14. The intervals are broad: 7/14 has 95% Wilson 26.8–73.2%, and 3/14 has 7.6–47.6%. These overlap. Hero identity is rotated over seed indices rather than crossed against every identical environment, so this is not a clean causal hero-strength comparison. Mage wins 2/14 hard versus 4/14 nightmare; that small reversal is compatible with sampling and difficulty-dependent combat/RNG paths.

## Zero-win compositions and coverage

| Party size | Distinct compositions | Seeds per composition per difficulty | Zero-win normal | Zero-win hard | Zero-win nightmare | Zero wins across all three difficulties |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 9 | 14 | 0 | 2 | 2 | 0 |
| 2 | 36 | 3–4 | 12 | 19 | 28 | 8 |
| 3 | 84 | 1–2 | 47 | 66 | 73 | 34 |
| 4 | 126 | 1 | 82 | 113 | 113 | 75 |

The eight duos with no win in any difficulty are listed below. Reused seeds across difficulties mean 9/12 outcomes correspond to only 3/4 underlying route seeds. Trio and four-player zero-win counts are especially uninformative because each composition has only one or two seeds per difficulty. They identify follow-up candidates, not proven unwinnable parties.

| Duo | Outcomes across three difficulties | Defeat / timeout |
| --- | --- | --- |
| priest + druid | 9 | 5 / 4 |
| paladin + ranger | 9 | 9 / 0 |
| necromancer + ranger | 9 | 7 / 2 |
| guardian + paladin | 12 | 7 / 5 |
| druid + ranger | 12 | 10 / 2 |
| priest + necromancer | 12 | 8 / 4 |
| guardian + vampire | 9 | 5 / 4 |
| mage + vampire | 9 | 7 / 2 |

## Successful virtual durations

Quantiles use linear interpolation between sorted completed-win durations. All 287 wins take at least 80.55 minutes and at most 99.98 minutes. Zero wins are below 60. No claim about real human playtime follows from these virtual times.

| Difficulty | Wins | p10 | Median | p90 | p95 | Within 60–90 | Above 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| normal | 171 | 81.83 | 86.51 | 94.22 | 97.14 | 126/171 (73.7%) | 45 |
| hard | 68 | 81.47 | 85.64 | 95.28 | 96.91 | 48/68 (70.6%) | 20 |
| nightmare | 48 | 81.54 | 87.10 | 94.68 | 96.04 | 33/48 (68.8%) | 15 |

| Difficulty | Heroes | Wins | Median | p90 | Above 90 |
| --- | --- | --- | --- | --- | --- |
| normal | 1 | 43 | 82.71 | 86.54 | 0/43 |
| normal | 2 | 39 | 83.91 | 89.84 | 4/39 |
| normal | 3 | 45 | 87.86 | 92.71 | 15/45 |
| normal | 4 | 44 | 91.39 | 97.19 | 26/44 |
| hard | 1 | 16 | 83.17 | 84.96 | 0/16 |
| hard | 2 | 19 | 85.45 | 93.59 | 4/19 |
| hard | 3 | 20 | 91.22 | 96.98 | 12/20 |
| hard | 4 | 13 | 88.25 | 92.28 | 4/13 |
| nightmare | 1 | 12 | 85.40 | 88.87 | 1/12 |
| nightmare | 2 | 12 | 84.03 | 88.24 | 1/12 |
| nightmare | 3 | 11 | 89.06 | 92.62 | 5/11 |
| nightmare | 4 | 13 | 93.10 | 96.22 | 8/13 |

Successful-only quantiles exclude all failures and 100-minute-censored runs; they cannot describe the duration of all attempts or prove that the full population would finish by 90 minutes. The large-party tail is the principal unmet duration requirement in these training data.

## Defeat, combat cap and campaign cap

| Difficulty | Defeat | Combat draw at 100 rounds | Campaign cap at 100 minutes | Escaped |
| --- | --- | --- | --- | --- |
| normal | 193 | 67 | 70 | 3 |
| hard | 343 | 62 | 24 | 7 |
| nightmare | 379 | 50 | 25 | 2 |

All 179 timeout runs whose last battle is a draw reached 100 rounds. All other 119 timeout runs ended at exactly 100 virtual minutes: 83 had a running final battle (50 winter bosses, 33 roaming), and 36 had a previous roaming victory but had not finished the expedition. Combat-cap draws include 164 boss fights and 15 roaming fights. A combat-cap timeout is not a party death and may occur early (minimum timeout duration 27.19 minutes).

| Boss | Observed fights | Draws | Observed draw rate |
| --- | --- | --- | --- |
| boss_ossuary_archon | 62 | 23 | 37.1% |
| boss_salt_prophet | 120 | 21 | 17.5% |
| boss_ashen_pilgrim | 64 | 11 | 17.2% |
| boss_ember_phoenix | 80 | 10 | 12.5% |
| boss_black_snow_abbess | 50 | 10 | 20.0% |
| boss_briar_king | 93 | 9 | 9.7% |

Ossuary Archon is the largest stalemate signal: 23/62 observed fights drew. These counts mix party sizes, difficulties and survivor selection; they justify targeted diagnostics rather than a direct boss nerf.

## Final-battle and casualty consistency

- Victory with every ending hero dead: **0/287**.
- Victory without four defeated bosses: **0**.
- Victory whose final combat is a draw: **0**.
- Any non-defeat outcome with every hero dead: **0**.
- Final-combat draws with all heroes dead: **6**, all already reported as defeat.
- Valid victories with at least one dead teammate: **111** (normal 57, hard 30, nightmare 24). These must remain victories while at least one teammate survives.

The completion-priority correction is a real regression fix, but it changes none of this candidate run’s observed labels. It must be validated on fresh seeds without retroactively treating the old source fingerprint as the corrected executable.

## Implications for the independent holdout

Keep the holdout independent and report its fixed acceptance criteria: per-difficulty and per-size wins, uncertainty, outcome reasons, successful-duration quantiles, and the fraction of all attempts that win within 60–90 minutes. Do not tune against holdout outcomes. If later work is authorized, use a new training seed set for the zero-win solo/duo candidates and the largest boss stalemate signals; reserve another fresh holdout after any change.

## Save compatibility audit after live balance application

This additional check used in-memory storage only; no browser save or source file was modified.

- Reconstructed all 50 original boss HP values from the authored seasonal drafts, restored party multipliers to 1/1, 1.65/1.12, 2.2/1.2, 2.7/1.27 and difficulty multipliers to 1/1, 1.3/1.2, 1.6/1.4. The resulting content hash is **5211d046**, exactly matching the pre-balance training baseline and the existing seasonal-boss shipped hash.
- The fresh-process current gameContent hash was **3bc9af6c**, matching candidate 3. isCurrentShippedContent(current) returned false because the hardcoded shipped list lacks this new balance revision.
- A healthy old solo checkpoint and a healthy old network checkpoint both roundtrip under reconstructed old content. Loading those same bytes under current content throws at coop.contentHash and session.contentHash, respectively. Thus pre-balance resumability is a confirmed regression, not merely a hypothetical hash concern.
- Both incompatible stored records remain byte-for-byte intact; removeItem was called zero times. Current-content solo/network checkpoints both roundtrip successfully.
- readSession checks hashes before its failed-run deletion paths (apps/client/src/session/storage.ts:51 and :54; solo deserialization at :59). useSession catches the load failure, clears only React state and shows an unreadable/incompatible-save message (useSession.ts:8, :30, :54). The main session key is preserved. Startup separately removes obsolete prototype keys through clearPrototypeSaves; those are different keys.
- Starting a new game successfully writes to the same session key, replacing that retained old checkpoint (storage.ts:70 / :80). Incompatible saves are therefore recoverable from storage until the user starts a replacement run or otherwise removes the key.

Simply allowlisting or rewriting the hash is insufficient for an active battle. In a separate in-memory diagnostic, an old-scaling encounter with enemy HP maxima 12/12/25 had its hash replaced with the current hash; restore still rejected units[1].stats.maxHp because the current expected maxima are 5/5/10. snapshot-units.ts:45 validates saved stats against a combat rebuilt from current content, and coop/snapshot.ts:170 invokes that decoder for active battles, including fitted loadouts.

A future compatibility change needs an explicit versioned migration: validate the old snapshot against trusted predecessor content, then define how active enemy maxima/current HP, shields and other state are carried into the new balance, or preserve a pinned legacy ruleset for that run. Validate both idle and active checkpoints, fitted loadouts, seasonal bosses, RNG continuity and dead co-op spectators. Do not bypass arbitrary content hashes or claim replay equivalence across changed loot/combat rules. No migration was attempted while the independent holdout sources were frozen.
