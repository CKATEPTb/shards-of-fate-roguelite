import { useId, useState, type CSSProperties } from 'react';
import type { Combatant, GameContent } from '@shards/shared';
import { gameContent } from '../../catalog';
import { equipmentAurasFor } from '../../game/equipmentAuras';
import { AuraIcon } from '../AuraIcon';
import { DiceLegend, DiceText } from '../DiceText';
import { passiveDiceRules, statusDiceRules } from './diceRules';
import { characterEffects, effectTurns, type CharacterEffect, type CharacterEffectLayer } from './characterEffectsModel';
import './characterEffects.css';

function rulesFor(effect: CharacterEffect, content: GameContent) {
  if (effect.definition) return statusDiceRules(effect.definition, content);
  return effect.sources.flatMap(source => {
    const definition = [...content.characters, ...content.enemies].find(candidate => candidate.id === source.definitionId);
    return [...(definition?.modifiers.preserveShield ? passiveDiceRules(definition, content) : []),
      ...equipmentAurasFor(source, definition).flatMap(({ status }) => status.modifiers.preserveShield ? statusDiceRules(status, content) : []), ...source.statuses.flatMap(status => {
      const aura = content.statuses.find(candidate => candidate.id === status.id);
      return aura?.modifiers.preserveShield ? statusDiceRules(aura, content) : [];
    })];
  });
}

function groupedLayers(layers: CharacterEffectLayer[]) {
  const groups = new Map<string, { layer: CharacterEffectLayer; count: number }>();
  for (const layer of layers) {
    const key = JSON.stringify([layer.sourceId, layer.remaining, layer.capacity, layer.bonus, layer.stacks]);
    const previous = groups.get(key);
    if (previous) previous.count++;
    else groups.set(key, { layer, count: 1 });
  }
  return [...groups.values()];
}

export function CharacterEffectDetails({ effect, content = gameContent }: { effect: CharacterEffect; content?: GameContent }) {
  const rules = rulesFor(effect, content);
  return <article className="character-effect character-effect-detail" data-negative={effect.negative} style={{ '--effect-color': effect.color } as CSSProperties}>
    <div className="character-effect-icon"><AuraIcon id={effect.icon} visual={effect.definition?.visual} size={36} /></div>
    <div className="character-effect-content">
      <div className="character-effect-heading"><h4>{effect.name}{(effect.stacks > 1 || effect.decay) && <span aria-label={`Зарядов: ${effect.stacks}`}>×{effect.stacks}</span>}</h4><span className="character-effect-duration">{effect.duration}</span></div>
      <p className="character-effect-description"><DiceText text={effect.description} rules={rules} /></p>
      {!!effect.bonuses.length && <ul className="character-effect-bonuses">{effect.bonuses.map((bonus, index) => <li key={index} data-overridden={bonus.overridden}><DiceText text={bonus.text} rules={rules} /></li>)}</ul>}
      <p className="character-effect-timing"><span aria-hidden="true">◷</span>{effect.timing}{effect.decay ? ' · после срабатывания −1 заряд' : ''}</p>
      <ul className="character-effect-sources" aria-label="Источники и слои эффекта">{groupedLayers(effect.layers).map(({ layer, count }, index) => <li key={index}>
        <span><b>{layer.sourceName}</b>{count > 1 && <em> ×{count}</em>}{layer.capacity !== undefined && <i> · {layer.capacity} поглощения{count > 1 ? ' в слое' : ''}</i>}</span>
        <span className="character-effect-source-duration">{effect.decay ? `${layer.stacks} зарядов` : effectTurns(layer.remaining)}</span>
        {layer.bonus && <small>{layer.bonus}</small>}
      </li>)}</ul>
    </div>
  </article>;
}

export function CharacterEffects({ unit, roster, active, content = gameContent, compact = false, onInspectEffect, selectedId, includeEquipment = true }: {
  unit: Combatant | undefined; roster: readonly Combatant[]; active: boolean; content?: GameContent;
  compact?: boolean; onInspectEffect?: (effect: CharacterEffect) => void; selectedId?: string | null;
  includeEquipment?: boolean;
}) {
  const heading = useId();
  const [localId, setLocalId] = useState<string | null>(null);
  const equipmentIds = !includeEquipment && unit ? new Set(equipmentAurasFor(unit,
    [...content.characters, ...content.enemies].find(definition => definition.id === unit.definitionId)).map(effect => effect.id)) : undefined;
  const effects = characterEffects(unit, roster, active, content).filter(effect => !equipmentIds?.has(effect.id));
  const hasDice = effects.some(effect => /\d*d\d+/i.test(`${effect.description} ${effect.bonuses.map(bonus => bonus.text).join(' ')}`));
  const currentId = selectedId !== undefined ? selectedId : localId;
  const localEffect = !onInspectEffect ? effects.find(effect => effect.id === currentId) : undefined;
  if (compact) {
    if (!effects.length) return null;
    return <section className="character-effects character-effects-compact" aria-labelledby={heading}>
      <header className="character-effects-heading"><h3 id={heading}>Эффекты<span>{effects.length}</span></h3></header>
      <ul className="character-effects-strip">{effects.map(effect => <li key={effect.id}>
        <button type="button" className="character-effect-button" style={{ '--effect-color': effect.color } as CSSProperties}
          data-negative={effect.negative} data-selected={currentId === effect.id}
          aria-expanded={currentId === effect.id} aria-label={`${effect.name}. ${effect.duration}${effect.stacks > 1 || effect.decay ? `. Зарядов: ${effect.stacks}` : ''}`}
          title={`${effect.name} · ${effect.duration}`} onClick={() => {
            if (onInspectEffect) onInspectEffect(effect);
            else setLocalId(previous => previous === effect.id ? null : effect.id);
          }}>
          <AuraIcon id={effect.icon} visual={effect.definition?.visual} size={32} />
          {(effect.stacks > 1 || effect.decay) && <span className="character-effect-button-count" aria-hidden="true">{effect.stacks}</span>}
        </button>
      </li>)}</ul>
      {localEffect && <div className="character-effects-compact-details"><CharacterEffectDetails effect={localEffect} content={content} /></div>}
    </section>;
  }
  return <section className="character-effects" aria-labelledby={heading}>
    <header className="character-effects-heading"><h3 id={heading}>Эффекты{effects.length > 0 && <span>{effects.length}</span>}</h3><p>Действуют только в бою</p></header>
    {effects.length ? <><ul className="character-effects-list">{effects.map(effect => <li key={effect.id}><CharacterEffectDetails effect={effect} content={content} /></li>)}</ul>{hasDice && <div className="character-effects-legend"><DiceLegend rules={effects.flatMap(effect => rulesFor(effect, content))} /></div>}</>
      : <p className="character-effects-empty">Нет наложенных эффектов</p>}
  </section>;
}
