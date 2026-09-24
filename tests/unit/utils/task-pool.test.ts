/**
 * @file tests/unit/utils/task-pool.test.ts
 * @desc runPool: bounded concurrency, every item processed, start order kept. oneAtATime: one call
 *       at a time, in order, past failures.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { oneAtATime, runPool } from "@/utils/task-pool";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("runPool", () => {
  it("runs every item with at most N in flight", async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (item) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      seen.push(item);
      active--;
    });
    expect(peak).toBe(4);
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("starts items in list order", async () => {
    const started: number[] = [];
    await runPool(["a", "b", "c"], 2, async (_item, index) => {
      started.push(index);
      await tick();
    });
    expect(started).toEqual([0, 1, 2]);
  });

  it("handles an empty list and a pool wider than the list", async () => {
    await expect(runPool([], 4, async () => undefined)).resolves.toBeUndefined();
    let calls = 0;
    await runPool([1], 8, async () => {
      calls++;
    });
    expect(calls).toBe(1);
  });
});

describe("oneAtATime", () => {
  it("runs one call at a time, in call order", async () => {
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    const work = oneAtATime(async (n: number) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      order.push(n);
      active--;
      return n * 2;
    });
    expect(await Promise.all([work(1), work(2), work(3)])).toEqual([2, 4, 6]);
    expect(order).toEqual([1, 2, 3]);
    expect(peak).toBe(1);
  });

  it("keeps going after a call fails", async () => {
    const work = oneAtATime(async (n: number) => {
      if (n === 1) throw new Error("no");
      return n;
    });
    const first = work(1);
    const second = work(2);
    await expect(first).rejects.toThrow("no");
    await expect(second).resolves.toBe(2);
  });
});
