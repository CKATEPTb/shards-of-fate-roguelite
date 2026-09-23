import { useEffect, useState, type CSSProperties } from 'react';
import type { CombatChoice, SkillRarity } from '@shards/shared';
import { AuraIcon } from '../AuraIcon';
import type { useBattleCardDrag } from './useBattleCardDrag';
import { BattleAimOverlay } from './BattleAimOverlay';
import { SKILL_RARITY_NAMES, SkillRarityBadge } from '../SkillRarity';

export interface BattleCard {
  id: string; name: string; description: string; art: string; formula: string;
  targetLabel: string; cooldown: number; totalCooldown: number; available: boolean;
  choice: CombatChoice; tone: 'attack' | 'support' | 'escape';
  rarity?: SkillRarity;
}

type CardGesture = ReturnType<typeof useBattleCardDrag>;

function CardFace({ card }: { card: BattleCard }) {
  return <>
    {card.rarity && <span className="battle-card-rarity" aria-hidden="true">◆</span>}
    <span className="battle-card-type">{card.targetLabel}</span>
    <span className="battle-card-art"><AuraIcon id={card.art} size={62} /></span>
    <strong className="battle-card-name">{card.name}</strong>
    <span className="battle-card-formula">{card.formula}</span>
    <span className="battle-card-footer">{card.cooldown > 0 ? `Ещё ${card.cooldown} ход.` : card.totalCooldown ? `Откат ${card.totalCooldown} ход.` : 'Каждый ход'}</span>
    {card.cooldown > 0 && <span className="battle-card-cooldown" aria-hidden="true">{card.cooldown}<small>ход.</small></span>}
  </>;
}

export function BattleHand({ cards, selectedId, active, gesture, targetName, onSelect, reducedMotion = false, automatic = false }: {
  cards: BattleCard[]; selectedId?: string; active: boolean; gesture: CardGesture;
  targetName?: string; onSelect: (cardId: string) => void;
  reducedMotion?: boolean;
  automatic?: boolean;
}) {
  const [inspected, setInspected] = useState<string>();
  useEffect(() => { setInspected(undefined); }, [active, cards[0]?.choice.actorId, selectedId]);
  const detail = cards.find(card => card.id === (inspected ?? selectedId));
  const dragged = cards.find(card => card.id === gesture.drag?.cardId);
  const selecting = Boolean(selectedId && active);
  return <div className="battle-hand" data-active={active} data-dragging={Boolean(dragged)}>
    {detail && !dragged && <div className="battle-card-detail" role="tooltip" id="battle-card-description">
      <strong>{detail.name}</strong><p>{detail.description}</p>
      <SkillRarityBadge rarity={detail.rarity} />
      {detail.cooldown > 0 && <small>Восстановится через {detail.cooldown} ход.</small>}
    </div>}
    <div className="battle-card-fan" role="group" aria-label="Карты действий">
      {cards.map((card, index) => {
        const center = index - (cards.length - 1) / 2;
        return <button key={card.id} type="button" className="battle-card" data-tone={card.tone} data-battle-card={card.id} data-rarity={card.rarity}
          data-selected={selectedId === card.id} data-drag-source={dragged?.id === card.id}
          data-cooling={card.cooldown > 0} aria-disabled={!active || !card.available}
          aria-pressed={selectedId === card.id} aria-describedby={detail?.id === card.id ? 'battle-card-description' : undefined}
          aria-label={`${card.name}. ${card.rarity ? `${SKILL_RARITY_NAMES[card.rarity]}. ` : ''}${card.formula}. ${card.cooldown ? `Перезарядка: ${card.cooldown} ходов.` : card.targetLabel}. ${card.description}`}
          style={{ '--card-angle': `${center * 6}deg`, '--card-offset': `${Math.abs(center) * Math.abs(center) * 8}px`, '--card-layer': index + 1 } as CSSProperties}
          onMouseEnter={() => setInspected(card.id)} onMouseLeave={() => setInspected(undefined)}
          onFocus={() => setInspected(card.id)} onBlur={() => setInspected(undefined)}
          onPointerDown={event => { if (card.available) gesture.onPointerDown(event, card.id); }}
          onPointerMove={gesture.onPointerMove} onPointerUp={event => { if (gesture.drag) setInspected(undefined); gesture.onPointerUp(event); }}
          onPointerCancel={gesture.onPointerCancel} onLostPointerCapture={gesture.onLostPointerCapture}
          onClick={event => { if (event.detail === 0 && active && card.available) onSelect(card.id); }}>
          <CardFace card={card} />
        </button>;
      })}
    </div>
    <p className="battle-hand-hint" aria-live="polite">{dragged ? gesture.drag?.cancelling ? 'Отпустите для отмены'
      : gesture.drag?.automatic ? 'Отпустите для применения' : targetName ? `Отпустите: ${targetName}` : 'Наведите на цель · область сбоку — отмена'
      : selecting ? automatic ? 'Слегка потяните карту и отпустите · Esc — отмена' : 'Выберите цель на поле · Esc — отмена'
        : active ? 'Потяните карту, чтобы применить' : 'Карты доступны в ваш ход'}</p>
    {dragged && gesture.drag && <BattleAimOverlay drag={gesture.drag} tone={dragged.tone}
      targetName={targetName} reducedMotion={reducedMotion} onCancel={gesture.cancel} />}
  </div>;
}
