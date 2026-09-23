# Candidate 3 census findings

33,000 battles; all 500 regular enemy definitions and 50 bosses; 5 seeds × 3 difficulties × 4 fixed equipment fixtures. Completed in 189 seconds. No errors or escapes. Source fingerprints remained unchanged.

Outcome totals: **31,158 victories, 1,822 defeats, 20 draws**. All 20 draws ended by mutual elimination in rounds 3–16; **no 100-round stalemates** occurred. Surviving limb HP is not survival: a hero may die with substantial HP on non-vital limbs.

## Boss progression with fixed equipment

Each cell aggregates all three difficulties. This is a screening comparison using full rare sets for solos and full epic sets for the party, with only innate skills. It does not measure real campaign success, progression gear, human decisions, or every possible equipment build.

| Season | Rare guardian | Rare priest | Rare mage | Epic balanced party |
| --- | ---: | ---: | ---: | ---: |
| spring | 195/195 (100.0%) | 189/195 (96.9%) | 142/195 (72.8%) | 188/195 (96.4%) |
| summer | 172/195 (88.2%) | 159/195 (81.5%) | 46/195 (23.6%) | 151/195 (77.4%) |
| autumn | 130/180 (72.2%) | 97/180 (53.9%) | 13/180 (7.2%) | 65/180 (36.1%) |
| winter | 15/180 (8.3%) | 25/180 (13.9%) | 1/180 (0.6%) | 9/180 (5.0%) |

## Outliers worth targeted follow-up

- Winter: `boss_iron_icebreaker`, `boss_frozen_executioner`, and `boss_polar_devourer` each won against every fixture in all 60 trials. Their authored kits combine armor reduction, guaranteed critical double hits, or three hits with stacking armor-bypassing damage. These mechanics plausibly explain the difficulty, but this census does not isolate each contribution.
- Autumn: `boss_ossuary_archon` permits 1/60 hero wins and `boss_grave_boar` 2/60, versus the season mean 42.4%. Archon combines three stacking DoT hits, shield preservation and healing; Boar combines armor reduction, double hits and a preserving shield.
- Spring: `boss_moss_colossus` is hardest at 38/60 hero wins (63.3%), versus season mean 91.5%; `boss_silver_huntress`, `boss_blind_florist`, and `boss_buried_bell` permit 60/60.
- Summer: `boss_cinder_butcher` permits 15/60 hero wins (25%) and `boss_obsidian_ram` 22/60 (36.7%), versus season mean 67.7%.
- Longest boss: `boss_mother_white_web`, mean 27.35 rounds and P90 58 across fixtures; the epic four-hero party can survive a long fight but has difficulty clearing recurring shielding.
- Tier 5: `act1_snow_grove_23` has 44/60 hero wins and mean 12.5 rounds; `act1_ember_hive_23` has 47/60 and mean 14.08 rounds. Both are high-armor tanks with regeneration. They are isolated-fight outliers relative to a tier mean of 92.8%.
- Tier 1–3 enemies lose all isolated fights against these complete rare/epic loadouts; this does not establish that they are too weak against starter gear or in normal packs. Tier 4 allows 99.5% hero wins.
- Rare solo mage is the weakest chosen fixed build: tier-5 win rate 75.1%, compared with guardian 99.3% and priest 97.5%. Different sets, weapons and innate skills confound class-only conclusions.

## Paired pilot comparison

The exact 240 original pilot seeds improve from 174/240 wins to 226/240 under candidate 3 (52 gains, 0 reversals). The original pilot covers only 20 evenly spaced definitions and one boss; it is not a complete pre-tuning census.

## Artifacts

- `combat-census-candidate-3.json`: raw per-seed outcomes, every enemy/fixture/difficulty cell, full frozen data, set IDs and hashes.
- `combat-census-candidate-3.md`: generated stage/tier tables and strongest/weakest lists.
- `combat-census-pilot-baseline.json`: original rule profiles and 240 pre-tuning trials.
- `combat-census-pilot-reproducibility.json`: exact outcome identity after parallel execution and decision-local memoization.

No content values were edited by the census. If the final calibration differs from candidate 3, rerun with the final frozen input before presenting this as the shipped balance.
