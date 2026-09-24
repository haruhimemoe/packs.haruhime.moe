/**
 * @file src/utils/shuffle.ts
 * @desc Fisher-Yates shuffle into a new array, with the random source passed in so tests can
 *       repeat an order.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

/**
 * @function shuffled
 * @param items {readonly T[]} the list (left alone)
 * @param random {() => number} a number in [0, 1), like Math.random
 * @returns {T[]} the same items in a random order
 */
export const shuffled = <T>(items: readonly T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};
