# Isolated combat census

Captured 2026-09-23T22:47:07.391Z. Content checksum `edc887b4`.

33000/33000 battles; 550/550 enemy definitions; 189.0 seconds. Complete: true.

Outcomes: victory 31158, defeat 1822, draw 20, escaped 0, error 0.

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
      "enemyHpMultiplier": 1.2,
      "enemyDamageMultiplier": 1.08,
      "epicGroupChance": 0.26,
      "minibossChunkChance": 0.08,
      "rareLootMultiplier": 1
    },
    "hard": {
      "id": "hard",
      "name": "Нормальная",
      "description": "Враги крепче, наносят больше урона; опасные группы встречаются чаще.",
      "enemyHpMultiplier": 1.4,
      "enemyDamageMultiplier": 1.25,
      "epicGroupChance": 0.36,
      "minibossChunkChance": 0.12,
      "rareLootMultiplier": 1.25
    },
    "nightmare": {
      "id": "nightmare",
      "name": "Сложная",
      "description": "Самые стойкие и опасные враги, больше эпических групп и мини-боссов.",
      "enemyHpMultiplier": 1.55,
      "enemyDamageMultiplier": 1.29,
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
        "hp": 0.33,
        "damage": 0.5
      },
      "2": {
        "hp": 0.9,
        "damage": 0.94
      },
      "3": {
        "hp": 1.6,
        "damage": 1.18
      },
      "4": {
        "hp": 2.4,
        "damage": 1.48
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
| hard:party-balanced-epic | 2750 | 95.5% (94.6%–96.2%) | 5.4 | 0 | 0 | 0 |
| hard:solo-guardian-rare | 2750 | 96.8% (96.1%–97.4%) | 3.1 | 0 | 0 | 0 |
| hard:solo-mage-rare | 2750 | 88.0% (86.8%–89.2%) | 2.9 | 5 | 0 | 0 |
| hard:solo-priest-rare | 2750 | 95.9% (95.1%–96.6%) | 2.9 | 2 | 0 | 0 |
| nightmare:party-balanced-epic | 2750 | 94.9% (94.0%–95.6%) | 5.8 | 0 | 0 | 0 |
| nightmare:solo-guardian-rare | 2750 | 96.4% (95.6%–97.0%) | 3.3 | 1 | 0 | 0 |
| nightmare:solo-mage-rare | 2750 | 86.1% (84.7%–87.3%) | 3.1 | 5 | 0 | 0 |
| nightmare:solo-priest-rare | 2750 | 95.1% (94.3%–95.9%) | 3.1 | 1 | 0 | 0 |
| normal:party-balanced-epic | 2750 | 97.0% (96.3%–97.6%) | 4.9 | 0 | 0 | 0 |
| normal:solo-guardian-rare | 2750 | 97.8% (97.2%–98.3%) | 2.8 | 0 | 0 | 0 |
| normal:solo-mage-rare | 2750 | 92.3% (91.2%–93.2%) | 2.8 | 6 | 0 | 0 |
| normal:solo-priest-rare | 2750 | 97.3% (96.6%–97.9%) | 2.7 | 0 | 0 | 0 |

## Tier and season overview

| Band | Definitions | Mean win rate |
| --- | ---: | ---: |
| mob:tier1 | 105 | 100.0% |
| mob:tier2 | 104 | 100.0% |
| mob:tier3 | 100 | 100.0% |
| mob:tier4 | 96 | 99.5% |
| mob:tier5 | 95 | 92.8% |
| boss:autumn | 12 | 42.4% |
| boss:winter | 12 | 6.9% |
| boss:spring | 13 | 91.5% |
| boss:summer | 13 | 67.7% |

## mob:tier1: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_harvest_clan_5 — Крадущийся жнец | 100.0% | 1.1 | 0 | 0 |
| Hardest | act1_rot_court_3 — Гнилой пенёк | 100.0% | 1.1 | 0 | 0 |
| Hardest | goblin_scout — Гоблин-разведчик | 100.0% | 1.1 | 0 | 0 |
| Hardest | slime — Лесная слизь | 100.0% | 1.1 | 0 | 0 |
| Hardest | act1_cellar_nest_5 — Щелевой кусач | 100.0% | 1.1 | 0 | 0 |
| Easiest | act1_blackwater_spawn_1 — Чёрная пиявка | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_blackwater_spawn_2 — Туманный брызгун | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_blackwater_spawn_3 — Донный студень | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_blackwater_spawn_4 — Бледная личинка | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_blackwater_spawn_5 — Щипач опавших листьев | 100.0% | 1.0 | 0 | 0 |

## mob:tier2: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_sun_scour_8 — Страж медных ворот | 100.0% | 1.6 | 0 | 0 |
| Hardest | act1_briar_court_8 — Караульная коряга | 100.0% | 1.4 | 0 | 0 |
| Hardest | act1_frozen_vault_8 — Носитель ледяного надгробия | 100.0% | 1.4 | 0 | 0 |
| Hardest | thornling — Шиповик | 100.0% | 1.4 | 0 | 0 |
| Hardest | act1_dry_fang_8 — Секач соломенной равнины | 100.0% | 1.4 | 0 | 0 |
| Easiest | act1_ember_hive_6 — Паук горячей смолы | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_thicket_pack_6 — Волк сброшенной шерсти | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_thicket_pack_9 — Крапивный крысолов | 100.0% | 1.0 | 0 | 0 |
| Easiest | goblin_archer — Гоблин-лучник | 100.0% | 1.0 | 0 | 0 |
| Easiest | act1_charred_crypt_6 — Рубака сожжённого караула | 100.0% | 1.0 | 0 | 0 |

## mob:tier3: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_reed_clan_13 — Панцирник речного клана | 100.0% | 3.0 | 0 | 0 |
| Hardest | act1_snow_grove_13 — Караульный белого кедра | 100.0% | 3.0 | 0 | 0 |
| Hardest | act1_blackwater_spawn_13 — Страж утопленного дерева | 100.0% | 2.9 | 0 | 0 |
| Hardest | act1_briar_court_13 — Дубовый привратник | 100.0% | 2.8 | 0 | 0 |
| Hardest | act1_cellar_nest_13 — Кладочный панцирник | 100.0% | 2.7 | 0 | 0 |
| Easiest | act1_blackwater_spawn_11 — Глотатель траурных венков | 100.0% | 1.3 | 0 | 0 |
| Easiest | act1_briar_court_12 — Стручковый плевун | 100.0% | 1.3 | 0 | 0 |
| Easiest | act1_white_fang_11 — Вожак северной ложбины | 100.0% | 1.3 | 0 | 0 |
| Easiest | act1_ossuary_order_12 — Стрелок ребристой галереи | 100.0% | 1.3 | 0 | 0 |
| Easiest | act1_blackwater_spawn_14 — Матка донного тумана | 100.0% | 1.3 | 0 | 0 |

## mob:tier4: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_sun_scour_18 — Капитан медного заслона | 91.7% | 4.5 | 0 | 0 |
| Hardest | act1_ember_hive_18 — Страж жарового кокона | 95.0% | 4.5 | 1 | 0 |
| Hardest | act1_ossuary_order_20 — Душитель архивного свода | 95.0% | 3.0 | 0 | 0 |
| Hardest | act1_underice_brood_18 — Глыба подводного панциря | 96.7% | 5.3 | 0 | 0 |
| Hardest | act1_rot_court_18 — Бастион прогнивших корней | 96.7% | 4.7 | 0 | 0 |
| Easiest | act1_briar_court_17 — Стрелец багряного шипа | 100.0% | 2.2 | 0 | 0 |
| Easiest | act1_saltwater_spawn_16 — Пожиратель соляных лодок | 100.0% | 2.4 | 0 | 0 |
| Easiest | act1_white_fang_16 — Волк расколотого ледника | 100.0% | 2.4 | 0 | 0 |
| Easiest | act1_harvest_clan_16 — Палач зерновых долгов | 100.0% | 2.4 | 0 | 0 |
| Easiest | act1_carrion_pack_17 — Безухий костегрыз | 100.0% | 2.4 | 0 | 0 |

## mob:tier5: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | act1_snow_grove_23 — Князь белого безмолвия | 73.3% | 12.5 | 0 | 0 |
| Hardest | act1_dry_fang_24 — Бич забытых оазисов | 75.0% | 5.3 | 0 | 0 |
| Hardest | act1_white_fang_21 — Король белых клыков | 76.7% | 5.5 | 0 | 0 |
| Hardest | act1_white_fang_24 — Бич погасшего пастбища | 76.7% | 5.0 | 0 | 0 |
| Hardest | act1_ember_hive_23 — Панцирный патриарх углей | 78.3% | 14.1 | 0 | 0 |
| Easiest | act1_briar_court_22 — Сеятель игольчатого дождя | 100.0% | 4.2 | 0 | 0 |
| Easiest | act1_rot_court_22 — Глашатай спорной бури | 100.0% | 4.4 | 0 | 0 |
| Easiest | act1_sun_scour_24 — Верховный хранитель углей | 100.0% | 4.8 | 0 | 0 |
| Easiest | act1_saltwater_spawn_22 — Гейзер зелёной смерти | 100.0% | 4.9 | 0 | 0 |
| Easiest | act1_rime_clan_22 — Глашатай хрустального ливня | 100.0% | 4.9 | 0 | 0 |

## boss:autumn: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | boss_ossuary_archon — Архонт Оссуария | 1.7% | 15.7 | 0 | 0 |
| Hardest | boss_grave_boar — Могильный Секач | 3.3% | 13.7 | 0 | 0 |
| Hardest | boss_rust_marshal — Маршал Ржавых Знамён | 11.7% | 13.6 | 0 | 0 |
| Hardest | boss_ashen_pilgrim — Паломник Угасших Костров | 33.3% | 17.7 | 0 | 0 |
| Hardest | boss_carrion_king — Король Вороньего Пира | 43.3% | 14.6 | 0 | 0 |
| Easiest | boss_last_lantern — Последний Фонарщик | 75.0% | 13.1 | 0 | 0 |
| Easiest | boss_rot_gardener — Садовник Великой Гнили | 61.7% | 17.7 | 0 | 0 |
| Easiest | boss_harvest_reaper — Жнец Последнего Урожая | 60.0% | 15.3 | 0 | 0 |
| Easiest | boss_witch_of_falling_hours — Ведьма Падающих Часов | 58.3% | 12.3 | 0 | 0 |
| Easiest | boss_amber_widow — Янтарная Вдова | 56.7% | 16.0 | 0 | 0 |

## boss:winter: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | boss_iron_icebreaker — Железный Ледолом | 0.0% | 20.0 | 0 | 0 |
| Hardest | boss_frozen_executioner — Палач Замёрзших Клятв | 0.0% | 11.7 | 0 | 0 |
| Hardest | boss_polar_devourer — Пожиратель Полярной Ночи | 0.0% | 10.9 | 0 | 0 |
| Hardest | boss_grave_frost — Могильный Мороз | 1.7% | 20.9 | 0 | 0 |
| Hardest | boss_white_sovereign — Белый Государь | 3.3% | 16.9 | 0 | 0 |
| Easiest | boss_mother_white_web — Мать Белой Паутины | 25.0% | 27.4 | 0 | 0 |
| Easiest | boss_starved_aurora — Голодное Сияние | 21.7% | 13.9 | 0 | 0 |
| Easiest | boss_last_hour_keeper — Сторож Последнего Часа | 10.0% | 16.3 | 0 | 0 |
| Easiest | boss_black_snow_abbess — Игуменья Чёрного Снега | 10.0% | 19.4 | 0 | 0 |
| Easiest | boss_comet_wolf — Волк Упавшей Кометы | 5.0% | 12.5 | 0 | 0 |

## boss:spring: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | boss_moss_colossus — Мшистый Исполин | 63.3% | 13.8 | 1 | 0 |
| Hardest | boss_first_thunder — Рогач Первой Грозы | 81.7% | 6.9 | 0 | 0 |
| Hardest | boss_briar_king — Кряж, Дубовый король | 83.3% | 9.5 | 0 | 0 |
| Hardest | boss_reed_tyrant — Тростниковый Тиран | 90.0% | 8.0 | 1 | 0 |
| Hardest | boss_glass_seed — Стеклянное Семя | 91.7% | 8.5 | 0 | 0 |
| Easiest | boss_silver_huntress — Сребролунная Охотница | 100.0% | 5.4 | 0 | 0 |
| Easiest | boss_blind_florist — Слепая Цветочница | 100.0% | 6.4 | 0 | 0 |
| Easiest | boss_buried_bell — Погребённый Звонарь | 100.0% | 8.3 | 0 | 0 |
| Easiest | boss_plague_beekeeper — Пчельник Морового Мёда | 98.3% | 6.2 | 0 | 0 |
| Easiest | boss_torn_leaves — Герцог Рваных Листьев | 96.7% | 5.2 | 0 | 0 |

## boss:summer: strongest and weakest against these fixtures

| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |
| --- | --- | ---: | ---: | ---: | ---: |
| Hardest | boss_cinder_butcher — Мясник Пепельного Рынка | 25.0% | 14.5 | 0 | 0 |
| Hardest | boss_obsidian_ram — Обсидиановый Таран | 36.7% | 17.7 | 0 | 0 |
| Hardest | boss_noon_executioner — Полуденный Палач | 63.3% | 9.5 | 0 | 0 |
| Hardest | boss_dune_queen — Царица Сухих Дюн | 66.7% | 10.8 | 1 | 0 |
| Hardest | boss_scarlet_admiral — Алый Адмирал | 68.3% | 10.9 | 1 | 0 |
| Easiest | boss_storm_matriarch — Матриарх Летней Бури | 81.7% | 9.8 | 0 | 0 |
| Easiest | boss_locust_emperor — Император Саранчи | 80.0% | 12.0 | 0 | 0 |
| Easiest | boss_ember_phoenix — Феникс Неугасимой Золы | 78.3% | 9.9 | 0 | 0 |
| Easiest | boss_golden_hydra — Златозубая Гидра | 78.3% | 12.4 | 0 | 0 |
| Easiest | boss_mirage_sultan — Султан Пустых Миражей | 78.3% | 12.8 | 0 | 0 |

## Longest encounters

| Enemy | Mean rounds | P90 rounds | Win rate | Draws |
| --- | ---: | ---: | ---: | ---: |
| boss_mother_white_web | 27.4 | 58.0 | 25.0% | 0 |
| boss_hollow_duchess | 21.8 | 45.2 | 51.7% | 0 |
| boss_grave_frost | 20.9 | 39.4 | 1.7% | 0 |
| boss_iron_icebreaker | 20.0 | 42.1 | 0.0% | 0 |
| boss_black_snow_abbess | 19.4 | 39.2 | 10.0% | 0 |
| boss_obsidian_ram | 17.7 | 34.1 | 36.7% | 0 |
| boss_rot_gardener | 17.7 | 40.3 | 61.7% | 0 |
| boss_ashen_pilgrim | 17.7 | 38.2 | 33.3% | 0 |
| boss_white_sovereign | 16.9 | 30.3 | 3.3% | 0 |
| boss_heart_of_last_glacier | 16.9 | 33.0 | 3.3% | 0 |
| boss_last_hour_keeper | 16.3 | 29.1 | 10.0% | 0 |
| boss_amber_widow | 16.0 | 36.0 | 56.7% | 0 |
| boss_blood_granary | 16.0 | 33.3 | 51.7% | 0 |
| boss_ossuary_archon | 15.7 | 34.1 | 1.7% | 0 |
| act1_briar_court_23 | 15.3 | 25.1 | 80.0% | 0 |
| boss_harvest_reaper | 15.3 | 30.0 | 60.0% | 0 |
| boss_salt_prophet | 14.8 | 26.1 | 78.3% | 0 |
| boss_carrion_king | 14.6 | 29.1 | 43.3% | 0 |
| boss_cinder_butcher | 14.5 | 30.0 | 25.0% | 0 |
| act1_ember_hive_23 | 14.1 | 23.0 | 78.3% | 0 |

Raw JSON contains every seed result, per-enemy/per-fixture/per-difficulty summaries, stage bands and the full frozen input snapshot.

Policy source unchanged during run: true. Engine source unchanged during run: true.
