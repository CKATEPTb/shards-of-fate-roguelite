/** Wilson interval: honest uncertainty even for zero/all wins in a small sample. */
export function winInterval(wins: number, trials: number): [number, number] {
  if (!Number.isInteger(wins) || !Number.isInteger(trials) || trials < 0 || wins < 0 || wins > trials) throw new Error('Invalid win sample');
  if (!trials) return [0, 1];
  const z = 1.959963984540054;
  const rate = wins / trials;
  const divisor = 1 + z * z / trials;
  const center = (rate + z * z / (2 * trials)) / divisor;
  const spread = z * Math.sqrt(rate * (1 - rate) / trials + z * z / (4 * trials * trials)) / divisor;
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
}

export function quantile(values: readonly number[], fraction: number): number | null {
  if (fraction < 0 || fraction > 1) throw new Error('Quantile must be in [0, 1]');
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = fraction * (sorted.length - 1);
  const low = Math.floor(position);
  return sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low);
}

export function numericSummary(values: readonly number[]) {
  return { count: values.length, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    p10: quantile(values, .1), median: quantile(values, .5), p90: quantile(values, .9) };
}

/** The same seed/party is played at both settings; discordant pairs determine uncertainty. */
export function pairedWinDifference(pairs: readonly (readonly [boolean, boolean])[]) {
  const easierOnly = pairs.filter(([a, b]) => a && !b).length;
  const harderOnly = pairs.filter(([a, b]) => !a && b).length;
  const n = pairs.length;
  const difference = n ? (easierOnly - harderOnly) / n : 0;
  const variance = n > 1 ? ((easierOnly + harderOnly) / n - difference ** 2) / (n - 1) : 0;
  // A constant observed difference has zero sample variance, not zero population
  // uncertainty. Wilson's zero-event upper bound supplies a finite-sample floor.
  const margin = Math.max(1.959963984540054 * Math.sqrt(Math.max(0, variance)), winInterval(0, n)[1]);
  return { pairs: n, easierOnly, harderOnly, difference,
    confidence95: n > 1 ? [Math.max(-1, difference - margin), Math.min(1, difference + margin)] : [-1, 1] };
}
