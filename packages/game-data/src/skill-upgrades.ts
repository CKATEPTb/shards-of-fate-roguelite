import { REWARD_RARITIES, skillUpgradeId, upgradeResultDice, type ActionDefinition, type EffectDefinition, type Modifiers,
  type SkillDefinition, type StatusDefinition, type TargetSelector } from '@shards/shared';

const targetNames: Record<TargetSelector, string> = {
  self: 'себя', enemy: 'врага', ally: 'союзника, включая себя', lowestHealthEnemy: 'раненого врага', lowestHealthAlly: 'раненого союзника',
  allAllies: 'весь отряд', allEnemies: 'всех врагов', eventTarget: 'цель события', any: 'выбранную живую цель',
  randomEnemy: 'случайного врага', randomAlly: 'случайного союзника', randomUnit: 'случайного живого участника',
};
const modifierNames: Partial<Record<keyof Modifiers, string>> = {
  damageBonus: 'урон', damageReduction: 'поглощение', partyDamageReduction: 'защита отряда', evasionBonus: 'Уклонение',
  initiativeBonus: 'Инициатива', agilityBonus: 'Проворность', accuracyBonus: 'Точность', critBonus: 'Крит', armorBonus: 'Защита',
  powerBonus: 'Сила', resilienceBonus: 'Стойкость', luckBonus: 'Удача', damageBonusDice: 'дополнительный урон',
  partyGuardDice: 'защитный бросок', vampirismDice: 'вампиризм', healingShareDice: 'общее исцеление',
  preserveHot: 'продление регенерации', preserveShield: 'сохранение щита', repeatAttack: 'повтор атаки',
  guaranteedCrit: 'гарантированный крит', invulnerable: 'полное блокирование урона', taunt: 'провокация всех врагов',
};
const turns = (value: number | null | undefined) => value === null ? 'бессрочно' : value === undefined ? '' : `на ${value} х.`;
const formula = (action: ActionDefinition) => action.damagePerStack !== undefined ? `${action.damagePerStack} × заряды`
  : [action.dice, action.scaling ? `${action.factor !== undefined && action.factor !== 1 ? `${action.factor} × ` : ''}Сила` : ''].filter(Boolean).join(' + ');

function statusSummary(status: StatusDefinition | undefined): string {
  if (!status) return '';
  const descriptions = Object.entries(status.modifiers).flatMap(([key, value]) => {
    const name = modifierNames[key as keyof Modifiers];
    if (!name || value === undefined || value === false) return [];
    return [typeof value === 'boolean' ? name : typeof value === 'number' ? `${name} ${value > 0 ? '+' : ''}${value}`
      : typeof value === 'string' ? `${name} ${value}` : `${name}: ${value.dice}, ${value.atLeast}+`];
  });
  for (const action of status.actions) {
    if (action.type === 'status') continue;
    const when = status.trigger === 'TURN_STARTED' ? 'начало хода' : 'конец хода';
    descriptions.push(`${when}: ${action.type === 'damage' ? 'урон' : action.type === 'heal' ? 'лечение' : 'щит'} ${formula(action)}${action.bypassArmor ? ' без брони' : ''}${action.scaleWithRemainingDuration ? ' × оставшиеся ходы' : ''}`);
  }
  if (status.stacking === 'decay') descriptions.push('−1 заряд после срабатывания');
  if (status.expiresAt === 'TURN_STARTED') descriptions.push('срок убывает в начале хода');
  return descriptions.join('; ');
}

