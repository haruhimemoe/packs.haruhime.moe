/**
 * @file src/lib/osu/budget.ts
 * @desc The osu! API budget, on @haruhimemoe/next-kit's createBudget over rate_limits: every call
 *       counts against OSU_API_BUDGET (50 a minute across all instances). Visitors (a per-IP
 *       subject, or a saver's) also pay their own share (OSU_API_BUDGET_PER_IP, 20) and a pool
 *       all visitors share (OSU_API_BUDGET_VISITORS, 30), so visitors can never take the minutes
 *       server work needs. Server work (the cron and /admin job, no subject) pays only the global
 *       count; the pools service pays its own share (POOLS_SYNC_SUBJECT) and the global count.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { createBudget, rateLimitId, windowFor } from "@haruhimemoe/next-kit/server";
import { POOLS_SYNC_SUBJECT } from "@/constants/pools";
import {
  OSU_API_BUDGET,
  OSU_API_BUDGET_PER_IP,
  OSU_API_BUDGET_VISITORS,
} from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";

const everyone = createBudget({ db: connectedDb, global: OSU_API_BUDGET });
const server = createBudget({
  db: connectedDb,
  global: OSU_API_BUDGET,
  perSubject: OSU_API_BUDGET_PER_IP,
});
const visitors = createBudget({
  db: connectedDb,
  global: OSU_API_BUDGET_VISITORS,
  globalSubject: OSU_API_BUDGET_VISITORS.subject,
  perSubject: OSU_API_BUDGET_PER_IP,
});

/**
 * @function isServerSubject
 * @param subject {string | undefined} who a call is for
 * @returns {boolean} true for server work: no subject (the stats job) or the pools service
 */
export const isServerSubject = (subject: string | undefined): boolean =>
  subject === undefined || subject === POOLS_SYNC_SUBJECT;

/**
 * @function takeOsuBudget
 * @param subject {string | undefined} a visitor's counter subject, POOLS_SYNC_SUBJECT, or none
 * @param nowMs {number} the time to count at (default now)
 * @returns {Promise<boolean>} whether one osu! call may go ahead; a refusal counts nothing past
 *          the first budget that said no
 * @throws when the counter can't be reached (callers treat that as a no)
 */
export const takeOsuBudget = async (
  subject: string | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> => {
  if (isServerSubject(subject)) return server.take(subject, nowMs);
  return (await visitors.take(subject, nowMs)) && everyone.take(undefined, nowMs);
};

/**
 * @function osuBudgetGate
 * @param subject {string | undefined} as for takeOsuBudget
 * @returns {() => Promise<boolean>} a `beforeCall` for @haruhimemoe/osu that stays no after its
 *          first no (or a counter it can't reach), so later calls don't push the counts further
 */
export const osuBudgetGate = (subject: string | undefined): (() => Promise<boolean>) => {
  let refused = false;
  return async () => {
    if (refused) return false;
    try {
      if (await takeOsuBudget(subject)) return true;
    } catch (error) {
      console.error("[osu] budget counter unavailable:", error);
    }
    refused = true;
    return false;
  };
};

/**
 * @function osuBudgetWindow
 * @param nowMs {number} a time
 * @returns {{ id: string; expiresAt: Date }} the global counter's id and expiry for that minute
 */
export const osuBudgetWindow = (nowMs: number): { id: string; expiresAt: Date } => ({
  id: rateLimitId(OSU_API_BUDGET, OSU_API_BUDGET.subject, nowMs),
  expiresAt: windowFor(OSU_API_BUDGET, nowMs).expiresAt,
});

/**
 * @function osuSubjectWindow
 * @param subject {string} a counter subject
 * @param nowMs {number} a time
 * @returns {{ id: string; expiresAt: Date }} that subject's share counter for that minute
 */
export const osuSubjectWindow = (
  subject: string,
  nowMs: number,
): { id: string; expiresAt: Date } => ({
  id: rateLimitId(OSU_API_BUDGET_PER_IP, subject, nowMs),
  expiresAt: windowFor(OSU_API_BUDGET_PER_IP, nowMs).expiresAt,
});

/**
 * @function osuVisitorsWindow
 * @param nowMs {number} a time
 * @returns {{ id: string; expiresAt: Date }} the shared visitors counter for that minute
 */
export const osuVisitorsWindow = (nowMs: number): { id: string; expiresAt: Date } => ({
  id: rateLimitId(OSU_API_BUDGET_VISITORS, OSU_API_BUDGET_VISITORS.subject, nowMs),
  expiresAt: windowFor(OSU_API_BUDGET_VISITORS, nowMs).expiresAt,
});
