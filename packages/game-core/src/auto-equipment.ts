import { equipmentBodyPartsForSlot, equipmentItemFitsSlot, occupiedHandSlots, resolveEquipmentItem, baseEquipmentItemId,
  type EquipmentSlot, type GameContent, type HeroBody, type HeroProgress, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { equipmentCondition } from './anatomy/equipment';
import { createEquipmentScorer } from './auto-equipment-score';

export type AutoEquipmentSelection =
  | { slot: EquipmentSlot; inventoryId: string }
  | { slot: EquipmentSlot; equippedSlot: EquipmentSlot; itemId: string };

export interface AutoEquipmentResult {
  equipment: AutoEquipmentSelection[];
  changed: boolean;
  beforeScore: number;
  afterScore: number;
  luckWeight: number;
}

const SLOTS: readonly EquipmentSlot[] = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'];
const GLOBAL_OPTIONS = 5, SET_OPTIONS = 2, BUNDLE_WIDTH = 4, OUTFIT_WIDTH = 24, SCORE_LIMIT = 10_000;
const EPSILON = 0.000001;
type Threshold = 2 | 4 | 6;
interface Candidate {
  selection: AutoEquipmentSelection;
  item: StarterEquipment;
  source: string;
  baseId: string;
  mask: number;
  rank: number;
  slotIndex: number;
  outfitKey: string;
  sourceKey: string;
}
interface Bundle { setId: string; picks: Candidate[]; mask: number; rank: number }
interface ScoredOutfit { picks: Candidate[]; score: number; key: string; changes: number }
interface Seed { outfit: ScoredOutfit; locked: Candidate[] }
interface PackingState extends Seed { setIds: string[]; mask: number }
interface BundleState { picks: Candidate[]; mask: number; rank: number; key: string }
const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const slotBit = (slot: EquipmentSlot): number => 1 << SLOTS.indexOf(slot);
const outfitKey = (picks: readonly Candidate[]): string => [...picks].sort((a, b) => a.slotIndex - b.slotIndex)
  .map(pick => pick.outfitKey).join('|');
const compareCandidates = (a: Candidate, b: Candidate): number => b.rank - a.rank || lexical(a.source, b.source);

function replace(base: readonly Candidate[], additions: readonly Candidate[]): Candidate[] {
  // Beam expansion replaces one candidate thousands of times. Its result can
  // be kept in slot order without building a Set or sorting each proposal.
  if (additions.length === 1) {
    const candidate = additions[0], result: Candidate[] = [];
    let inserted = false, ordered = true, previousSlot = -1;
    for (const current of base) {
      if (current.mask & candidate.mask || current.source === candidate.source) continue;
      if (current.slotIndex < previousSlot) ordered = false;
      previousSlot = current.slotIndex;
      if (!inserted && current.slotIndex > candidate.slotIndex) { result.push(candidate); inserted = true; }
      result.push(current);
    }
    if (!inserted) result.push(candidate);
    // A saved initial outfit may list its slots in a different order.
    if (!ordered) result.sort((a, b) => a.slotIndex - b.slotIndex);
    return result;
  }
  const mask = additions.reduce((sum, item) => sum | item.mask, 0);
  const sources = new Set(additions.map(item => item.source));
  return [...base.filter(item => !(item.mask & mask) && !sources.has(item.source)), ...additions]
    .sort((a, b) => a.slotIndex - b.slotIndex);
}

function compareOutfits(a: ScoredOutfit, b: ScoredOutfit): number {
  return Math.abs(a.score - b.score) > EPSILON ? b.score - a.score : a.changes - b.changes || lexical(a.key, b.key);
}

/** Keep alternate anatomical placements and physical copies, not just rarities. */
function insertCandidate(options: Candidate[], candidate: Candidate, limit: number): void {
  options.push(candidate); options.sort(compareCandidates);
  if (options.length > limit) options.length = limit;
}

/** Bounded joint search: complete set bundles survive intermediate stat losses. */
export function optimizeEquipment(hero: UnitDefinition, progress: HeroProgress, content: GameContent, body?: HeroBody, partySize?: number): AutoEquipmentResult {
  const scorer = createEquipmentScorer(hero, progress, content, body, partySize);
  const catalog = content.equipmentCatalog;
  const originalSelections: AutoEquipmentSelection[] = progress.equipment.map(entry => ({ slot: entry.slot, equippedSlot: entry.slot, itemId: entry.itemId }));
  const unchanged = (score: number): AutoEquipmentResult => ({ equipment: originalSelections, changed: false, beforeScore: score, afterScore: score, luckWeight: scorer.luckWeight });
  if (!catalog || !hero.anatomy) return unchanged(0);
  const resolved = new Map<string, ReturnType<typeof resolveEquipmentItem>>();
  const itemFor = (id: string) => {
    if (!resolved.has(id)) resolved.set(id, resolveEquipmentItem(catalog.items, id));
    return resolved.get(id);
  };
  const emptyScore = scorer.score([]);
  const singleRanks = new Map<string, number>();
  const materialized = new Map<string, StarterEquipment>();
  const materialize = (id: string, slot: EquipmentSlot): StarterEquipment | undefined => {
    const key = `${id}:${slot}`, existing = materialized.get(key);
    if (existing) return existing;
    const item = itemFor(id);
    if (!item || !equipmentItemFitsSlot(item, slot)) return;
    const result = { ...item, slot, bodyParts: equipmentBodyPartsForSlot(item, slot) };
    materialized.set(key, result);
    return result;
  };
  const candidateFor = (id: string, slot: EquipmentSlot, selection: AutoEquipmentSelection): Candidate | undefined => {
    const item = materialize(id, slot);
    if (!item) return;
    const rankKey = `${id}:${slot}`;
    if (!singleRanks.has(rankKey)) singleRanks.set(rankKey, scorer.score([item]) - emptyScore);
    const source = 'inventoryId' in selection ? `inventory:${selection.inventoryId}` : `equipped:${selection.equippedSlot}:${id}`;
    return { item, selection, rank: singleRanks.get(rankKey)!, baseId: baseEquipmentItemId(id),
      source, slotIndex: SLOTS.indexOf(slot), outfitKey: `${slot}:${item.id}`, sourceKey: `${slot}:${source}`,
      mask: occupiedHandSlots(item).reduce((mask, hand) => mask | slotBit(hand), slotBit(slot)) };
  };
  const initial = progress.equipment.flatMap(entry => {
    const candidate = candidateFor(entry.itemId, entry.slot, { slot: entry.slot, equippedSlot: entry.slot, itemId: entry.itemId });
    return candidate ? [candidate] : [];
  });
  // A malformed catalogue must never make an existing item disappear from a plan.
  if (initial.length !== progress.equipment.length) return unchanged(0);
  const beforeScore = scorer.score(initial.map(candidate => candidate.item));
  const global = new Map<EquipmentSlot, Candidate[]>(SLOTS.map(slot => [slot, []]));
  const sets = new Map<string, Map<EquipmentSlot, Candidate[]>>();
  const copies = new Map<string, number>();
  const available = [
    ...progress.equipment.map(entry => ({ id: entry.itemId, source: { equippedSlot: entry.slot, itemId: entry.itemId } })),
    ...(progress.inventory ?? []).filter(entry => entry.kind === 'equipment').map(entry => ({ id: entry.definitionId, source: { inventoryId: entry.id } })),
  ];
  for (const owned of available) {
    const count = copies.get(owned.id) ?? 0;
    // Only hands and rings accept repeated copies, with at most two worn at once.
    if (count >= 2) continue;
    copies.set(owned.id, count + 1);
    for (const slot of SLOTS) {
      const candidate = candidateFor(owned.id, slot, { ...owned.source, slot });
      if (!candidate) continue;
      const item = candidate.item;
      if (body && (item.weapon ? item.bodyParts.some(part => body[part].lost)
        : item.bodyParts.length > 0 && item.bodyParts.every(part => body[part].lost))) continue;
      insertCandidate(global.get(slot)!, candidate, GLOBAL_OPTIONS);
      if (!item.setId || !catalog.sets[item.setId]?.bonuses?.length || body && !equipmentCondition(item, body).active) continue;
      let bySlot = sets.get(item.setId);
      if (!bySlot) { bySlot = new Map(SLOTS.map(slot => [slot, []])); sets.set(item.setId, bySlot); }
      const options = bySlot.get(slot)!;
      // A rarity variant or second physical copy cannot add another set piece.
      const previous = options.findIndex(option => option.baseId === candidate.baseId);
      if (previous >= 0) {
        if (compareCandidates(candidate, options[previous]) >= 0) continue;
        options.splice(previous, 1);
      }
      insertCandidate(options, candidate, SET_OPTIONS);
    }
  }

  const initialBySlot = new Map(initial.map(candidate => [candidate.item.slot, candidate.item.id]));
  const scores = new Map([[outfitKey(initial), { score: beforeScore, changes: 0 }]]);
  let evaluations = 0;
  // Reserve room for combining sets and completing their remaining free slots.
  let evaluationLimit = SCORE_LIMIT - 4_000;
  const evaluate = (picks: Candidate[]): ScoredOutfit | undefined => {
    const key = outfitKey(picks);
    let cached = scores.get(key);
    if (!cached) {
      if (evaluations >= evaluationLimit) return;
      const score = scorer.score(picks.map(candidate => candidate.item));
      let changes = initialBySlot.size;
      for (const candidate of picks) {
        const previous = initialBySlot.get(candidate.item.slot);
        if (previous === undefined) changes++;
        else if (previous === candidate.item.id) changes--;
      }
      cached = { score, changes };
      scores.set(key, cached); evaluations++;
    }
    return { picks, score: cached.score, key, changes: cached.changes };
  };
  const original = evaluate(initial)!;
  let best = original;
  const consider = (outfit: ScoredOutfit) => { if (compareOutfits(outfit, best) < 0) best = outfit; };

  const fill = (seed: Seed): ScoredOutfit => {
    const lockedMask = seed.locked.reduce((mask, candidate) => mask | candidate.mask, 0);
    const lockedSources = new Set(seed.locked.map(candidate => candidate.source));
    let beam = [seed.outfit];
    for (const slot of SLOTS) {
      if (lockedMask & slotBit(slot)) continue;
      const next = new Map(beam.map(outfit => [outfit.key, outfit]));
      for (const outfit of beam) for (const candidate of global.get(slot)!) {
        if (candidate.mask & lockedMask || lockedSources.has(candidate.source)) continue;
        if (outfit.picks.some(pick => pick.source === candidate.source && pick.item.slot === candidate.item.slot)) continue;
        const proposed = evaluate(replace(outfit.picks, [candidate]));
        if (!proposed) continue;
        const previous = next.get(proposed.key);
        if (!previous || compareOutfits(proposed, previous) < 0) next.set(proposed.key, proposed);
      }
      beam = [...next.values()].sort(compareOutfits).slice(0, OUTFIT_WIDTH);
      beam.forEach(consider);
      if (evaluations >= evaluationLimit) break;
    }
    return beam[0];
  };
  const foundation = fill({ outfit: original, locked: [] });
  const seeds: Seed[] = [{ outfit: original, locked: [] }, { outfit: foundation, locked: [] }];
  const baselineRank = (candidate: Candidate): number => candidate.rank - foundation.picks
    .filter(current => current.mask & candidate.mask || current.source === candidate.source).reduce((sum, current) => sum + current.rank, 0);
  const bundleCache = new Map<string, Map<Threshold, Bundle[]>>();

  const bundlesFor = (setId: string, blockedMask = 0): Map<Threshold, Bundle[]> => {
    const cacheKey = `${setId}:${blockedMask}`;
    const cached = bundleCache.get(cacheKey);
    if (cached) return cached;
    const result = new Map<Threshold, Bundle[]>();
    const bySlot = sets.get(setId);
    if (!bySlot) return result;
    let beam: BundleState[] = [{ picks: [], mask: 0, rank: 0, key: '' }];
    for (const slot of SLOTS) {
      if (blockedMask & slotBit(slot)) continue;
      const buckets = new Map<number, BundleState[]>();
      const add = (state: BundleState) => {
        const count = state.picks.length;
        const bucket = buckets.get(count) ?? [];
        if (!bucket.some(other => other.key === state.key)) bucket.push(state);
        bucket.sort((a, b) => b.rank - a.rank || lexical(a.key, b.key));
        if (bucket.length > BUNDLE_WIDTH) bucket.length = BUNDLE_WIDTH;
        buckets.set(count, bucket);
      };
      for (const state of beam) {
        add(state);
        if (state.picks.length >= 6 || state.mask & slotBit(slot)) continue;
        for (const candidate of bySlot.get(slot)!) {
          if (candidate.mask & (blockedMask | state.mask) || state.picks.some(pick => pick.source === candidate.source || pick.baseId === candidate.baseId)) continue;
          add({ picks: [...state.picks, candidate], mask: state.mask | candidate.mask, rank: state.rank + baselineRank(candidate),
            key: state.key ? `${state.key}|${candidate.sourceKey}` : candidate.sourceKey });
        }
      }
      beam = [...buckets.values()].flat();
    }
    for (const pieces of [2, 4, 6] as const) result.set(pieces, beam.filter(state => state.picks.length === pieces)
      .slice(0, 2).map(state => ({ ...state, setId })));
    bundleCache.set(cacheKey, result);
    return result;
  };

  const rankedBundles = new Map<Threshold, Array<{ bundle: Bundle; outfit: ScoredOutfit }>>([[2, []], [4, []], [6, []]]);
  const record = (locked: Candidate[]): ScoredOutfit | undefined => {
    const outfit = evaluate(replace(foundation.picks, locked));
    if (outfit) { consider(outfit); seeds.push({ outfit, locked }); }
    return outfit;
  };
  // Every set retains representatives until its reachable thresholds are evaluated.
  // No sequence of individually improving swaps is required to reach six pieces.
  for (const setId of [...sets.keys()].sort(lexical)) {
    for (const pieces of [2, 4, 6] as const) for (const bundle of bundlesFor(setId).get(pieces) ?? []) {
      const outfit = record(bundle.picks);
      if (outfit) rankedBundles.get(pieces)!.push({ bundle, outfit });
    }
    if (evaluations >= evaluationLimit) break;
  }
  for (const entries of rankedBundles.values()) entries.sort((a, b) => compareOutfits(a.outfit, b.outfit) || lexical(a.bundle.setId, b.bundle.setId));
  const setsFor = (pieces: Threshold, count: number): string[] => [...new Set(rankedBundles.get(pieces)!.map(entry => entry.bundle.setId))].slice(0, count);

  // Consider promising sets from every threshold, rather than letting plentiful
  // pairs crowd six-piece auras out of the bounded packing search.
  const shortlists = [setsFor(6, 6), setsFor(4, 8), setsFor(2, 10)];
  const packingSets: string[] = [];
  for (let index = 0; index < 10 && packingSets.length < 12; index++) for (const shortlist of shortlists) {
    const id = shortlist[index];
    if (id && !packingSets.includes(id) && packingSets.length < 12) packingSets.push(id);
  }
  const selectPacking = (states: PackingState[]): PackingState[] => {
    const buckets = new Map<number, PackingState[]>();
    for (const state of states) {
      // A full outfit is already recorded; it needs no further bundle expansion.
      if (state.locked.length >= 10) continue;
      const bucket = buckets.get(state.locked.length) ?? [];
      bucket.push(state); buckets.set(state.locked.length, bucket);
    }
    return [...buckets.values()].flatMap(bucket => {
      bucket.sort((a, b) => compareOutfits(a.outfit, b.outfit));
      const distinct = new Set<string>();
      return bucket.filter(state => {
        const identity = [...state.setIds].sort(lexical).join('|');
        if (distinct.has(identity)) return false;
        distinct.add(identity); return true;
      }).slice(0, 3);
    });
  };
  let packing = selectPacking([...rankedBundles.values()].flatMap(entries => entries
    .filter(entry => packingSets.includes(entry.bundle.setId))
    .map(({ bundle, outfit }) => ({ outfit, locked: bundle.picks, setIds: [bundle.setId], mask: bundle.mask }))));
  evaluationLimit = Math.min(SCORE_LIMIT - 1_000, evaluations + 3_000);
  // Retaining separate piece-count buckets carries small packs through up to
  // five distinct sets. This covers 6+4, 6+2+2, 4+4+2 and five two-piece sets,
  // while hand masks still prevent eleven occupied slots or a shared item.
  for (let depth = 2; depth <= 5 && packing.length && evaluations < evaluationLimit; depth++) {
    const next: PackingState[] = [];
    for (const state of packing) for (const setId of packingSets) {
      if (state.setIds.includes(setId) || evaluations >= evaluationLimit) continue;
      const availableBundles = bundlesFor(setId, state.mask);
      for (const pieces of [6, 4, 2] as const) {
        if (state.locked.length + pieces > 10) continue;
        for (const bundle of availableBundles.get(pieces) ?? []) {
          const locked = [...state.locked, ...bundle.picks];
          const outfit = record(locked);
          if (outfit) next.push({ outfit, locked, setIds: [...state.setIds, setId], mask: state.mask | bundle.mask });
        }
      }
    }
    packing = selectPacking(next);
  }
  evaluationLimit = SCORE_LIMIT;

  const visitedSeeds = new Set<string>();
  let filled = 0;
  for (const seed of seeds.sort((a, b) => compareOutfits(a.outfit, b.outfit))) {
    if (filled >= 12 || evaluations >= evaluationLimit) break;
    const signature = `${seed.outfit.key}:${outfitKey(seed.locked)}`;
    if (visitedSeeds.has(signature)) continue;
    visitedSeeds.add(signature); filled++;
    fill(seed);
  }
  if (best.score <= beforeScore + EPSILON || best.changes === 0) return unchanged(beforeScore);
  return { equipment: best.picks.map(candidate => candidate.selection), changed: true, beforeScore, afterScore: best.score, luckWeight: scorer.luckWeight };
}
