> Текущая боевая система: [справочник COMBAT](../reference/COMBAT.md) и [ADR 0018](../adr/0018-unified-attributes-anatomy-and-turn-portraits.md) задают восемь атрибутов, единую Силу, независимые проверки попадания/крита, локальные кубики защиты, пороги потери частей тела и очередь портретов. Вместе с ручными ходами из ADR 0012 они заменяют ранние описания автобоя, раздельных сил, крита и брони ниже. Остальные разделы сохраняют исходный проектный замысел, а не подтверждают готовность всех перечисленных систем. Удача пока реализована как API расчёта редкости; системный интерфейс её выдачи ещё не подключён.

# MASTER GAME DESIGN & TECHNICAL SPECIFICATION v1.0

## Cooperative Browser Pixel Roguelite RPG

> Паспорт проекта, GDD, техническое задание и roadmap. Source of truth
> для команды/coding-agent. Все числа баланса конфигурируемы и
> проверяются симуляциями/playtest.

# 0. Паспорт проекта

Платформа: Desktop + Mobile Browser. Игроки: 1--4. Жанр: session-based
cooperative pixel RPG / roguelite / auto-battler. Вид: 2D top-down pixel
art. Frontend: TypeScript + React + Phaser. Game Core:
framework-agnostic TypeScript. Backend: TypeScript (Node.js) + RSocket.
Network: Host-authoritative client; backend --- relay/coordinator. Run:
3 акта, ориентир 60--90 минут. Главная фишка: dice-based combat и
глубокие явные/скрытые item synergies.

## Цель и DoD

Создать законченную браузерную кооперативную игру с полноценной
поддержкой desktop и mobile browser, где группа исследует процедурные
акты под таймером, автоматически сражается с одиночными врагами и
стаями, получает персональные награды, спорит за одинаково выбранный
loot броском кубика, строит билд и после боссов выбирает необратимую
ветку Heaven/Hell. Готовая v1 позволяет 1--4 игрокам пройти полный Run,
пережить reconnect/host migration, получить корректный процедурный мир,
loot и Victory/Defeat без ручного вмешательства разработчика.

# 1. Design pillars

Cooperation без обязательного состава; Build Discovery; Dice вместо
скрытых процентов; Time Pressure; Risk/Reward; Replayability; Readable
Automation; Data Driven content.

# 2. Core loop

`LOBBY → CHARACTER → READY → RUN → EXPLORE → ENCOUNTER → AUTO COMBAT → COOP REWARD → EQUIP/BUILD → WINTER → BOSS ALTAR/TIMER → BOSS → HEAVEN/HELL → NEXT ACT → FINAL BOSS → VICTORY/DEFEAT`.

# 3. Lobby и Run

Lobby: lobbyId, leaderId, difficultyId, players\[1..4\],
selectedCharacters, readyStates. Один персонаж по умолчанию уникален.
Run: runId, seed, difficulty, hostId, players, currentAct,
branchHistory, currentChunkId, actTimer, worldState, encounterState,
playerStates, rewardState, rngStates, runSequence, status. Status:
GENERATING, EXPLORING, COMBAT, REWARD, BOSS, ACT_TRANSITION, VICTORY,
DEFEAT.

# 4. Сетевая архитектура

Backend НЕ Game Master. Host-клиент вычисляет world generation, gameplay
RNG/dice, movement/path validation, Encounter Director, enemy AI,
combat, effects, loot, equipment mutations, rewards, timer и boss logic.
Peer отправляет intents: MOVE_TO, INTERACT, EQUIP_ITEM, UNEQUIP_ITEM,
SELECT_REWARD, ACTIVATE_ALTAR, VOTE, CHANGE_SCROLL.

`PEER → intent → RSocket Server → relay → HOST → authoritative event/snapshot → Server → ALL PEERS`.

Backend: Lobby/Session registry, membership, RSocket routing, connection
lifecycle, reconnect, host migration coordination, protocol validation,
rate limits, optional snapshot persistence. Browser использует RSocket
поверх WebSocket. Envelope: protocolVersion, messageId, lobbyId, runId,
senderId, senderSequence, type, payload. Host events имеют runSequence.

Snapshot + Event Log: пропуск sequence вызывает resync. Snapshot
содержит timer, RNG streams, world/chunk, players, inventories,
entities, encounter, effects/cooldowns, POI, rewards, branch history.
Host migration детерминированно выбирает нового Host и продолжает с
последнего подтверждённого state. RNG streams: WORLD, COMBAT, LOOT,
ENCOUNTER, EVENT; visual RNG отделён. State hash используется для desync
detection. Читерство самого Host --- допустимый trade-off friends-coop.

# 5. Архитектура репозитория

`/apps/client`, `/apps/server`, `/packages/game-core`,
`/packages/game-data`, `/packages/protocol`, `/packages/shared`,
`/tools/balance-simulator`, `/tools/world-debugger`,
`/tools/item-generator`, `/tools/content-validator`, `/docs`. game-core
не зависит от React/Phaser/DOM/network.

# 6. Акты

