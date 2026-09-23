import type { ReactNode } from 'react';
import { normalizeDiceExpression, type DiceRule } from './diceNotation';
import './diceText.css';

export type { DiceRule } from './diceNotation';

/** Repeated expressions can carry separate rules in their occurrence order. */
export function DiceText({ text, rules = [] }: { text: string; rules?: readonly DiceRule[] }) {
  const parts: ReactNode[] = [];
  const seen = new Map<string, number>();
  const expression = /(?<![\p{L}\p{N}_])(?:\d+\s*)?[dд]\s*\d+(?![\p{L}\p{N}_])/giu;
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    const index = match.index!;
    if (index > cursor) parts.push(text.slice(cursor, index));
    const dice = normalizeDiceExpression(match[0]);
    const candidates = rules.filter(rule => normalizeDiceExpression(rule.dice) === dice);
    const occurrence = seen.get(dice) ?? 0;
    const rule = candidates[Math.min(occurrence, candidates.length - 1)];
    seen.set(dice, occurrence + 1);
    const label = rule ? rule.modifiable ? 'Бросок с применимыми бонусами' : 'Сила не добавляется' : 'Бросок кубиков';
    const explanation = `${label}.${rule?.reason ? ` ${rule.reason}` : ''}`;
    parts.push(<span key={index} className={`dice-text-roll ${rule?.modifiable ? 'dice-text-modifiable' : 'dice-text-fixed'}`}
      data-dice={dice} data-modifiable={rule ? String(rule.modifiable) : undefined}
      title={explanation} aria-label={`${match[0]}. ${explanation}`} role="img" tabIndex={0}>{match[0]}</span>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function DiceLegend({ rules }: { rules?: readonly DiceRule[] } = {}) {
  const modifiable = rules === undefined || rules.some(rule => rule.modifiable);
  const fixed = rules === undefined || rules.some(rule => !rule.modifiable);
  const thresholdChecks = rules?.some(rule => !rule.modifiable && normalizeDiceExpression(rule.dice) === '1d20');
  if (!modifiable && !fixed) return null;
  return <div className="dice-legend" aria-label="Обозначения кубиков">
    {modifiable && <span><b className="dice-text-modifiable" aria-hidden="true">1d8</b><span>с бонусами</span></span>}
    {fixed && <span><b className="dice-text-fixed" aria-hidden="true">{thresholdChecks ? '1d20' : '1d4'}</b><span>Сила не добавляется</span></span>}
    {thresholdChecks && <span>Порог проверки зависит от её атрибутов.</span>}
  </div>;
}
