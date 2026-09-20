# Phase 1 authored content

The temporary roster contains three heroes (Страж, Жрица, Маг), ten Act I enemy archetypes, and five fixed encounters. Display copy is Russian; stable identifiers, sprite keys, and tags are English. The Дозорный чащи is an elite enemy, not an implemented act boss. Seasons are represented only by Act I encounter labels; there is no world generation yet.

`src/index.ts` exports `gameContent` and each collection. There is no engine dependency. Unit stats, basic attacks, skill priority/cooldowns, passive effects, statuses, and combat balance values are authored data. Add a skill or status using existing action primitives before introducing a new engine mechanic.

Hero skills have a role ability and a character ability. Guardian protection is a permanent unit modifier (25% reduction for other allies), with a four-turn active bonus of 50 percentage points. Priest's `HEALED` passive blesses the actual healed recipient. Mage's critical-hit passive applies two-turn burning; the active applies four-turn burning. Burning deals `power × 0.3 × remaining duration` at the afflicted unit's turn end and uses the original caster's power.

## Initial balance

Enemy stats use a one-player baseline. The specification's starting scaling table is preserved directly in `src/balance.ts`: HP multipliers 1 / 1.65 / 2.20 / 2.70 and damage multipliers 1 / 1.12 / 1.20 / 1.27 for parties of 1–4. Only 1–3 distinct heroes are playable in this milestone. Encounter composition budgets and progression equipment are later work.

The first smoke simulation showed excessive reliance on Mage damage: the support pair barely cleared the goblin encounter, while the full party won only 10% of elite fights across ten seeds. Increasing Guardian's basic power coefficient from 0.7 to 1.1 and Priest's from 0.6 to 1.0 improved basic attacks between cooldowns without changing their role abilities or weakening enemy identities.

A representative run of 3,500 battles (100 seeds with prefix `balance-v1`, every encounter and all seven nonempty party compositions) produced:

| Encounter | Full party win rate | Guardian + Priest win rate | Full party mean rounds |
| --- | ---: | ---: | ---: |
| Мшистая тропа | 100% | 100% | 4.5 |
| Волчья лощина | 100% | 100% | 5.7 |
| Засада у ручья | 100% | 79% | 8.0 |
| Колючие заросли | 100% | 0% | 12.8 |
| Роща дозорного | 53% | 0% | 18.5 |

The introductory encounter is solo-friendly (99–100% wins). Later fixed packs remain difficult or impossible for some small compositions without equipment or progression; these are development encounters, not a completed solo/co-op balance claim. Five battles ended in simultaneous elimination from end-of-turn damage; no battle reached the round cap. The root simulator generates the canonical report in `docs/reports/balance.json`.

Run `npm run validate` after editing content and `npm run simulate -- --runs 100` to regenerate balance evidence. Finite stats, schema versions, identifiers/references, action payloads, durations, dice expressions, selectors, and safe modifiers are validated independently of the combat engine.
