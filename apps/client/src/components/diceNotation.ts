/** Describes a real roll without changing its dice or its combat resolution. */
export interface DiceRule { dice: string; modifiable: boolean; reason: string }

export const normalizeDiceExpression = (dice: string) => {
  // A literal +2 stays outside the coloured die token in prose.
  const match = /^(\d*)[dд](\d+)(?:[+−-]\d+)?$/iu.exec(dice.replace(/\s/g, ''));
  return match ? `${Number(match[1] || 1)}d${Number(match[2])}` : dice.toLowerCase();
};