Act I=Mortal World. После Boss I --- Heaven/Hell. Act II зависит от
ветки. После Boss II выбор повторяется. Act III: Heaven→Heaven=Empyrean;
Hell→Hell=Abyss; смешанные=Purgatory. Возврата назад нет.

# 7. Вертикальная структура миров и визуальная прогрессия

## 7.1 Act I --- Mortal World

Только первый акт использует времена года как четыре радиальные зоны:

``` text
CENTER
  ↓
SPRING
  ↓
SUMMER
  ↓
AUTUMN
  ↓
WINTER
  ↓
ACT I BOSS
```

Это путешествие от безопасного центра смертного мира к его
холодной/враждебной границе.

После Boss I группа выбирает направление:

-   **подняться в Heaven** через призрачную/небесную башню;
-   **спуститься в Hell** через пещеру, разлом или врата подземного
    мира.

Выбор необратим и задаёт направление оставшегося Run.

## 7.2 Act II --- Ascent / Descent

Во втором акте **нет Spring/Summer/Autumn/Winter**. Карта остаётся
радиальной и группа снова появляется около центра, но расстояние от
центра визуально означает вертикальное продвижение.

### Heaven route --- Ascension

Чем дальше группа идёт от центра, тем **выше она поднимается**.
Текстуры, фон, освещение, архитектура и окружение должны создавать
ощущение набора высоты.

Пример зон:

``` text
CENTER: Foothills of Heaven / Cloud Gate
        ↓
RING 1: Cloud Gardens
        ↓
RING 2: Golden Terraces
        ↓
RING 3: Celestial Bastions
        ↓
OUTER:  Gates of Heaven
        ↓
ACT II BOSS
```

Визуальная эволюция: земные скалы и туман → облака → висящие острова →
золотые мосты и храмы → ослепительная небесная цитадель. Чем дальше от
центра, тем меньше визуальной связи с землёй внизу.

### Hell route --- Descent

Чем дальше группа идёт от центра, тем **глубже она спускается**.

Пример зон:

``` text
CENTER: Broken Caverns / Infernal Gate
        ↓
RING 1: Ashen Depths
        ↓
RING 2: Blood Caves
        ↓
RING 3: Furnace Chasms
        ↓
OUTER:  Gates of Hell
        ↓
ACT II BOSS
```

Визуальная эволюция: пещеры → глубокие шахты/катакомбы → лава и кровавые
породы → огромные пропасти и цепи → монументальные врата Ада. Свет от
поверхности исчезает, пространство становится всё более подземным и
инфернальным.

## 7.3 Act III --- Heaven или Hell

Финальный акт больше не является дорогой между мирами. Игроки **уже
достигли конечного realm**.

Если путь Run ведёт вверх, Act III проходит непосредственно в
**Heaven**.

Пример радиальных зон:

``` text
CENTER: Outer Paradise
  ↓
Choirs / Sacred Gardens
  ↓
City of Light
  ↓
Throne District
  ↓
Heart of Heaven
  ↓
FINAL BOSS
```

Если путь ведёт вниз, Act III проходит непосредственно в **Hell**.

``` text
CENTER: Outer Hell
  ↓
Fields of Torment
  ↓
City of the Damned
  ↓
Infernal Palace
  ↓
Heart of Hell
  ↓
FINAL BOSS
```

Расстояние от центра всё ещё означает progression/depth, но теперь это
продвижение **вглубь самого конечного мира**, к его центру власти и
Final Boss.

## 7.4 Правило визуального языка

Радиальные кольца являются не буквальными высотами координаты Z, а
визуальной и gameplay-метафорой вертикального путешествия. При переходе
к следующему кольцу environment должен заметно подтверждать, что Party
поднялась выше или спустилась глубже.

Generator использует `ZoneTheme`, а не универсальный `Season`.

``` text
ActZone
├── realm
├── progressionIndex
├── theme
├── terrainPalette
├── obstaclePool
├── decorationPool
├── structurePool
├── enemyPool
├── poiPool
├── lootPool
└── environmentalEffects
```

Gameplay difficulty всё так же растёт от центра к внешнему кольцу.

------------------------------------------------------------------------

# 8. World generation

Карта круглая, spawn в центре. Радиальные кольца
Spring→Summer→Autumn→Winter. Pipeline: SEED→WorldGraph→biomes→blocked
edges→connectivity validation/repair→POI/encounters→local 35×35
chunks→local path validation. Tile: terrain, walkable, movementCost,
object, entity, interaction, hazard metadata. A\* только внутри текущего
chunk.

Blocked edges: mountains, lakes, rivers, cliffs, dense forest, canyon,
glacier, ruins, magical wall, abyss; невидимых стен нет. От центра до
Winter гарантировать минимум 3 существенно независимых
edge/vertex-disjoint маршрута; repair graph; property test минимум 10
000 seeds. Party всегда в одном currentChunk: любой игрок пересёк exit →
переносится ВСЯ группа, как комнаты Isaac.

# 9. Timer и Boss Altar

