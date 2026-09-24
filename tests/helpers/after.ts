/**
 * @file tests/helpers/after.ts
 * @desc Stand-in for Next's after() in integration tests (tests/setup/integration.ts mocks
 *       next/server with it): work scheduled after a response waits in a queue until the test
 *       calls flushAfter(), and is dropped before each test. Nothing runs by accident, so tests
 *       that don't care never reach the mirror or osu!.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

type Task = () => unknown;

const queue: Task[] = [];

/**
 * @function queueAfter
 * @param task {Task | Promise<unknown>} what after() was given
 * @returns {void} queues it
 */
export const queueAfter = (task: Task | Promise<unknown>): void => {
  queue.push(typeof task === "function" ? task : () => task);
};

/**
 * @function pendingAfter
 * @returns {number} tasks waiting
 */
export const pendingAfter = (): number => queue.length;

/**
 * @function flushAfter
 * @returns {Promise<void>} runs every queued task in order (and any they queue), awaiting each
 */
export const flushAfter = async (): Promise<void> => {
  for (let task = queue.shift(); task; task = queue.shift()) await task();
};

/**
 * @function clearAfter
 * @returns {void} drops every queued task
 */
export const clearAfter = (): void => {
  queue.length = 0;
};
