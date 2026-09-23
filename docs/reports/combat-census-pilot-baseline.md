# Isolated combat census

Captured 2026-09-23T22:39:58.071Z. Content checksum `3c1207dc`.

240/240 battles; 20/20 enemy definitions; 2.6 seconds. Complete: true.

Outcomes: victory 174, defeat 64, draw 0, escaped 2, error 0.

## Scope

- One authored enemy, full-health heroes and intact limbs per fight. Actual party/difficulty scaling, equipment/set bonuses and decision policy.
- Three solo archetypes in full rare sets; one balanced four-hero party in full epic sets. This is an encounter diagnostic, not a campaign win-rate estimate.
- Each set is the lexical middle catalogue set matching the hero silhouette and rarity; no enemy-specific equipment optimization or additional learned skills.
- Different gear tiers confound direct solo/party comparisons. Easy and hard outliers are relative to a monster tier or boss season, not balance verdicts.
- Seeds are paired across difficulties. Errors are excluded from win rates; draws, escapes and defeats remain separately reported.
- Aggregate enemy rankings average different fixtures/difficulties; inspect detailed rows before changing content. Five seeds per cell is a screening sample.

## Frozen balance profiles

```json
{
  "difficulties": {
    "normal": {
      "id": "normal",
      "name": "Легкая",
      "description": "Стандартная сила врагов и частота опасных встреч.",
      "enemyHpMultiplier": 1,
      "enemyDamageMultiplier": 1,
      "epicGroupChance": 0.26,
      "minibossChunkChance": 0.08,
      "rareLootMultiplier": 1
    },
    "hard": {
      "id": "hard",
      "name": "Нормальная",
      "description": "Враги крепче, наносят больше урона; опасные группы встречаются чаще.",
      "enemyHpMultiplier": 1.3,
      "enemyDamageMultiplier": 1.2,
      "epicGroupChance": 0.36,
      "minibossChunkChance": 0.12,
      "rareLootMultiplier": 1.25
    },
    "nightmare": {
      "id": "nightmare",
      "name": "Сложная",
      "description": "Самые стойкие и опасные враги, больше эпических групп и мини-боссов.",
      "enemyHpMultiplier": 1.6,
      "enemyDamageMultiplier": 1.4,
      "epicGroupChance": 0.46,
      "minibossChunkChance": 0.18,
      "rareLootMultiplier": 1.5
    }
  },
  "balance": {
    "maxRounds": 100,
    "maxTriggerDepth": 12,
    "maxEventsPerStep": 1000,
    "armorFactor": 1,
    "maxDamageReduction": 30,
    "healThreshold": 0.78,
    "partyScaling": {
      "1": {
        "hp": 1,
        "damage": 1
      },
      "2": {
        "hp": 1.65,
        "damage": 1.12
      },
      "3": {
        "hp": 2.2,
        "damage": 1.2
      },
      "4": {
        "hp": 2.7,
        "damage": 1.27
      }
    }
  }
}
```

## Equipped fixtures

| Fixture | Hero | Set | HP | Power |
| --- | --- | --- | ---: | ---: |
| solo-guardian-rare | guardian | relic-last-ration | 284 | 22 |
| solo-priest-rare | priest | relic-penitents-mile | 228 | 19 |
| solo-mage-rare | mage | relic-pearl-of-dreams | 222 | 15 |
| party-balanced-epic | guardian | relic-rain-swallowed-city | 310 | 13 |
| party-balanced-epic | priest | relic-open-palm | 256 | 12 |
| party-balanced-epic | mage | relic-sleeping-constellation | 251 | 22 |
| party-balanced-epic | ranger | relic-map-of-unborn-lands | 289 | 19 |

## Results by fixture and difficulty