Действующие правила первого акта — [ADR 0025](../adr/0025-seasonal-bosses-and-altars.md).
Каждые 20 минут активного игрового времени на любой сложности призывается
один босс: весны, лета, осени, затем зимы. Кубик по сиду выбирает живого
героя, рядом с которым появляется босс; сражаются только находящиеся рядом.
В каждом сезоне один алтарь для досрочного призыва с подтверждением.
Алтарь вызывает босса рядом с нажавшим героем и начинает полный отсчёт
следующего сезона. Победа над всеми четырьмя боссами завершает поход.
В каталоге 50 боссов, по одному на сезон выбирается для конкретного сида.

# 10. POI

Normal/Hidden/Cursed Chest, Campfire, Healing Fountain, Shrine, Altar,
Merchant, Ancient Library, Grave, Ruins, Elite Encounter, Miniboss,
Random Event, Boss Altar. Использовать InterestScore, biome weights и
min/max density.

# 11. Персонажи

Каждый: Role Skill + Character Active + Character Passive + 2 Scroll
Skills. Tank Taunt: \~3 turns, CD\~6; при нескольких taunt приоритет у
tank с большим current HP. Vampire: active \~4 turns damage boost
CD\~10; passive Vampirism boost. Tags
VAMPIRISM/PHYSICAL/BLEED/HEAL/LOW_HEALTH. Guardian: active \~4 turns
усиливает passive (идея ×3), CD\~10; passive снижает damage союзникам
(\~25%). ARMOR/BLOCK/TAUNT/ALLY_PROTECTION/SHIELD. Paladin: self-heal
CD\~10; часть полученного healing распространяется союзникам (\~25%).
HEAL/OVERHEAL/HOLY/BLOCK. Healer Role: heal ally с минимальным
currentHP/maxHP, CD\~6. Priest: group heal CD\~10; healed allies
получают temporary damage buff. HEAL/BUFF/HOLY/CRITICAL_HEAL. Druid: HoT
\~4 ticks; passive dice check может не расходовать tick.
HOT/NATURE/REGENERATION/POISON. Necromancer: absorption shield \~4
turns; passive dice check может не уменьшить capacity.
SHIELD/ABSORB/DARK/DEATH/SUMMON. Damage Role: большой single-target dice
burst, CD\~6. Rogue: \~4 turns guaranteed crit, CD\~10; dice dodge.
CRITICAL/DODGE/BLEED/EXECUTE. Ranger: \~4 turns Repeat boost, CD\~10;
passive repeat attack; overflow rating→damage.
REPEAT/PROJECTILE/MULTIHIT. Mage: Burn \~4 turns, CD\~10; end-of-turn
burn scales Magic Power × remaining duration. FIRE/BURN/DOT/MAGIC.

# 12. Attributes, Dice, Combat

Primary: MAX_HEALTH, PHYSICAL_POWER, MAGICAL_POWER, ARMOR,
CRITICAL_RATING, CRITICAL_POWER, VAMPIRISM, EVASION, INITIATIVE.
Secondary: ACCURACY, BLOCK, HEALING_POWER, SHIELD_POWER,
elemental/status power/resistance, EFFECT_DURATION, COOLDOWN_MODIFIER,
REPEAT_ATTACK, ARMOR_PENETRATION. Dice: d4/d6/d8/d10/d12/d20,
NdX+modifier, opposed checks, advantage/disadvantage, reroll, duplicate
highest, exploding max, die upgrade/downgrade, natural 1/20 triggers.

Initiative=d20+modifier. Turn:
START→effects→AI→target→action→dice→damage/heal→triggers→deaths→end
effects→END. Events: TURN_STARTED, ATTACK_STARTED, DICE_ROLLED,
HIT/MISS/CRIT, DAMAGE, DODGED, BLOCKED, HEALED/OVERHEALED,
SHIELD_CREATED/BROKEN, STATUS_APPLIED, ENTITY_DIED. Effect =
trigger+conditions\[\]+actions\[\]+targetSelector+duration+stacks+internalCooldown+tags+priority.
AI declarative и deterministic.

# 13. Encounter Director и coop scaling

Ranks: SWARM, NORMAL, VETERAN, ELITE, CHAMPION, MINIBOSS, BOSS,
FINAL_BOSS. Roles: BRUTE, TANK, ASSASSIN, ARCHER, MAGE, HEALER, BUFFER,
DEBUFFER, SUMMONER, CONTROLLER, EXPLODER, SWARM. EncounterCost и
Budget=Act×Biome×Difficulty×PlayerCount×Danger. Поддержать solo, packs,
mixed groups. Стартовый scaling: 1P HP1.00 DMG1.00 Budget1.00; 2P
1.65/1.12/1.55; 3P 2.20/1.20/2.05; 4P 2.70/1.27/2.50. Главный рост ---
composition, не HP sponge. \# 13. Enemy content matrix Act I Spring:
Rat, Poison Rat, Young/Hungry Wolf, Wild Boar, Green/Forest Slime, Wild
Spider, Goblin Scout/Thief, Forest Sprite, Thornling. Summer: Goblin
Warrior/Archer/Shaman, Orc Scout/Berserker, Giant/Venom Spider,
Bandit/Archer, Tree Elemental, Fire Slime, Wasp Swarm. Autumn: Orc
Warrior/Shaman, Ogre, Dark Druid, Cursed Stag, Werewolf, Plague Wolf,
Cultist/Mage, Rotting Ent, Swamp Witch, Carrion Swarm. Winter: Ice Wolf,
Yeti, Frost Mage, Ice Golem, Cursed Knight, Northern Barbarian, Ice
Elemental, Necromancer, Frozen Dead, Frost Drake, Wraith, Snow Imp. Boss
I: Ancient Seasonal Warden / Frostbound King / Corrupted Worldheart.

