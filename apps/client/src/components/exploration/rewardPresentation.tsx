import { useEffect, useMemo, useRef } from 'react';
import { resolveEquipmentItem, type AdventureReward, type EquipmentSlot, type HeroBody, type Modifiers, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { activeEquipmentSetBonuses, bodyCombatStats, startHeroBody } from '@shards/game-core';
import { applyEquipmentToHero, EQUIPMENT_ITEMS, gameContent } from '@shards/game-data';
import { HERO_VISUAL_SLOTS, type HeroVisualLoadout } from '../../art/heroLoadout';
import { unitFramePixels } from '../../art/unitFrames';
import { UNIT_CLIPS, type UnitFacing } from '../../art/unitPose';
import { SkillIcon } from '../SkillIcon';
import { EquipmentIcon } from '../EquipmentIcon';
import { LoadoutIcon } from './LoadoutIcon';

export const rewardAttributes = [
  ['power', 'Сила', 'powerBonus'], ['initiative', 'Инициатива', 'initiativeBonus'], ['accuracy', 'Точность', 'accuracyBonus'],
  ['evasion', 'Уклонение', 'evasionBonus'], ['crit', 'Критический удар', 'critBonus'], ['resilience', 'Стойкость', 'resilienceBonus'],
  ['agility', 'Проворность', 'agilityBonus'], ['luck', 'Удача', 'luckBonus'],
] as const;
export const rewardSlotNames: Record<EquipmentSlot, string> = { head: 'Голова', chest: 'Тело', gloves: 'Перчатки', pants: 'Штаны', boots: 'Сапоги', amulet: 'Амулет', ring1: 'Кольцо I', ring2: 'Кольцо II', rightHand: 'Правая рука', leftHand: 'Левая рука' };
export const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`;
export const rewardSkill = (id: string | null) => gameContent.skills.find(skill => skill.id === id);
export const rewardName = (reward: AdventureReward) => reward.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId)?.name ?? 'Предмет' : rewardSkill(reward.definitionId)?.name ?? 'Способность';

export function RewardArt({ reward }: { reward: AdventureReward }) {
  const item = reward.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId) : undefined;
  const skill = reward.kind === 'skill' ? rewardSkill(reward.definitionId) : undefined;
  if (skill?.icon) return <SkillIcon icon={skill.icon} size={42} />;
  return item ? <EquipmentIcon item={item} /> : <LoadoutIcon kind="extra" />;
}

export function FittingHero({ hero, equipment, body, facing }: { hero: UnitDefinition; equipment: StarterEquipment[]; body?: HeroBody; facing: UnitFacing }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const loadout = useMemo<HeroVisualLoadout>(() => Object.fromEntries(HERO_VISUAL_SLOTS.map(slot => [slot, equipment.find(item => item.slot === slot)?.id ?? null])), [equipment]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let request = 0, previous = -1;
    const frames = new Map<number, ReturnType<typeof unitFramePixels>>();
    const render = (now: number) => {
      const frame = animate ? Math.floor(now * UNIT_CLIPS.idle.frameRate / 1000) % UNIT_CLIPS.idle.frames : 0;
      if (frame !== previous && !document.hidden) {
        previous = frame;
        let pixels = frames.get(frame);
        if (!pixels) { pixels = unitFramePixels(hero.sprite, hero.role, false, facing, 'idle', frame, body, loadout); frames.set(frame, pixels); }
        context.clearRect(0, 0, 64, 64);
        for (const pixel of pixels) { context.fillStyle = pixel.color; context.fillRect(pixel.x, pixel.y, 1, 1); }
      }
      if (animate) request = requestAnimationFrame(render);
    };
    render(performance.now());
    return () => { cancelAnimationFrame(request); frames.clear(); };
  }, [hero, body, loadout, facing]);
  return <canvas ref={canvas} width={64} height={64} role="img" aria-label={`Примерка: ${hero.name}`} />;
}

export function equipmentStats(hero: UnitDefinition, equipment: StarterEquipment[], body?: HeroBody) {
  const definition = applyEquipmentToHero(hero, equipment);
  const anatomy = body ?? startHeroBody(definition), stats = bodyCombatStats(definition, anatomy);
  const groups = activeEquipmentSetBonuses(definition, anatomy);
  const modifiers: Array<Modifiers | undefined> = [definition.modifiers, ...groups.flatMap(group => group.bonuses.flatMap(bonus => [bonus.modifiers, bonus.aura?.modifiers]))];
  const sum = (key: keyof Modifiers) => modifiers.reduce((total, source) => total + (typeof source?.[key] === 'number' ? source[key] as number : 0), 0);
  return { groups, values: Object.fromEntries(rewardAttributes.map(([key, , modifier]) => [key, (stats[key] ?? 0) + sum(modifier)])) };
}
