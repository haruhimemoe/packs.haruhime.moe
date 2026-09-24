/**
 * @file src/utils/format.ts
 * @desc Display formatting for beatmap stats.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

/**
 * @function formatDuration
 * @param seconds {number} length in seconds
 * @returns {string} "m:ss"
 */
export const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * @function formatStat
 * @param value {number} CS/AR/OD/HP
 * @returns {string} at most one decimal, float noise removed
 */
export const formatStat = (value: number): string => String(Math.round(value * 10) / 10);

/**
 * @function formatBpm
 * @param bpm {number} beats per minute
 * @returns {string} whole number
 */
export const formatBpm = (bpm: number): string => String(Math.round(bpm));

/**
 * @function formatStars
 * @param stars {number} star rating
 * @returns {string} two decimals
 */
export const formatStars = (stars: number): string => stars.toFixed(2);

/**
 * @function formatBytes
 * @param bytes {number} size in bytes
 * @returns {string} "512 B", "2.0 KB", "6.6 MB", "15 GB" (1024-based; one decimal under 10)
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

/**
 * @function formatLongDuration
 * @param seconds {number} length in seconds
 * @returns {string} "m:ss" under an hour, "h:mm:ss" from an hour up
 */
export const formatLongDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  if (total < 3600) return formatDuration(total);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