Act II Heaven: Cherub, Luminous Hound, Garden Sentinel, Halo Sprite,
Winged Scout, Celestial Guard, Angel Archer, Choir Adept, Winged Lion,
Golden Construct, Inquisitor, Penitent, Broken Angel, Judgment Mage,
Living Armor, Seraph, Gatekeeper, Star Elemental, Angel of Vengeance,
Celestial Healer, Throne Construct. Boss: Judge of Dawn / Keeper of
Seventh Gate / False Sun.

Act II Hell: Imp, Fire Imp, Lesser Hellhound, Ash Crawler, Bone Rat,
Hellhound, Demon Brute/Archer, Succubus, Blood Mage, Tormentor, Bone
Demon, Soul Eater, Fallen Paladin, Hell Priest, Infernal Knight, Lava
Elemental, Demon Summoner, Greater Hellhound, Pit Fiend. Boss: Furnace
Tyrant / Mother of Chains / Lord of Blood Gate.

Act III Empyrean: Astral Knight, Solar Seraph, Choir of Blades,
Timebound Sentinel, Living Constellation, Radiant Judge, Phoenix Herald,
Archon Healer, Star Devourer. Purgatory: Ashen Angel, Penitent Demon,
Soul Ferryman, Mirror Knight, Grey Priest, Memory Eater, Duality
Elemental, Broken Saint, Chain Wraith. Abyss: Abyssal Larva, Void Hound,
Greater Succubus, Doom Knight, Abyss Mage, Flesh Colossus, Soul
Harvester, Archdemon, Void Worm, Infernal Oracle. Final bosses: First
Light / Arbiter Between Worlds / Heart of the Abyss.

Enemy schema: id, act/realm/biome, rank, role, tags, encounterCost,
baseStats, growth, skills, AI, resistances, lootTags. Encounter
templates ограничивают degenerate healer/summoner/control compositions.

# 15. Equipment model: инвентаря-сумки нет

В игре **нет классического inventory/backpack/stash во время Run**.
Игрок не накапливает найденные предметы «на потом».

Единственное долговременное состояние предметов внутри Run --- **текущая
экипировка персонажа**.

Когда игрок получает reward, для каждого предмета доступны только
логические варианты:

1.  выбрать предмет для примерки и сравнить с текущей экипировкой;
2.  подтвердить замену, если предмет подходит по слоту и правилам рук;
3.  отменить примерку либо оставить предмет для последующего выбора.

Примерка не изменяет экипировку или награды до подтверждения. После
подтверждения новый предмет надевается, а заменённый старый предмет
**уничтожается**: он не перемещается в сумку, в награды или на землю.
Не выбранные награды остаются доступными для последующей примерки и выбора.
Подтверждение одного предмета не удаляет остальные предложения. Поэтому не
реализовывать backpack, grid inventory, stash, inventory capacity,
drag-and-drop storage, sorting, vendor inventory selling flow или
управление запасом предметов.

Перед подтверждением замены UI обязан показывать сравнение
`CURRENT vs REWARD`: базовые характеристики, affixes, special effects,
изменение derived attributes и затрагиваемые synergy tags. Игрок должен
явно подтвердить замену.

`PlayerRunState` хранит `equipment`, а не `inventory`.

``` text
equipment
├── helmet
├── chest
├── gloves
├── belt
├── pants
├── boots
├── amulet
├── ring1
├── ring2
├── rightHand
├── leftHand
├── scroll1
└── scroll2
```

Обе руки — равноправные слоты. Одноручное оружие и щит можно надеть в
любую свободную руку. Двуручное оружие надевается в выбранную руку и
резервирует вторую; для этого вторая рука должна быть свободна. Предмет
хранится один раз, а поддерживающая рука не содержит отдельной вещи.

Тип оружия задаёт хват и анимации. Конкретный предмет имеет собственные
ID, название, характеристики и внешний вид, независимо от класса героя.
Комплект доспехов объединяет сочетающиеся вещи; стартовая экипировка героя
собирается из обычных предметов каталога. Декоративные книги, талисманы,
фокусы, семена и колчаны не занимают слоты рук и не входят в стартовые наборы.

## 14.1 Equipment/attributes UI

Игрок всегда имеет быстрый доступ к собственной текущей экипировке и
итоговым атрибутам. Это не отдельная «сумка», а Character/Equipment
panel.

Каждый экипированный предмет интерактивен: hover/focus открывает tooltip
с названием, rarity, item level, slot/base, dice/stat rolls, affixes,
special effect, tags и активными/потенциальными synergy hints.

## 14.2 HUD союзников

Слева располагается компактный частично прозрачный Party HUD. Для
каждого союзника он показывает минимум portrait, character/role, HP,
ключевые состояния и cooldown/status indicators.

При наведении на HUD союзника открывается расширенная read-only
карточка:

-   все его equipment slots;
-   текущие primary/derived attributes;
-   активные buffs/debuffs;
-   character/role skills и экипированные Scroll Skills;
-   основные synergy tags/effects.

На предмет в карточке союзника также можно навести курсор и прочитать
полный tooltip. Изменять чужую экипировку нельзя.

## 14.3 Reward flow без inventory

``` text
ENCOUNTER WON
   ↓
HOST GENERATES PARTY REWARD CANDIDATES
   ↓
PLAYERS SELECT DESIRED REWARD
   ↓
CONTESTED? → d20 ROLL / REROLL TIE
   ↓
WINNER SEES CURRENT-vs-REWARD COMPARISON
   ↓
EQUIP / DECLINE
   ↓
OLD ITEM DROPS AT REWARD/PICKUP LOCATION
   ↓
NO ITEM ENTERS A BACKPACK
```

Knowledge Scroll работает тем же образом: новый Scroll заменяет
`scroll1` или `scroll2` после подтверждения; старый Scroll выкладывается
в той же точке, где был получен новый, и может быть подобран другим
игроком.

------------------------------------------------------------------------

## 14.4 Замена экипировки и предметы на земле

При экипировке нового предмета текущий предмет соответствующего слота не
уничтожается.

Atomic operation:

``` text
NEW ITEM selected
      ↓
validate slot / ownership / reward result
      ↓
remove NEW ITEM from world/reward source
      ↓
equip NEW ITEM
      ↓
spawn OLD ITEM at the same pickup/reward location
      ↓
broadcast EQUIPMENT_CHANGED + WORLD_ITEM_SPAWNED
```

Выложенный предмет является обычным world item и может быть осмотрен и
подобран любым участником группы. Если другой игрок надевает его вместо
своего предмета, его прежний предмет аналогично оказывается на этой же
точке. Это позволяет группе естественно передавать экипировку без
отдельной сумки и trade-интерфейса.

Чтобы избежать duplication bugs, операция замены должна быть атомарной и
обрабатываться Host как одна authoritative transaction. Один
`ItemInstanceId` одновременно может существовать только в одном
состоянии: `EQUIPPED`, `WORLD`, `REWARD_PENDING` или
`DESTROYED/EXPIRED`.

При переходе в другой chunk правила жизни оставленных world items
задаются явно: по умолчанию они сохраняются в state текущего Act и
остаются на соответствующем chunk при возвращении, пока Act не завершён.
После необратимого перехода в следующий Act все оставленные предметы
предыдущего Act удаляются вместе с его ephemeral world state.

------------------------------------------------------------------------

# 16. Itemization --- центральная система

Слоты: Helmet, Chest, Gloves, Belt, Pants, Boots, Amulet, Ring×2, Main
Hand, optional Off Hand, Knowledge Scroll×2.

Требование: **\>500 валидных находок для каждого equipment slot**.
Комбинаторный generator:
`ItemInstance = Base + Material + Implicit + Prefixes + Suffixes + SpecialEffect + RolledDice + ItemLevel + Rarity`.
Target: 25--40 bases на слот × десятки compatible affix families =
тысячи экземпляров. Отдельно curated Unique/Legendary/Mythic catalogue.

Rarity: Common=base+implicit; Magic=1--2 affix; Rare=2--4;
Epic=3--5+minor special; Legendary=build-defining effect+affixes;
Mythic=rule-changing effect. Item level: Act I Spring 1--12, Summer
8--20, Autumn 15--28, Winter 23--36, Boss 32--42; Act II \~38--75; Act
III \~70--100. Диапазоны перекрываются. Affix families: Physical/Magic
Power, HP, Armor, Evasion, Crit Roll/Power, Vampirism, Initiative, added
dice, Fire/Cold/Poison/Bleed/Burn, penetration, Block/Shield,
Healing/Overheal, cooldown/effect duration, Repeat, Execute, dice
manipulation, role-skill и character-specific modifiers.

# 16. Item tags и синергии

Tags: FIRE, BURN, COLD, FREEZE, POISON, BLEED, DOT, CRITICAL, DODGE,
BLOCK, ARMOR, SHIELD, ABSORB, HEAL, OVERHEAL, HOT, VAMPIRISM,
LOW_HEALTH, FULL_HEALTH, REPEAT, MULTIHIT, PROJECTILE, SUMMON, DEATH,
KILL, TAUNT, HOLY, DARK, NATURE, DICE, INITIATIVE, COOLDOWN.

Три уровня: Explicit, Systemic, Emergent. Запрещены pair-specific
`if(itemA && itemB)` кроме named sets. Примеры: Ring of Ashes
(crit→Burn) + Arsonist Gloves (max Burn die→+d6) + Phoenix Heart
(overheal burning target→Fire Shield); Blood Chalice (overheal→temp max
HP) + Fang Belt (full-HP Vampirism heal→Blood Charge) + Crimson Crown
(charge→next crit); Mirror Boots (dodge→initiative) + Rogue passive +
Hourglass Ring (действие раньше врага→crit die); Bone Buckle (shield
broken→Bone) + Grave Amulet (Bone→healing) + Necromancer passive; Ranger
Repeat + Quiver of Echoes + Hunter Ring + Marked Prey Boots.