| Group | Battles | Win rate (95% Wilson interval) | Mean rounds | Draws | Escapes | Errors |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hard:party-balanced-epic | 20 | 95.0% (76.4%–99.1%) | 6.5 | 0 | 0 | 0 |
| hard:solo-guardian-rare | 20 | 70.0% (48.1%–85.5%) | 8.3 | 0 | 0 | 0 |
| hard:solo-mage-rare | 20 | 55.0% (34.2%–74.2%) | 5.2 | 0 | 0 | 0 |
| hard:solo-priest-rare | 20 | 55.0% (34.2%–74.2%) | 5.7 | 0 | 1 | 0 |
| nightmare:party-balanced-epic | 20 | 95.0% (76.4%–99.1%) | 7.0 | 0 | 0 | 0 |
| nightmare:solo-guardian-rare | 20 | 75.0% (53.1%–88.8%) | 8.3 | 0 | 0 | 0 |
| nightmare:solo-mage-rare | 20 | 40.0% (21.9%–61.3%) | 5.3 | 0 | 0 | 0 |
| nightmare:solo-priest-rare | 20 | 50.0% (29.9%–70.1%) | 5.3 | 0 | 1 | 0 |
| normal:party-balanced-epic | 20 | 100.0% (83.9%–100.0%) | 4.7 | 0 | 0 | 0 |
| normal:solo-guardian-rare | 20 | 95.0% (76.4%–99.1%) | 6.3 | 0 | 0 | 0 |
| normal:solo-mage-rare | 20 | 65.0% (43.3%–81.9%) | 4.8 | 0 | 0 | 0 |
| normal:solo-priest-rare | 20 | 75.0% (53.1%–88.8%) | 5.8 | 0 | 0 | 0 |

## Tier and season overview

| Band | Definitions | Mean win rate |
| --- | ---: | ---: |
| mob:tier1 | 4 | 100.0% |
| mob:tier5 | 5 | 38.3% |
| mob:tier2 | 2 | 100.0% |
| mob:tier4 | 5 | 73.3% |
| mob:tier3 | 3 | 94.4% |
| boss:summer | 1 | 8.3% |

## mob:tier1: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_blackwater_spawn_3 — Донный студень | 100.0% | 1.3 | 0 | 0 |
| Hardest | act1_rot_court_1 — Прелый побег | 100.0% | 1.0 | 0 | 0 |
| Hardest | act1_thicket_pack_1 — Волчонок овражной стаи | 100.0% | 1.0 | 0 | 0 |
| Hardest | rat — Лесная крыса | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_rot_court_1 — Прелый побег | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_thicket_pack_1 — Волчонок овражной стаи | 100.0% | 1.0 | 0 | 0 |
| Easiest | rat — Лесная крыса | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_blackwater_spawn_3 — Донный студень | 100.0% | 1.3 | 0 | 0 |

## mob:tier5: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_dry_fang_23 — Секач медного хребта | 33.3% | 14.7 | 0 | 0 |
| Hardest | act1_flood_brood_23 — Старейшина донного панциря | 33.3% | 12.2 | 0 | 0 |
| Hardest | act1_white_fang_21 — Король белых клыков | 33.3% | 6.9 | 0 | 0 |
| Hardest | act1_charred_crypt_21 — Палач последнего костра | 41.7% | 9.3 | 0 | 0 |
| Hardest | act1_briar_court_21 — Палач тернового венца | 50.0% | 6.7 | 0 | 0 |
| Easiest | act1_briar_court_21 — Палач тернового венца | 50.0% | 6.7 | 0 | 0 |
| Easiest | act1_charred_crypt_21 — Палач последнего костра | 41.7% | 9.3 | 0 | 0 |
| Easiest | act1_white_fang_21 — Король белых клыков | 33.3% | 6.9 | 0 | 0 |
| Easiest | act1_flood_brood_23 — Старейшина донного панциря | 33.3% | 12.2 | 0 | 0 |
| Easiest | act1_dry_fang_23 — Секач медного хребта | 33.3% | 14.7 | 0 | 0 |

## mob:tier2: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_carrion_pack_8 — Секач прелой дубравы | 100.0% | 2.9 | 0 | 0 |
| Hardest | act1_ossuary_order_6 — Рубака погребальной описи | 100.0% | 1.9 | 0 | 0 |
| Easiest | act1_ossuary_order_6 — Рубака погребальной описи | 100.0% | 1.9 | 0 | 0 |
| Easiest | act1_carrion_pack_8 — Секач прелой дубравы | 100.0% | 2.9 | 0 | 0 |

