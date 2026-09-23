/** Explicit encounter rules; no player action is selected automatically. */
export const COMBAT_RULES: { initiative: 'encounter' | 'round'; escapeTarget: number; escapeScope: 'actor' | 'party' } = {
  initiative: 'encounter',
  escapeTarget: 15,
  escapeScope: 'actor',
};