# 17. Base-item families для 500+ на слот

Helmet: hood, cap, coif, iron/plate/horned helm, circlet, ritual/bone
mask, hunter hood, frost helm, celestial crown, infernal visage, abyss
hood + materials. Chest: jerkin, chainmail, cuirass, brigandine, robes,
ritual vestment, bark armor, bone carapace, frost plate, celestial mail,
infernal plate, abyss mantle. Gloves: wraps, leather gloves, bracers,
gauntlets, ritual/claw gloves, archer guards, healer mitts,
frost/radiant gauntlets, infernal claws. Belt: rope, leather/war belt,
chain girdle, potion sash, bone belt, hunter harness, frost girdle,
celestial sash, infernal chain. Pants: cloth trousers, leather/chain
leggings, plate greaves, ritual skirt, hunter/bark/frost leggings,
celestial/infernal greaves. Boots: sandals, leather/plated/silent boots,
ritual sandals, hunter boots, frostwalkers, winged boots, infernal
treads, abyss steps. Amulet: fang, holy symbol, bone charm, druid seed,
blood vial, moon pendant, sun medallion, frozen tear, angel feather,
demon eye, void shard. Ring: iron band, signet,
blood/thorn/ash/frost/bone/halo/infernal ring, void loop, gambler/echo
ring. Weapons: sword/mace/shield; daggers; bows/crossbows;
staves/wands/orbs; scythes/tomes; vampire blades/claws. Каждый family
имеет 10--20 bases и realm materials. Materials Act I: wood, leather,
iron, steel, bone, amber, thornwood, silver, frostiron. Heaven: auric
steel, star silver, sunstone, cloudglass, angel feather. Hell: blood
iron, obsidian, demon bone, brimstone, soulglass. Act III: astral alloy,
greyglass, voidsteel, abyss bone, primordial crystal. \# 17. Curated
Legendary/Mythic examples Helmet: Crown of Last Breath (survival
lethal→next heal maximized), Ashen Visage (self Burn усиливает Fire
output), Watcher's Crown (natural 20 initiative→bonus action). Chest:
Guardian's Oath (часть ally damage перенаправляется), Bloodwoven Coat
(Vampirism overheal→shield), Phoenix Plate (первое падение/encounter
возвращает с Burn aura). Gloves: Arsonist Gloves; Dicewright Gauntlets
(reroll lowest damage die/turn); Executioner's Grips; Echo Gloves. Belt:
Fang Belt; Bone Buckle; Chronobelt; Packmaster Belt. Pants: Last Stand
Legguards; Pilgrim Leggings; Bloodrunner Leggings. Boots: Mirror Boots;
Marked Prey Boots; Froststep Boots; Winged Sandals. Amulet: Phoenix
Heart; Grave Amulet; Saint's Tear; Void Locket. Rings: Ring of Ashes;
Hourglass Ring; Hunter Ring; Crimson Crown Ring; Gambler's Loop; Twin
Moon Ring. Weapons: Bloodfang(Vampire), Bastion(Guardian), Dawn
Mace(Paladin), Canticle Staff(Priest), Worldroot Staff(Druid), Ossuary
Tome(Necromancer), Nightglass Daggers(Rogue), Echo Bow(Ranger),
Cinderstaff(Mage). У каждого 2--4 build paths через tags, а не
единственная правильная комбинация.

# 19. Loot pools по актам/биомам

Spring: common/magic, base stats, простые tag seeds. Summer: rare чаще,
первые двухкомпонентные synergy affixes. Autumn: Epic chance, status
engines и role modifiers. Winter: сильные synergy pieces, Legendary
chance, boss-preparation loot. Boss chest: guaranteed high-tier choices
и branch-flavoured item. Heaven добавляет
HOLY/SHIELD/HEAL/INITIATIVE/ORDER; Hell ---
BURN/BLEED/VAMPIRISM/LOW_HEALTH/SUMMON/RISK. Act III --- conversions,
rule-changing affixes, Mythic chance.

Loot algorithm: source tier→item level→rarity с
anti-streak/pity→slot/base→material→compatible affixes→roll
values/dice→special effect→power-budget validation→immutable
ItemInstance. Affix budget запрещает одновременно лучший
offense/defense/utility. Unique ценится механикой, не обязательно raw
stats.

# 20. Cooperative reward draft

После reward-bearing encounter Host создаёт **по одному reward candidate
на каждого участника**. Все candidates общие: любой игрок выбирает
любой. Один претендент→получает. Несколько→публичный d20 каждому;
максимум выигрывает; tie→reroll tied players. Не выбранные rewards
исчезают или salvage по config. Есть timeout/auto-pass для disconnected
player.

# 21. Knowledge Scrolls

Два слота дополнительных active skills. Scroll имеет rarity, tags,
cooldown, dice expression, AI rules. Примеры: Chain Lightning, Battle
Cry, Ice Barrier, Poison Cloud, Second Wind, Mark Prey, Cleanse, Blood
Pact, Meteor Shard, Thorn Armor, Soul Link, Haste, Weakening Curse,
Group Barrier, Execute. Character/Role-skill modifiers не усиливают
Scroll, если явно не разрешено.

