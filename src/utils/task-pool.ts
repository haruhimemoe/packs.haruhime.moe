/**
 * @file src/utils/task-pool.ts
 * @desc Run async work over a list with bounded concurrency, and one-at-a-time queues.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

/**
 * @function runPool
 * @param items {readonly T[]} work items, started in order
 * @param concurrency {number} max workers in flight
 * @param worker {(item: T, index: number) => Promise<void>} handles one item; a throw rejects the pool
 * @returns {Promise<void>} resolves when every item is done
 */
export const runPool = async <T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
};

/**
 * @function oneAtATime
 * @param work {(...args: A) => Promise<R>} async work that must not overlap with itself
 * @returns {(...args: A) => Promise<R>} the same work, queued: each call starts once the previous
 *          one has settled, and a failure doesn't block the next call
 */
export const oneAtATime = <A extends unknown[], R>(
  work: (...args: A) => Promise<R>,
): ((...args: A) => Promise<R>) => {
  let tail: Promise<unknown> = Promise.resolve();
  return (...args) => {
    const run = tail.then(() => work(...args));
    tail = run.catch(() => undefined);
    return run;
  };
};