## mob:tier4: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_frozen_vault_18 — Рыцарь хрустального покоя | 58.3% | 8.1 | 0 | 0 |
| Hardest | act1_saltwater_spawn_18 — Глыба ракушечного трона | 66.7% | 8.5 | 0 | 0 |
| Hardest | act1_ember_hive_16 — Копейщик багрового улья | 66.7% | 5.2 | 0 | 2 |
| Hardest | act1_reed_clan_18 — Хранитель цепной переправы | 83.3% | 9.7 | 0 | 0 |
| Hardest | act1_underice_brood_16 — Пожиратель ледовых опор | 91.7% | 4.4 | 0 | 0 |
| Easiest | act1_underice_brood_16 — Пожиратель ледовых опор | 91.7% | 4.4 | 0 | 0 |
| Easiest | act1_reed_clan_18 — Хранитель цепной переправы | 83.3% | 9.7 | 0 | 0 |
| Easiest | act1_ember_hive_16 — Копейщик багрового улья | 66.7% | 5.2 | 0 | 2 |
| Easiest | act1_saltwater_spawn_18 — Глыба ракушечного трона | 66.7% | 8.5 | 0 | 0 |
| Easiest | act1_frozen_vault_18 — Рыцарь хрустального покоя | 58.3% | 8.1 | 0 | 0 |

## mob:tier3: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_sun_scour_13 — Панцирник обожжённой стали | 91.7% | 7.3 | 0 | 0 |
| Hardest | act1_snow_grove_13 — Караульный белого кедра | 91.7% | 6.3 | 0 | 0 |
| Hardest | act1_rime_clan_11 — Рубака железного инея | 100.0% | 2.6 | 0 | 0 |
| Easiest | act1_rime_clan_11 — Рубака железного инея | 100.0% | 2.6 | 0 | 0 |
| Easiest | act1_snow_grove_13 — Караульный белого кедра | 91.7% | 6.3 | 0 | 0 |
| Easiest | act1_sun_scour_13 — Панцирник обожжённой стали | 91.7% | 7.3 | 0 | 0 |

## boss:summer: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | boss_copper_huntsman — Медный Ловчий | 8.3% | 10.9 | 0 | 0 |
| Easiest | boss_copper_huntsman — Медный Ловчий | 8.3% | 10.9 | 0 | 0 |

## Longest encounters

| Enemy | Mean rounds | P90 rounds | Win rate | Draws |
| --- | ---: | ---: | ---: | ---: |
| act1_dry_fang_23 | 14.7 | 21.8 | 33.3% | 0 |
| act1_flood_brood_23 | 12.2 | 20.8 | 33.3% | 0 |
| boss_copper_huntsman | 10.9 | 21.6 | 8.3% | 0 |
| act1_reed_clan_18 | 9.7 | 11.9 | 83.3% | 0 |
| act1_charred_crypt_21 | 9.3 | 18.6 | 41.7% | 0 |
| act1_saltwater_spawn_18 | 8.5 | 11.9 | 66.7% | 0 |
| act1_frozen_vault_18 | 8.1 | 10.9 | 58.3% | 0 |
| act1_sun_scour_13 | 7.3 | 11.0 | 91.7% | 0 |
| act1_white_fang_21 | 6.9 | 12.7 | 33.3% | 0 |
| act1_briar_court_21 | 6.7 | 10.7 | 50.0% | 0 |
| act1_snow_grove_13 | 6.3 | 9.8 | 91.7% | 0 |
| act1_ember_hive_16 | 5.2 | 6.9 | 66.7% | 0 |
| act1_underice_brood_16 | 4.4 | 6.0 | 91.7% | 0 |
| act1_carrion_pack_8 | 2.9 | 4.0 | 100.0% | 0 |
| act1_rime_clan_11 | 2.6 | 3.9 | 100.0% | 0 |
| act1_ossuary_order_6 | 1.9 | 2.9 | 100.0% | 0 |
| act1_blackwater_spawn_3 | 1.3 | 2.0 | 100.0% | 0 |
| act1_rot_court_1 | 1.0 | 1.0 | 100.0% | 0 |
| act1_thicket_pack_1 | 1.0 | 1.0 | 100.0% | 0 |
| rat | 1.0 | 1.0 | 100.0% | 0 |

Raw JSON contains every seed result, per-enemy/per-fixture/per-difficulty summaries, stage bands and the full frozen input snapshot.

Policy source unchanged during run: true. Engine source unchanged during run: true.