# 22. Boss design

Boss не HP sponge. 2--4 phases/escalating mechanics, telegraphed
abilities, target rules, add waves/arena effects, enrage/soft-enrage.
Act I проверяет базовый build; Act II --- synergy/team composition;
Final --- устойчивость engine. Не должно быть unavoidable party wipe.

# 23. Death/Defeat/Recovery

Рекомендуемая v1: HP≤0→Downed до конца encounter; некоторые skills/items
revive; после победы персонаж возвращается с ограниченным HP. Party
wipe=Defeat Run. Campfire/Fountain ограничены, бесконечного reset-heal
нет.

# 24. Difficulty

DifficultyConfig меняет timer, encounter budget, stat curves, elite
weights, recovery generosity, boss mechanics, loot compensation. Не
только HP multiplier. Profiles: Normal/Hard/Nightmare.

# 25. UI/UX

Lobby; Character Select; Main HUD; minimap/ring indicator; Act Timer;
party frames; chunk; prompts; combat timeline; dice log; equipment
panel; compare tooltip; synergy tags/highlights; reward draft; boss
vote; branch choice; settings; reconnect/migration overlay;
Victory/Defeat summary. Tooltip: base, dice, affixes, tags, affected
skills, trigger/condition/action. Сравнение показывает deltas, но не
объявляет item «лучше».

# 26. Presentation

Top-down tile scene, readable silhouettes, biome palettes, простые
combat animations/projectiles/impact, floating dice/damage/heal.
Animation cosmetic и не блокирует simulation. Gameplay ids отделены от
assets.

# 27. Data schemas

CharacterDefinition, SkillDefinition, EffectDefinition, EnemyDefinition,
EncounterTemplate, ItemBaseDefinition, AffixDefinition,
UniqueItemDefinition, MaterialDefinition, LootTableDefinition,
BiomeDefinition, ActDefinition, DifficultyDefinition, PoiDefinition. Все
имеют schemaVersion и проходят content-validator.

# 28. Persistence

Backend хранит account/profile/settings/unlocks при наличии,
lobby/session metadata и optional latest snapshot. Run state остаётся
Host-authoritative. Snapshot versioning обязателен. Permanent profile и
ephemeral run equipment/state разделены.

# 29. Observability/debug

Structured logs: runId/lobbyId/playerId/messageId/sequence. Host debug
overlay: seed, chunk coords, RNG counters, entity ids, path graph,
encounter budget, active effects. World debugger показывает
graph/biomes/blocked edges/3 paths/POI. Balance simulator запускает
тысячи боёв без UI. Item generator выводит distributions
slot/act/rarity/tags.

# 30. Testing

Unit: dice, damage, armor, crit, effects, cooldown, affix compatibility,
AI, reward contests. Property: deterministic seed, 3-path guarantee,
reachable altar, valid item, event ordering. Simulation: тысячи
encounters на compositions/item tiers. Network:
drop/duplicate/out-of-order, reconnect, resync, Host migration. E2E:
1P/4P full Run smoke. Performance: large packs, chunk transition,
inventory.

# 31. Performance/accessibility

Цель 60 FPS presentation; simulation независима от FPS. Neighbor chunk
pre-generation допустима. Event batching сохраняет sequence. Settings:
volume, reduced motion, screen shake, damage-number density, UI scale,
colorblind-friendly status icons, shortcuts, localization-ready strings.

# 32. Баланс

Все параметры в game-data. Метрики: encounter duration, incoming
damage/turn, healing efficiency, item replacement rate, deaths, biome
reach time, boss success, early altar usage, reward contest frequency,
tag/synergy pick rate. Цель --- множество конкурентоспособных engines,
не математически равные items.

# 33. Anti-patterns

Запрещено: gameplay logic в Phaser/React; Math.random в game-core;
hardcoded item-pair synergy; backend как второй Game Master;
HP×players-only scaling; 500 вручную клонированных items; invisible
walls; map без connectivity validation; Peer отправляет готовый
damage/loot; animation определяет simulation timing; balance constants в
коде.

# 34. План реализации

Phase 0 Foundations: monorepo, CI, protocol, game-core, deterministic
RNG, schemas, validator. Phase 1 Vertical Combat: 3 временных
characters, dice/effects/AI, 10 enemies, autobattle UI, simulator. Phase
2 Multiplayer: Lobby, RSocket relay, intents/events, snapshot/resync,
2--4 clients, Host migration. Phase 3 World: graph, biome rings, chunks,
A\*, blocked edges, 3-path validation, party transition, POI. Phase 4
Characters: все 9, role skills/passives, Scroll framework. Phase 5
Itemization: slots, bases/materials/affixes, \>500 valid
combinations/slot, tags, synergy engine, equipment/tooltips. Phase 6
Loot/Rewards: loot tables, ilvl bands, cooperative draft, contested d20.
Phase 7 Content Act I: полный enemy pool, encounters, POI, Boss I,
art/audio baseline. Phase 8 Acts II/III:
Heaven/Hell/Purgatory/Empyrean/Abyss, bosses, realm loot. Phase 9
Polish: balance simulation, UX, accessibility, optimization, reconnect
edge cases, telemetry. Phase 10 Release: regression, load/E2E, content
freeze, deployment, rollback plan.

