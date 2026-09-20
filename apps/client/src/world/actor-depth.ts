/** Ground position controls overlap. The local hero wins ties by a fraction of
 * a pixel, without being pulled in front of heroes standing further down. */
export function actorDepth(footY: number, controlled = false): number {
  return 10 + footY + (controlled ? 0.0001 : 0);
}