/** The displayed formulas come from the transformed actions, never string replacements in old prose. */
function upgradedDescription(skill: SkillDefinition, statuses: readonly StatusDefinition[]): string {
  const statusFor = (id: string | undefined) => statuses.find(status => status.id === id);
  const descriptions = skill.actions.map(action => {
    const target = action.targetRelation ? action.targetRelation === 'ally' ? 'для союзной цели' : 'для вражеской цели'
      : `на ${targetNames[action.target ?? skill.target]}`;
    if (action.type === 'status') {
      const status = statusFor(action.statusId);
      return `«${status?.name ?? 'Аура'}» ${target} ${turns(action.duration)}${status ? ` (${statusSummary(status)})` : ''}.`;
    }
    const type = action.type === 'damage' ? 'Урон' : action.type === 'heal' ? 'Лечение' : 'Щит';
    const status = statusFor(action.onHitStatusId);
    return `${type} ${formula(action)} ${target}${(action.hits ?? 1) > 1 ? `, ${action.hits} отдельных попадания` : ''}${action.bypassArmor ? ', игнорируя броню' : ''}${action.type === 'shield' ? ` ${turns(action.duration)}` : ''}.`
      + (status ? ` При попадании: «${status.name}» ${turns(action.onHitDuration)} (${statusSummary(status)}).` : '');
  });
  if (skill.target === 'randomUnit') descriptions.push('Случайная цель может оказаться союзником или самим заклинателем.');
  if (skill.tags.includes('SACRIFICE')) descriptions.push('Самоповреждение сохраняет исходную цену; следующие действия требуют пережить его.');
  if (skill.id.startsWith('ranger_volley__')) descriptions.push('Если улучшенная Вторая стрела имеет более высокий шанс, сохраняется её проверка.');
  if (skill.id.startsWith('guardian_bastion__')) descriptions.push('Между окончанием защиты и восстановлением навыка остаются 2 хода.');
  descriptions.push(`Перезарядка: ${skill.cooldown} х.`);
  return descriptions.join(' ');
}

/** Only learnable and native hero abilities receive shop variants; base definitions stay byte-for-byte intact. */
export function createSkillUpgradeVariants(skills: readonly SkillDefinition[], statuses: readonly StatusDefinition[]): SkillDefinition[] {
  const result: SkillDefinition[] = [];
  for (const base of skills) {
    const native = base.tags.includes('ROLE') || base.tags.includes('CHARACTER');
    if (!native && !base.tags.includes('LEARNABLE') || base.tags.includes('UPGRADED')) continue;
    const origin = REWARD_RARITIES.indexOf(base.rarity ?? 'common');
    for (let rank = origin + 1; rank < REWARD_RARITIES.length; rank++) {
      const rarity = REWARD_RARITIES[rank], levels = rank - origin;
      const actions = base.actions.map(action => {
        const target = action.target ?? base.target;
        const allied = action.targetRelation === 'ally' || ['self', 'ally', 'allAllies', 'lowestHealthAlly', 'randomAlly'].includes(target);
        const cost = action.type === 'damage' && allied;
        const status = statuses.find(status => status.id === action.statusId);
        const harmfulToAlly = action.type === 'status' && allied && status?.polarity === 'negative';
        return { ...action,
          ...(!cost && action.dice ? { dice: upgradeResultDice(action.dice, levels) } : {}),
          ...(!cost && !harmfulToAlly && typeof action.duration === 'number' ? { duration: action.duration + levels } : {}),
          ...(!cost && typeof action.onHitDuration === 'number' ? { onHitDuration: action.onHitDuration + levels } : {}),
        };
      });
      // This pure-burning action has no finite duration or result die to strengthen.
      const cooldown = base.id === 'scattered_tinder' ? Math.max(1, base.cooldown - levels)
        : base.id === 'guardian_bastion' ? base.cooldown + levels : base.cooldown;
      const skill: SkillDefinition = { ...base, id: skillUpgradeId(base.id, rarity), rarity, actions, cooldown,
        tags: [...base.tags, 'UPGRADED', ...(native ? ['NATIVE'] : [])] };
      skill.description = upgradedDescription(skill, statuses);
      result.push(skill);
    }
  }
  return result;
}

/** Distinct effect IDs let two heroes retain their own passive rank in one combat. */
export function createNativeEffectUpgradeVariants(effects: readonly EffectDefinition[]): EffectDefinition[] {
  return effects.filter(effect => ['priest_benediction', 'mage_ember_spark'].includes(effect.id)).flatMap(base => REWARD_RARITIES.slice(1).map((rarity, index) => {
    const level = index + 1, priest = base.id === 'priest_benediction';
    return { ...base, id: skillUpgradeId(base.id, rarity), tags: [...base.tags, 'UPGRADED', 'NATIVE'],
      actions: priest ? base.actions.map(action => ({ ...action, duration: (action.duration ?? 2) + level }))
        : Array.from({ length: 1 + level }, () => ({ ...base.actions[0] })),
      description: priest ? `Исцелённый Жрицей союзник получает отдельное Благословение: +1d4 к урону каждого удара на ${2 + level} хода. Сила к дополнительному кубику не добавляется.`
        : `Критическое попадание Мага добавляет ${1 + level} заряда к общему Горению. В конце хода цель получает урон по числу зарядов, затем теряет 1 заряд.`,
    };
  }));
}