# 35. Acceptance criteria по системам

Network: Peer не меняет canonical state; reconnect восстанавливает Run;
Host migration не теряет подтверждённый loot/encounter state. World: 10k
seeds без недостижимого Winter/Boss Altar; ≥3 маршрута; нет exit в
визуально закрытую границу. Combat: deterministic при одинаковом
state/RNG; effect ordering documented; нет бесконечных trigger loops
(depth/loop guard). Items: generator доказывает \>500 valid instances
для каждого slot в каждом полном content build; invalid affix
conflicts=0; каждый Legendary имеет минимум 2 потенциальные synergy
families. Rewards: candidate/player; contested roll корректен; tie
reroll; duplicate claim невозможен. Timer: Host authoritative; drift
корректируется; 0 запускает Boss после текущего encounter. Performance:
full Run без memory leak; combat packs не блокируют UI.

# 36. Coding-agent execution rules

1.  Сначала прочитать весь документ и создать ADR/implementation
    checklist.
2.  Не менять фундаментальные product rules без отдельного decision
    record.
3.  Сначала interfaces/data schemas/tests, затем implementation.
4.  Любая новая gameplay mechanic должна быть data-driven, deterministic
    и serializable.
5.  Любой state, необходимый для Host migration, обязан входить в
    Snapshot.
6.  Любая RNG операция использует именованный gameplay stream.
7.  Любой network mutation начинается как Intent и заканчивается Host
    Event.
8.  Любой новый item effect реализуется через Effect Engine primitives;
    если primitive отсутствует --- добавить общий primitive, а не
    item-specific branch.
9.  Каждая procedural generation change прогоняет property tests.
10. Каждая balance change сопровождается simulator report.

# 37. Первый production backlog

P0: repository/CI; protocol versioning; RNG; dice parser; immutable
state model; effect engine; event bus; snapshot serializer; RSocket
lobby/relay; basic Phaser map; React HUD. P1: combat AI; 9 characters;
world graph/chunks/A\*; party transition; timer; altar/vote; Encounter
Director; reward draft; equipment screen/HUD; item generator. P2: full
Act I content; Heaven/Hell; Act III branches; bosses; unique items;
Scrolls; merchants/events; audio/VFX; accessibility. P3: balancing,
telemetry, optimization, host migration hardening, release pipeline.

# 38. Финальная продуктовая формула

Игра должна создавать не ощущение «нашёл меч на +12 вместо +9», а
цепочку решений: **куда идти под таймером → какой риск принять → какую
группу врагов пережить → за какую награду спорить → какую механику
добавить в билд → какую скрытую синергию открыть → когда остановить
исследование и вызвать босса → какую необратимую ветку выбрать**.

Если техническая реализация противоречит этой формуле, предпочтение
отдаётся формуле, если только изменение не оформлено как осознанное
product decision.

------------------------------------------------------------------------

# Appendix A --- обязательные конфигурационные группы

`balance/characters`, `balance/skills`, `balance/difficulty`,
`world/acts`, `world/biomes`, `world/poi`, `enemies/definitions`,
`enemies/encounters`, `items/bases`, `items/materials`, `items/affixes`,
`items/uniques`, `loot/tables`, `scrolls/skills`, `bosses/definitions`.

# Appendix B --- обязательные инструменты разработчика

Seed replay; world graph visualizer; chunk inspector; combat replay;
dice/event log; item sandbox; affix compatibility checker; synergy graph
viewer; encounter simulator; party composition simulator; snapshot diff;
network sequence inspector.

# Appendix C --- контентный KPI v1

9 playable characters; 3 acts with branch variants; 4 seasonal biome
layers per act; ≥500 valid generated items per equipment slot; curated
Legendary/Mythic library; ≥15--20 enemy archetypes per major realm with
biome variants; solo and pack encounter templates; multiple bosses per
development pool with one selected/assigned per route; ≥15 Scroll
Skills; ≥12 POI/event types; complete 1--4 player scaling.

# Mobile browser requirements

Mobile Browser является first-class target наравне с Desktop Browser.

Требования: - responsive layout для portrait и landscape; - touch input
без обязательного hover; - tap по персонажу/предмету открывает тот же
detail panel, который desktop показывает по hover; - повторный
tap/кнопка закрытия закрывает panel; - tap по клетке задаёт
destination; - camera pan/zoom поддерживает touch gestures там, где это
не конфликтует с movement; - интерактивные элементы имеют touch-friendly
hit areas; - Party HUD на малом экране может сворачиваться, но HP/status
группы должны оставаться видимыми; - Equipment/Reward comparison должен
помещаться на мобильном экране через bottom sheet/full-screen panel; -
никакая обязательная gameplay-функция не должна требовать mouse hover,
right click или физическую клавиатуру; - Phaser canvas масштабируется
под viewport и devicePixelRatio с контролем производительности; -
предусмотреть quality/performance presets для слабых мобильных
устройств; - reconnect при background/foreground переходах мобильного
браузера является обязательным сценарием тестирования.
