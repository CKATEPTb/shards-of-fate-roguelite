import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BODY_PARTS, isRingSlot, type EquipmentItemDefinition, type EquipmentSetBonusDefinition, type EquipmentSetDefinition, type EquipmentSlot, type Modifiers, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { activeEquipmentSetBonuses, bodyPartArmor, confirmEquipmentChoice, previewEquipmentChoice, startHeroBody, type EquipmentChoiceSelection, type EquipmentReward } from '@shards/game-core';
import { applyEquipmentToHero, CATALOG_EQUIPMENT_ITEMS, CATALOG_EQUIPMENT_SETS, EQUIPMENT_ITEMS, EQUIPMENT_SETS, gameContent } from '@shards/game-data';
import { HERO_VISUAL_SLOTS, type HeroVisualLoadout } from '../art/heroLoadout';
import { equipmentMaterial } from '../art/heroPartEquipment';
import { unitFramePixels } from '../art/unitFrames';
import { UNIT_CLIPS, type UnitFacing, type UnitMotion } from '../art/unitPose';
import { HERO_WEAPONS } from '../art/heroWeapons';
import { CatalogAuraIcon } from '../components/CatalogAuraIcon';
import { EquipmentRarityBadge, EQUIPMENT_RARITY_NAMES as rarityNames } from '../components/EquipmentRarity';
import './equipmentCatalogPreview.css';

