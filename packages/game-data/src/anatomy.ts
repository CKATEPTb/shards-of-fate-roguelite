import type { BodyResources, HeroAnatomy, StarterEquipment } from '@shards/shared';

function starterAnatomy(max: [number, number, number, number], armor: [number, number, number, number, number], names: [string, string, string, string, string], weapon: string, offHand: string, power: number, healing = 0, offHandPower = 0): HeroAnatomy {
  const [head, torso, arm, leg] = max;
  const base: BodyResources = { head: head / 4, torso: torso / 4, leftArm: arm / 4, rightArm: arm / 4, leftLeg: leg / 4, rightLeg: leg / 4 };
  const legGear = leg * 3 / 4;
  const pants = Math.ceil(legGear / 2);
  const equipment: StarterEquipment[] = [
    { slot: 'head', name: names[0], description: 'Защищает голову. Прочность вещи не расходуется.', resources: { head: head * 3 / 4 }, armor: armor[0], bodyParts: ['head'] },
    { slot: 'chest', name: names[1], description: 'Защищает тело. Прочность вещи не расходуется.', resources: { torso: torso * 3 / 4 }, armor: armor[1], bodyParts: ['torso'] },
    { slot: 'gloves', name: names[2], description: 'Защищают обе руки. Каждая сохранённая рука использует свою половину пары.', resources: { leftArm: arm * 3 / 4, rightArm: arm * 3 / 4 }, armor: armor[2], bodyParts: ['leftArm', 'rightArm'] },
    { slot: 'pants', name: names[3], description: 'Защищают обе ноги. Каждая сохранённая нога использует свою половину пары.', resources: { leftLeg: pants, rightLeg: pants }, armor: armor[3], bodyParts: ['leftLeg', 'rightLeg'] },
    { slot: 'boots', name: names[4], description: 'Защищают обе ноги. Каждая сохранённая нога использует свой сапог.', resources: { leftLeg: legGear - pants, rightLeg: legGear - pants }, armor: armor[4], bodyParts: ['leftLeg', 'rightLeg'] },
    { slot: 'mainHand', name: weapon, description: 'Оружие в правой руке. Недоступно при утрате этой руки.', resources: {}, armor: 0, bodyParts: ['rightArm'], bonuses: { power } },
    { slot: 'offHand', name: offHand, description: 'Предмет в левой руке. Недоступен при утрате этой руки.', resources: {}, armor: 0, bodyParts: ['leftArm'],
      ...(healing || offHandPower ? { bonuses: { ...(healing ? { healing } : {}), ...(offHandPower ? { power: offHandPower } : {}) } } : {}) },
  ];
  return { base, equipment };
}

export const STARTER_ANATOMY: Record<string, HeroAnatomy> = {
  guardian: starterAnatomy([28, 64, 40, 44], [2, 8, 2, 3, 3], ['Стальной шлем', 'Стальной нагрудник', 'Латные перчатки', 'Поножи стража', 'Стальные сапоги'], 'Меч стража', 'Щит стража', 6),
  priest: starterAnatomy([28, 52, 32, 36], [1, 3, 1, 1, 1], ['Капюшон хранительницы', 'Укреплённое одеяние', 'Перчатки хранительницы', 'Штаны хранительницы', 'Сапоги хранительницы'], 'Жезл света', 'Священный символ', 4, 8),
  mage: starterAnatomy([28, 44, 32, 32], [1, 2, 0, 1, 1], ['Капюшон мага', 'Одеяние мага', 'Перчатки мага', 'Штаны мага', 'Сапоги мага'], 'Жезл искры', 'Книга заклинаний', 10),
  vampire: starterAnatomy([28, 60, 40, 44], [2, 4, 2, 2, 2], ['Капюшон вампира', 'Багровый камзол', 'Перчатки крови', 'Тёмные штаны', 'Сапоги ночи'], 'Серп крови', 'Багровый талисман', 8),
  paladin: starterAnatomy([32, 64, 40, 40], [2, 6, 2, 3, 3], ['Светлый шлем', 'Доспех клятвы', 'Латные рукавицы', 'Освящённые поножи', 'Сапоги паладина'], 'Молот клятвы', 'Солнечный щит', 6, 7),
  druid: starterAnatomy([28, 48, 36, 36], [1, 3, 1, 1, 2], ['Венок рощи', 'Лиственная накидка', 'Кожаные перчатки', 'Штаны друида', 'Сапоги корней'], 'Ветвистый посох', 'Семена рощи', 5, 7),
  necromancer: starterAnatomy([28, 48, 32, 36], [1, 2, 1, 1, 1], ['Чёрный капюшон', 'Погребальное облачение', 'Костяные перчатки', 'Тёмные штаны', 'Сапоги праха'], 'Костяной посох', 'Костяной фокус', 6, 7),
  rogue: starterAnatomy([28, 48, 32, 36], [1, 2, 1, 1, 2], ['Капюшон тени', 'Кожаный жилет', 'Перчатки разбойника', 'Штаны тени', 'Мягкие сапоги'], 'Правый кинжал', 'Левый кинжал', 5, 0, 2),
  ranger: starterAnatomy([28, 52, 36, 40], [1, 3, 1, 1, 2], ['Капюшон следопыта', 'Охотничий камзол', 'Стрелковые перчатки', 'Штаны следопыта', 'Лесные сапоги'], 'Охотничий лук', 'Колчан стрел', 8),
};
