import { lifeAuras } from './status-catalog-life';
import { elementalAuras } from './status-catalog-elements';
import { mysticAuras } from './status-catalog-mystic';

/** Future items and abilities can apply these definitions without changing any current loadout. */
export const additionalStatuses = [...lifeAuras, ...elementalAuras, ...mysticAuras];