const materialNames = { cloth: 'Ткань', leather: 'Кожа', mail: 'Кольчуга', plate: 'Латы', bone: 'Кость' };
const slotNames: Record<EquipmentSlot, string> = { head: 'Голова', chest: 'Тело', gloves: 'Перчатки', pants: 'Штаны', boots: 'Сапоги', amulet: 'Амулет', ring1: 'Кольцо I', ring2: 'Кольцо II', rightHand: 'Правая рука', leftHand: 'Левая рука' };
const bodyNames = { head: 'Голова', torso: 'Тело', leftArm: 'Левая рука', rightArm: 'Правая рука', leftLeg: 'Левая нога', rightLeg: 'Правая нога' };
const facingNames: Array<[UnitFacing, string]> = [['south', 'Лицом'], ['east', 'Вправо'], ['north', 'Со спины'], ['west', 'Влево']];
const motionNames: Array<[UnitMotion, string]> = [['idle', 'Стойка'], ['walk', 'Ходьба'], ['attack', 'Атака'], ['cast', 'Заклинание'], ['dodge', 'Уклонение'], ['block', 'Блок оружием'], ['shieldBlock', 'Блок щитом']];
const numericStats = [
  ['power', 'Сила', 'powerBonus'], ['initiative', 'Инициатива', 'initiativeBonus'], ['accuracy', 'Точность', 'accuracyBonus'], ['evasion', 'Уклонение', 'evasionBonus'],
  ['crit', 'Критический удар', 'critBonus'], ['resilience', 'Стойкость', 'resilienceBonus'], ['agility', 'Проворность', 'agilityBonus'], ['luck', 'Удача', 'luckBonus'],
] as const;
const PAGE_SIZE = 24;
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`;
const isHand = (slot: string) => slot === 'rightHand' || slot === 'leftHand';
const initialOutfits = () => Object.fromEntries(gameContent.characters.map(hero => [hero.id, structuredClone(hero.anatomy?.equipment ?? [])]));
const loadoutFor = (items: readonly StarterEquipment[]): HeroVisualLoadout => Object.fromEntries(HERO_VISUAL_SLOTS.map(slot => [slot, items.find(item => item.slot === slot)?.id ?? null]));

function EquipmentGlyph({ item, set, size = 40 }: { item?: Pick<EquipmentItemDefinition, 'slot' | 'weapon' | 'appearanceId' | 'rarity'> | StarterEquipment; set?: EquipmentSetDefinition; size?: number }) {
  const palette = set?.visual?.palette ?? equipmentMaterial(item?.appearanceId);
  const kind = item?.weapon?.kind ?? item?.slot ?? 'chest';
  const shapes: Record<string, ReactNode> = {
    head: <><path d="M8 24V12a8 8 0 0 1 16 0v12l-5-3h-6Z" /><path d="M8 14h16M16 5v15M10 18h3m6 0h3" /></>,
    chest: <><path d="m10 5 6 3 6-3 6 6-5 5v11H9V16l-5-5Z" /><path d="m12 8 1 8 3 3 3-3 1-8M9 23h14" /></>,
    gloves: <><path d="m10 28-5-12 3-2 3 5V7h3v9-12h3v12-10h3v11-8h3v15l-4 4Z" /><path d="M9 24h12" /></>,
    pants: <><path d="M9 4h14l2 24h-8l-1-14-1 14H7Z" /><path d="M9 9h14M16 4v7M8 24h6m4 0h6" /></>,
    boots: <><path d="M5 5h8v13l5 5v5H3v-7l2-3ZM20 5h8v13l3 5v5H20v-7" /><path d="M5 10h8m7 0h8M3 25h14m4 0h10" /></>,
    amulet: <><path d="M6 3c0 10 4 15 10 16 6-1 10-6 10-16" /><path d="m16 14 7 8-7 8-7-8Zm0 5 3 3-3 4-3-4Z" /></>,
    ring1: <><circle cx="16" cy="21" r="9" /><path d="m16 2 6 6-6 7-6-7ZM12 20a5 5 0 0 0 5 6" /></>,
    ring2: <><circle cx="16" cy="21" r="9" /><path d="m10 5 6-3 6 3-2 8h-8ZM14 6h4" /></>,
    bow: <><path d="M7 3c24 7 24 19 0 26l7-13ZM4 16h26m-5-4 5 4-5 4" /><path d="m9 13 4 3-4 3" /></>,
    shield: <><path d="m16 3 12 5-2 15-10 7L6 23 4 8Z" /><path d="m16 8 7 3-2 10-5 4-5-4-2-10ZM16 10v12m-5-6h10" /></>,
    staff: <><path d="M16 30V12M10 4l6-2 6 2v6l-6 4-6-4Zm6 0 3 3-3 4-3-4Z" /><path d="M13 21h6m-6 5h6" /></>,
    wand: <><path d="m9 29 10-19m0-8 7 5-7 8-6-7ZM5 6h5M8 3v6m19 8h4m-2-2v4" /></>,
    dagger: <><path d="m9 28 5-9M9 17l9 5M12 17 22 3l-1 16-6 2Z" /><path d="m16 17 6-14" /></>,
    sword: <><path d="m7 29 6-9M7 17l12 8M11 18 23 2l1 9-8 12Z" /><path d="m15 18 8-14" /></>,
    greatsword: <><path d="m5 30 7-10M6 16l14 9M10 18 25 1l1 11-11 12Z" /><path d="m14 18 10-14" /></>,
    mace: <><path d="m8 29 9-16m-1-3-5-5 6-4 8 4 3 8-6 4-5-4ZM17 4l3 10m-5-7 10 3" /></>,
    greatmace: <><path d="m6 31 12-18m-2-2L9 6l7-5 11 4 4 9-8 5-5-5ZM16 4l6 12m-9-9 14 3" /></>,
    hammer: <><path d="m8 29 10-17M10 4l5-3 14 9-5 7-15-8Zm4-1 10 12" /></>,
    greathammer: <><path d="m5 31 13-19M9 4l6-3 16 10-6 9L7 10Zm4 0 12 13" /></>,
    sickle: <><path d="M10 29 14 13m-2-7c8-9 19 2 10 12 3-9-3-12-10-12ZM8 23l6 2" /></>,
    scythe: <><path d="M11 31V6M7 7C14-2 29 3 30 20 24 9 16 9 11 11M8 22h6m-6 5h6" /></>,
  };
  return <svg className="equipment-glyph" data-equipment-rarity={item ? item.rarity ?? 'common' : undefined} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" style={{ '--glyph-metal': palette.metal, '--glyph-edge': palette.edge, '--glyph-dark': palette.dark, '--glyph-trim': palette.trim } as CSSProperties}>
    <rect x="1" y="1" width="34" height="34" rx="8" fill={palette.dark} />
    <g transform="translate(2 2)" stroke={palette.edge} fill={palette.cloth} strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round">{shapes[kind] ?? shapes.chest}</g>
    <circle cx="29" cy="29" r="2" fill={palette.trim} />
  </svg>;
}

/** Render only the selected actor; frame caches never grow with the catalogue. */
function HeroCanvas({ hero, equipment, facing, motion = 'idle', playing = false, className = '' }: { hero: UnitDefinition; equipment: HeroVisualLoadout; facing: UnitFacing; motion?: UnitMotion; playing?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current, context = target?.getContext('2d');
    if (!target || !context) return;
    const clips: UnitMotion[] = motion === 'attack' ? (['rightHand', 'leftHand'] as const).flatMap(slot => {
      const item = EQUIPMENT_ITEMS[equipment[slot] ?? ''];
      return item?.weapon && item.weapon.kind !== 'shield' ? [slot === 'rightHand' ? 'attack' : 'attackLeft'] as UnitMotion[] : [];
    }) : [motion];
    if (!clips.length) clips.push('attack');
    const clip = UNIT_CLIPS[motion], count = clip.frames * clips.length;
    let request = 0, previousFrame = -1, elapsed = 0, previousTime = performance.now();
    const cache = new Map<string, ReturnType<typeof unitFramePixels>>();
    const render = (now: number) => {
      if (playing && !document.hidden) elapsed += Math.min(100, now - previousTime);
      previousTime = now;
      const cycle = count / clip.frameRate * 1000 + (clip.repeat === 0 ? 350 : 0);
      const frame = playing ? Math.min(count - 1, Math.floor((elapsed % cycle) * clip.frameRate / 1000)) : 0;
      if (frame !== previousFrame) {
        previousFrame = frame;
        const currentMotion = clips[Math.min(clips.length - 1, Math.floor(frame / clip.frames))], currentFrame = frame % clip.frames;
        const key = `${currentMotion}:${currentFrame}`;
        let pixels = cache.get(key);
        if (!pixels) { pixels = unitFramePixels(hero.sprite, hero.role, false, facing, currentMotion, currentFrame, undefined, equipment); cache.set(key, pixels); }
        context.clearRect(0, 0, 64, 64);
        for (const pixel of pixels) { context.fillStyle = pixel.color; context.fillRect(pixel.x, pixel.y, 1, 1); }
      }
      if (playing) request = requestAnimationFrame(render);
    };
    render(previousTime);
    return () => { cancelAnimationFrame(request); cache.clear(); };
  }, [hero, equipment, facing, motion, playing]);
  return <canvas ref={canvas} width="64" height="64" className={`equipment-hero-canvas ${className}`} role="img" aria-label={`${hero.name}, ${facingNames.find(([value]) => value === facing)?.[1].toLowerCase()}`} />;
}

function sheet(definition: UnitDefinition) {
  const body = startHeroBody(definition), sets = activeEquipmentSetBonuses(definition, body);
  const modifiers: Array<Modifiers | undefined> = [definition.modifiers, ...sets.flatMap(set => set.bonuses.flatMap(bonus => [bonus.modifiers, bonus.aura?.modifiers]))];
  const armorBonus = modifiers.reduce((total, modifier) => total + (modifier?.armorBonus ?? 0), 0);
  return { body, sets, attributes: Object.fromEntries(numericStats.map(([key, , bonus]) => [key, (definition.stats[key] ?? 0) + modifiers.reduce((total, modifier) => total + (modifier?.[bonus] ?? 0), 0)])),
    armor: Object.fromEntries(BODY_PARTS.map(part => [part, Math.max(0, bodyPartArmor(definition, body, part) + armorBonus)])) };
}

function SetBonus({ bonus, equippedPieces }: { bonus: EquipmentSetBonusDefinition; equippedPieces: number }) {
  const active = equippedPieces >= bonus.pieces;
  const attributes = numericStats.flatMap(([, name, key]) => bonus.modifiers[key] ? [{ name, value: bonus.modifiers[key]! }] : []);
  return <article className="equipment-set-bonus" data-active={active}>
    <span className="equipment-bonus-count">{bonus.pieces}</span>
    <div className="equipment-bonus-content">
      <div className="equipment-bonus-heading">
        {bonus.aura && <CatalogAuraIcon visual={bonus.aura.visual} size={30} />}
        <h4>{bonus.aura ? `Аура: ${bonus.aura.name}` : bonus.name}<small>{active ? 'Действует' : `${equippedPieces} / ${bonus.pieces} предметов`}</small></h4>
      </div>
      {attributes.length > 0 && <div className="equipment-bonus-attributes">{attributes.map(attribute => <span key={attribute.name}>{attribute.name} <b>{signed(attribute.value)}</b></span>)}</div>}
      {bonus.aura && <p>{bonus.description.replace(/^Аура «[^»]+»:\s*/, '')}</p>}
      <details className="equipment-detail-disclosure"><summary>Условия эффекта</summary>
        {bonus.aura && <p>{bonus.aura.description}</p>}
        <p>Действует, пока надето не менее {bonus.pieces} разных работающих предметов комплекта. При утрате нужного количества предметов эффект отключается.</p>
      </details>
    </div>
  </article>;
}

function EquipmentWorkshop() {
  const [heroId, setHeroId] = useState(gameContent.characters[0].id);
  const [outfits, setOutfits] = useState<Record<string, StarterEquipment[]>>(initialOutfits);
  const [rewards, setRewards] = useState<EquipmentReward[]>(() => CATALOG_EQUIPMENT_ITEMS.map(item => ({ id: item.id, itemId: item.id })));
  const [selections, setSelections] = useState<EquipmentChoiceSelection[]>([]);
  const [setId, setSetId] = useState(CATALOG_EQUIPMENT_SETS[0]?.id ?? 'iron-vanguard');
  const [itemId, setItemId] = useState(CATALOG_EQUIPMENT_SETS[0]?.itemIds[0] ?? 'iron-vanguard-head');
  const [handSlot, setHandSlot] = useState<EquipmentSlot>('rightHand');
  const [ringSlot, setRingSlot] = useState<'ring1' | 'ring2'>('ring1');
  const [query, setQuery] = useState(''), [rarity, setRarity] = useState('all'), [material, setMaterial] = useState('all'), [weapon, setWeapon] = useState('all');
  const [page, setPage] = useState(0), [notice, setNotice] = useState(''), [returnedTotal, setReturnedTotal] = useState(0);
  const returnedSequence = useRef(0);
  const [facing, setFacing] = useState<UnitFacing>('south'), [motion, setMotion] = useState<UnitMotion>('idle');
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hero = gameContent.characters.find(unit => unit.id === heroId)!;
  const current = outfits[heroId], selectedSet = EQUIPMENT_SETS[setId], selectedItem = EQUIPMENT_ITEMS[itemId];
  const available = useMemo(() => new Set(rewards.map(reward => reward.itemId)), [rewards]);
  const rewardById = useMemo(() => new Map(rewards.map(reward => [reward.id, reward])), [rewards]);
  const preview = useMemo(() => previewEquipmentChoice(current, rewards, selections, EQUIPMENT_ITEMS), [current, rewards, selections]);
  const currentDefinition = useMemo(() => applyEquipmentToHero(hero, current), [hero, current]);
  const previewDefinition = useMemo(() => applyEquipmentToHero(hero, preview.equipment), [hero, preview.equipment]);
  const before = useMemo(() => sheet(currentDefinition), [currentDefinition]), after = useMemo(() => sheet(previewDefinition), [previewDefinition]);
  const currentLoadout = useMemo(() => loadoutFor(current), [current]), previewLoadout = useMemo(() => loadoutFor(preview.equipment), [preview.equipment]);
  const filtered = useMemo(() => CATALOG_EQUIPMENT_SETS.filter(set => {
    const words = `${set.name} ${set.description ?? ''} ${set.itemIds.map(id => EQUIPMENT_ITEMS[id]?.name ?? '').join(' ')}`.toLocaleLowerCase('ru-RU');
    return (!query || words.includes(query.toLocaleLowerCase('ru-RU'))) && (rarity === 'all' || set.rarity === rarity)
      && (material === 'all' || set.visual?.material === material) && (weapon === 'all' || set.itemIds.some(id => EQUIPMENT_ITEMS[id]?.weapon?.kind === weapon));
  }), [query, rarity, material, weapon]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const selectedGroup = after.sets.find(set => set.setId === setId);
  const defaultSlots = selectedSet?.loadout ?? Object.fromEntries((selectedSet?.itemIds ?? []).flatMap(id => {
    const item = EQUIPMENT_ITEMS[id]; return item && item.slot !== 'hand' ? [[item.slot, id]] : [];
  })) as Partial<Record<EquipmentSlot, string>>;
  const setMissing = Object.entries(defaultSlots).filter(([slot, id]) => id && !available.has(id) && !current.some(item => item.slot === slot && item.id === id));
  const setChoices = Object.entries(defaultSlots).reduce<EquipmentChoiceSelection[]>((choices, [slot, itemId]) => {
    const reward = rewards.find(reward => reward.itemId === itemId && !choices.some(choice => choice.rewardId === reward.id));
    if (reward) choices.push({ slot: slot as EquipmentSlot, rewardId: reward.id });
    return choices;
  }, []);
  const palette = selectedSet?.visual?.palette ?? equipmentMaterial(selectedItem?.appearanceId);
  const selectedSlot = selectedItem?.slot === 'hand' ? handSlot : selectedItem && isRingSlot(selectedItem.slot) ? ringSlot : selectedItem?.slot;

  const browseSet = (set: EquipmentSetDefinition) => { setSetId(set.id); setItemId(set.itemIds[0]); setNotice(''); };
  const changeHero = (id: string) => { setHeroId(id); setSelections([]); setNotice(''); };
  const trySet = () => {
    if (setMissing.length || !setChoices.length) return;
    previewEquipmentChoice(current, rewards, setChoices, EQUIPMENT_ITEMS);
    setSelections(setChoices); setNotice('Набор в примерке. Подтвердите, чтобы заменить надетые вещи.');
  };
  const tryItem = () => {
    if (!selectedItem || !selectedSlot || !available.has(selectedItem.id)) return;
    const matching = rewards.filter(reward => reward.itemId === selectedItem.id);
    const reward = matching.find(reward => !selections.some(choice => choice.rewardId === reward.id)) ?? matching[0];
    if (!reward) return;
    const slot = selectedSlot;
    const selectedIsTwoHanded = selectedItem.weapon?.hands === 2;
    const choices = selections.filter(choice => choice.rewardId !== reward.id && choice.slot !== slot
      && !(isHand(slot) && isHand(choice.slot) && (selectedIsTwoHanded || EQUIPMENT_ITEMS[rewardById.get(choice.rewardId)?.itemId ?? '']?.weapon?.hands === 2)));
    choices.push({ rewardId: reward.id, slot });
    previewEquipmentChoice(current, rewards, choices, EQUIPMENT_ITEMS);
    setSelections(choices); setNotice('Предмет добавлен в примерку. Надетая экипировка пока не изменилась.');
  };
  const confirm = () => {
    const result = confirmEquipmentChoice(current, rewards, selections, EQUIPMENT_ITEMS);
    const returned = result.removed.map(item => ({ id: `workshop-return:${returnedSequence.current++}`, itemId: item.id! }));
    setOutfits(previous => ({ ...previous, [heroId]: result.equipment })); setRewards([...result.remainingRewards, ...returned]);
    setReturnedTotal(total => total + returned.length); setSelections([]);
    setNotice(`Экипировка надета. В запас мастерской возвращено вещей: ${returned.length}. Их можно выбрать снова.`);
  };
  const itemInUse = selectedItem && current.some(item => item.id === selectedItem.id);
  const itemInDraft = selectedItem && selections.some(choice => rewardById.get(choice.rewardId)?.itemId === selectedItem.id && choice.slot === selectedSlot);
  const currentItemInSlot = selectedItem && current.find(item => item.slot === selectedSlot);

  return <main className="equipment-workshop" style={{ '--set-accent': palette.trim, '--set-cloth': palette.cloth } as CSSProperties}>
    <header className="equipment-workshop-heading"><div><span className="equipment-eyebrow">ОСКОЛКИ СУДЬБЫ / ОРУЖЕЙНАЯ</span><h1>Наследия забытых эпох</h1><p>{CATALOG_EQUIPMENT_SETS.length} комплектов · {CATALOG_EQUIPMENT_ITEMS.length.toLocaleString('ru-RU')} предметов · бонусы за 2 / 4 / 6 вещей</p></div><div className="equipment-local-label"><span aria-hidden="true">◇</span><strong>Мастерская снаряжения</strong><small>Локальная примерка · сохранение игры не меняется</small></div></header>
    <div className="equipment-workshop-layout">
      <aside className="equipment-browser" aria-label="Каталог комплектов">
        <div className="equipment-filter-heading"><h2>Коллекция</h2><span>{filtered.length} / {CATALOG_EQUIPMENT_SETS.length}</span></div>
        <label className="equipment-search"><span aria-hidden="true">⌕</span><input aria-label="Поиск комплекта или предмета" placeholder="Имя, история, предмет…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
        <div className="equipment-filters">
          <label><span>Редкость</span><select value={rarity} onChange={event => { setRarity(event.target.value); setPage(0); }}><option value="all">Все редкости</option>{Object.entries(rarityNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label><span>Материал</span><select value={material} onChange={event => { setMaterial(event.target.value); setPage(0); }}><option value="all">Все материалы</option>{Object.entries(materialNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="equipment-filter-weapon"><span>Вооружение</span><select value={weapon} onChange={event => { setWeapon(event.target.value); setPage(0); }}><option value="all">Все виды оружия</option>{HERO_WEAPONS.map(item => <option key={item.kind} value={item.kind}>{item.name}</option>)}</select></label>
        </div>
        <div className="equipment-rarity-key" aria-label="Редкости предметов">{(['common', 'rare', 'epic', 'legendary'] as const).map(value => <span key={value} data-equipment-rarity={value}>{rarityNames[value]}</span>)}</div>
        <div className="equipment-set-list" aria-label="Наборы на странице">{visible.map(set => <button type="button" key={set.id} className={`equipment-set-card ${set.id === setId ? 'is-selected' : ''}`} onClick={() => browseSet(set)} aria-pressed={set.id === setId}>
          <EquipmentGlyph item={EQUIPMENT_ITEMS[set.itemIds[0]]} set={set} size={43} /><span><strong>{set.name}</strong><small>{rarityNames[set.rarity ?? 'common']} · {materialNames[set.visual?.material ?? 'cloth']}</small></span><i aria-hidden="true">›</i>
        </button>)}</div>
        {!visible.length && <p className="equipment-empty">Таких комплектов пока нет. Измените фильтры.</p>}
        <nav className="equipment-pagination" aria-label="Страницы коллекции"><button disabled={!safePage} onClick={() => setPage(safePage - 1)} aria-label="Предыдущая страница">←</button><span>{safePage + 1} / {pages}</span><button disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label="Следующая страница">→</button></nav>
      </aside>

      <section className="equipment-stage-column" aria-label="Примерка экипировки">
        <div className="equipment-stage-toolbar"><label><span className="equipment-eyebrow">НОСИТЕЛЬ</span><select value={heroId} onChange={event => changeHero(event.target.value)} aria-label="Герой для примерки">{gameContent.characters.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><button className="equipment-play" onClick={() => setPlaying(value => !value)} aria-pressed={playing}>{playing ? 'Ⅱ Пауза' : '▶ Анимация'}</button></div>
        <div className="equipment-stage" data-draft={selections.length > 0}>
          <div className="equipment-stage-halo" aria-hidden="true" /><div className="equipment-stage-runes" aria-hidden="true">◇ · ✧ · ◇ · ✧ · ◇ · ✧ · ◇</div><div className="equipment-stage-floor" aria-hidden="true" />
          <span className="equipment-stage-state">{selections.length ? 'ПРИМЕРКА' : 'СЕЙЧАС НАДЕТО'}</span>
          <HeroCanvas hero={hero} equipment={previewLoadout} facing={facing} motion={motion} playing={playing} className="equipment-hero-main" />
          {selections.length > 0 && <div className="equipment-stage-before"><small>Сейчас</small><HeroCanvas hero={hero} equipment={currentLoadout} facing={facing} /></div>}
          <div className="equipment-stage-name"><strong>{hero.name}</strong><span>{selections.length ? `${selections.length} вещей в примерке` : 'Выберите предмет или целый комплект'}</span></div>
        </div>
        <div className="equipment-angle-row">{facingNames.map(([direction, label]) => <button key={direction} aria-pressed={facing === direction} onClick={() => setFacing(direction)}><HeroCanvas hero={hero} equipment={previewLoadout} facing={direction} /><span>{label}</span></button>)}</div>
        <label className="equipment-motion"><span>Движение</span><select aria-label="Анимация героя" value={motion} onChange={event => setMotion(event.target.value as UnitMotion)}>{motionNames.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <section className="equipment-equipped"><div className="equipment-section-title"><h3>{selections.length ? 'После подтверждения' : 'Надетые предметы'}</h3><span>{preview.equipment.length} вещей</span></div><div className="equipment-equipped-grid">{HERO_VISUAL_SLOTS.map(slot => {
          const item = preview.equipment.find(item => item.slot === slot), previous = current.find(item => item.slot === slot);
          const occupied = !item && isHand(slot) && preview.equipment.find(item => item.weapon?.hands === 2 && isHand(item.slot));
          const changed = item?.id !== previous?.id;
          return <button key={slot} className={`equipment-worn-slot ${changed ? 'is-changed' : ''}`} data-equipment-rarity={item ? item.rarity ?? 'common' : occupied ? occupied.rarity ?? 'common' : undefined} onClick={() => { if (item?.id && EQUIPMENT_ITEMS[item.id]) { setItemId(item.id); if (item.setId) setSetId(item.setId); if (isHand(slot)) setHandSlot(slot); } }} disabled={!item} title={item ? `${item.name} · ${rarityNames[item.rarity ?? 'common']}` : occupied ? 'Занята двуручным оружием' : 'Пусто'}>
            {item ? <EquipmentGlyph item={item} size={32} /> : <span className="equipment-empty-slot">{occupied ? '↔' : '◇'}</span>}<span><small>{slotNames[slot]}</small><strong>{item?.name ?? (occupied ? 'Две руки' : 'Пусто')}</strong>{changed && <em>Замена</em>}</span>
          </button>;
        })}</div></section>
        <section className="equipment-attributes"><h3>Атрибуты и защита</h3><div className="equipment-attribute-grid">{numericStats.filter(([id]) => before.attributes[id] || after.attributes[id]).map(([id, name]) => <div key={id}><span>{name}</span><strong>{after.attributes[id]}</strong>{after.attributes[id] !== before.attributes[id] && <small data-positive={after.attributes[id] > before.attributes[id]}>{signed(after.attributes[id] - before.attributes[id])}</small>}</div>)}</div><details><summary>Прочность и Защита каждой части тела</summary><div className="equipment-body-grid">{BODY_PARTS.map(part => <div key={part}><b>{bodyNames[part]}</b><span>Прочность {before.body[part].max} {before.body[part].max !== after.body[part].max && `→ ${after.body[part].max}`}</span><span>Защита {before.armor[part]} {before.armor[part] !== after.armor[part] && `→ ${after.armor[part]}`}</span></div>)}</div></details></section>
      </section>

      <aside className="equipment-detail-column" aria-label="Комплект и предмет">
        <section className="equipment-set-detail">
          <span className="equipment-eyebrow">КОМПЛЕКТ</span><h2>{selectedSet?.name}</h2>
          <div className="equipment-set-properties"><span>{materialNames[selectedSet?.visual?.material ?? 'cloth']}</span><span>{selectedSet?.itemIds.length ?? 0} предметов</span><span>{selectedGroup?.equippedPieces ?? 0} надето{selections.length ? ' в примерке' : ''}</span></div>
          {selectedSet?.description && <details className="equipment-detail-disclosure equipment-set-story"><summary>О комплекте</summary><p>{selectedSet.description}</p></details>}
          <button className="equipment-primary" onClick={trySet} disabled={!setChoices.length || setMissing.length > 0}>Примерить весь комплект</button>
          {setMissing.length > 0 && <small className="equipment-help">Часть предметов уже выбрана ранее и больше не доступна в предложениях.</small>}
          {!setChoices.length && !setMissing.length && <small className="equipment-help">Все предметы этого комплекта уже надеты.</small>}
          <div className="equipment-set-pieces" aria-label="Предметы комплекта">{selectedSet?.itemIds.map(id => {
            const item = EQUIPMENT_ITEMS[id], worn = current.some(entry => entry.id === id), draft = selections.some(entry => rewardById.get(entry.rewardId)?.itemId === id);
            return <button key={id} data-equipment-rarity={item.rarity ?? 'common'} title={`${item.name} · ${rarityNames[item.rarity ?? 'common']}`} aria-label={`${item.name}. ${rarityNames[item.rarity ?? 'common']} предмет.`} aria-pressed={itemId === id} className={`${draft ? 'is-draft' : ''} ${!available.has(id) && !worn ? 'is-consumed' : ''}`} onClick={() => { setItemId(id); }}><EquipmentGlyph item={item} size={42} /><span>{draft ? '◇' : worn ? '✓' : !available.has(id) ? '—' : ''}</span></button>;
          })}</div>
          <div className="equipment-set-bonuses"><h3>Бонусы комплекта</h3>{selectedSet?.bonuses?.map(bonus => <SetBonus key={bonus.pieces} bonus={bonus} equippedPieces={selectedGroup?.equippedPieces ?? 0} />)}{!selectedSet?.bonuses?.length && <p className="equipment-help">У стартового набора нет бонусов комплекта.</p>}</div>
          {after.sets.filter(group => group.setId !== setId && group.bonuses.length).map(group => <details className="equipment-other-set equipment-set-bonuses" key={group.setId}><summary>{group.name} · {group.equippedPieces} вещей</summary>{group.bonuses.map(bonus => <SetBonus key={bonus.pieces} bonus={bonus} equippedPieces={group.equippedPieces} />)}</details>)}
        </section>
        {selectedItem && <section className="equipment-item-detail" data-equipment-rarity={selectedItem.rarity ?? 'common'}>
          <div className="equipment-item-heading"><EquipmentGlyph item={selectedItem} size={60} /><div><span className="equipment-eyebrow">{selectedItem.slot === 'hand' ? HERO_WEAPONS.find(kind => kind.kind === selectedItem.weapon?.kind)?.name : isRingSlot(selectedItem.slot) ? 'Кольцо' : slotNames[selectedItem.slot]}</span><h3>{selectedItem.name}</h3><EquipmentRarityBadge rarity={selectedItem.rarity} /></div></div>
          <span className="equipment-item-status">{itemInDraft ? 'В примерке' : itemInUse ? 'Надето' : available.has(selectedItem.id) ? 'Доступно для выбора' : 'Предмет уже выбран'}</span>
          <div className="equipment-item-stats">
            {selectedItem.weapon?.damage && <span>Урон <b>{selectedItem.weapon.damage}</b></span>}{selectedItem.weapon && <span>Хват <b>{selectedItem.weapon.hands === 2 ? 'Две руки' : 'Одна рука'}</b></span>}
            {!!selectedItem.armor && <span>Защита части <b>+{selectedItem.armor}</b></span>}
            {Object.entries(selectedItem.resources).map(([part, value]) => <span key={part}>Прочность · {bodyNames[part as keyof typeof bodyNames]} <b>+{value}</b></span>)}
            {numericStats.filter(([key]) => selectedItem.bonuses?.[key]).map(([key, name]) => <span key={key}>{name} <b>{signed(selectedItem.bonuses![key]!)}</b></span>)}
          </div>
          <details className="equipment-detail-disclosure"><summary>Описание предмета</summary><p>{selectedItem.description}</p></details>
          {selectedItem.slot === 'hand' && <label className="equipment-hand-picker"><span>В какую руку</span><select aria-label="Рука для выбранного предмета" value={handSlot} onChange={event => setHandSlot(event.target.value as EquipmentSlot)}><option value="rightHand">Правая рука</option><option value="leftHand">Левая рука</option></select></label>}
          {isRingSlot(selectedItem.slot) && <label className="equipment-hand-picker"><span>Слот кольца</span><select aria-label="Слот для выбранного кольца" value={ringSlot} onChange={event => setRingSlot(event.target.value as 'ring1' | 'ring2')}><option value="ring1">Кольцо 1</option><option value="ring2">Кольцо 2</option></select></label>}
          {currentItemInSlot && currentItemInSlot.id !== selectedItem.id && <p className="equipment-replacement">Сейчас: <strong data-equipment-rarity={currentItemInSlot.rarity ?? 'common'}>{currentItemInSlot.name}</strong></p>}
          {selectedItem.weapon?.hands === 2 && <small className="equipment-help">Займёт обе руки. Надетые в руках предметы попадут в список замен.</small>}
          <button className="equipment-secondary" onClick={tryItem} disabled={!available.has(selectedItem.id) || !!itemInDraft}>{itemInDraft ? 'Уже в примерке' : itemInUse ? 'Предмет надет' : available.has(selectedItem.id) ? 'Примерить предмет' : 'Больше не доступен'}</button>
        </section>}
      </aside>
    </div>
    <footer className="equipment-confirm-bar" data-draft={selections.length > 0}>
      <div><strong>{selections.length ? `Выбрано ${selections.length} предметов` : 'Примерьте новое снаряжение'}</strong><p role="status" aria-live="polite">{notice || 'Подтверждение заменяет экипировку и возвращает снятые вещи в запас.'}</p>{selections.length > 0 && <details><summary>Вернутся в запас: {preview.removed.length}</summary><ul>{preview.removed.map(item => <li key={item.slot} data-equipment-rarity={item.rarity ?? 'common'}>{item.name}</li>)}</ul></details>}</div>
      <div className="equipment-confirm-actions"><span>Доступно: {rewards.length.toLocaleString('ru-RU')}<small>Возвращено: {returnedTotal}</small></span><button className="equipment-secondary" disabled={!selections.length} onClick={() => { setSelections([]); setNotice('Примерка отменена. Предметы остались доступными.'); }}>Отмена</button><button className="equipment-primary" disabled={!selections.length} onClick={confirm}>Подтвердить</button></div>
    </footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<EquipmentWorkshop />);
