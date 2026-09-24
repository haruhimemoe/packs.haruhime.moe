/**
 * @file src/components/packs/PackFilterBar.tsx
 * @desc The /packs filter bar, laid out like the osu! beatmap listing: the search box and sort on
 *       top, then a panel of labeled rows (star rating, mods, length, BPM, mode, map count) with
 *       the live result count and "Clear filters". Controlled: it shows `filters` and reports
 *       every change. Built from the @haruhimemoe/ui filter components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { RULESETS, type Ruleset } from "@haruhimemoe/pool";
import {
  ChipGroup,
  type ChipOption,
  FilterPanel,
  FilterRow,
  RangeSlider,
  Select,
  TextInput,
} from "@haruhimemoe/ui";
import { type ReactNode, useId } from "react";
import {
  BPM_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  MODE_LABELS,
  PACK_SORT_LABELS,
  PACK_SORTS,
  STAR_RANGE,
} from "@/constants/pack-filters";
import { STAT_MOD_CODES, type StatModCode } from "@/constants/pack-stats";
import {
  clearFilters,
  formatLengthText,
  hasFilters,
  normalizeRange,
  type PackFilters,
  parseLengthText,
} from "@/utils/pack-filters";

const MOD_OPTIONS: readonly ChipOption[] = STAT_MOD_CODES.map((code) => ({
  value: code,
  label: code,
}));

const MODE_OPTIONS: readonly ChipOption[] = RULESETS.map((ruleset) => ({
  value: ruleset,
  label: MODE_LABELS[ruleset],
}));

type RangeKey = "sr" | "len" | "bpm" | "maps";

/** A range row: its label, the words its two ends are named with, bounds and display. */
type RangeRowSpec = {
  key: RangeKey;
  label: string;
  noun: string;
  bounds: FilterBounds;
  format?: (n: number) => string;
  parse?: (text: string) => number | null;
};

const STAR_ROW: RangeRowSpec = {
  key: "sr",
  label: "Star rating",
  noun: "star rating",
  bounds: STAR_RANGE,
};

const LENGTH_ROW: RangeRowSpec = {
  key: "len",
  label: "Length",
  noun: "length",
  bounds: LENGTH_RANGE,
  format: formatLengthText,
  parse: parseLengthText,
};

const BPM_ROW: RangeRowSpec = { key: "bpm", label: "BPM", noun: "BPM", bounds: BPM_RANGE };

const MAPS_ROW: RangeRowSpec = {
  key: "maps",
  label: "Maps",
  noun: "maps",
  bounds: MAP_COUNT_RANGE,
};

/** Keep only values from `allowed`, typed as its members. */
const pick = <T extends string>(values: readonly string[], allowed: readonly T[]): T[] =>
  allowed.filter((value) => values.includes(value));

type PackFilterBarProps = {
  filters: PackFilters;
  onChange: (next: PackFilters) => void;
  /** The live result count (announced politely). */
  resultCount?: ReactNode;
  /** Called when the search box gets focus (the page starts loading the index then). */
  onSearchFocus?: () => void;
};

export function PackFilterBar({
  filters,
  onChange,
  resultCount,
  onSearchFocus,
}: PackFilterBarProps) {
  const searchId = useId();
  const sortId = useId();
  const set = (patch: Partial<PackFilters>) => onChange({ ...filters, ...patch });

  const rangeRow = ({ key, label, noun, bounds, format, parse }: RangeRowSpec) => (
    <FilterRow label={label}>
      <RangeSlider
        label={label}
        hideLabel
        minLabel={`Minimum ${noun}`}
        maxLabel={`Maximum ${noun}`}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        openEnded
        value={filters[key] ?? [bounds.min, null]}
        onChange={(value) => set({ [key]: normalizeRange(value, bounds) })}
        format={format}
        parse={parse}
      />
    </FilterRow>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextInput
          id={searchId}
          label="Search public packs"
          type="search"
          value={filters.q}
          placeholder="Pack name, host, or description"
          onFocus={onSearchFocus}
          onChange={(event) => set({ q: event.target.value })}
          wrapperClassName="min-w-0 flex-1"
        />
        <Select
          id={sortId}
          label="Sort by"
          value={filters.sort}
          onChange={(event) => {
            const sort = PACK_SORTS.find((value) => value === event.target.value);
            if (sort) set({ sort });
          }}
          wrapperClassName="sm:w-60"
        >
          {PACK_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {PACK_SORT_LABELS[sort]}
            </option>
          ))}
        </Select>
      </div>
      <FilterPanel
        title="Filters"
        resultCount={resultCount}
        active={hasFilters(filters)}
        onClear={() => onChange(clearFilters(filters))}
      >
        {rangeRow(STAR_ROW)}
        <FilterRow label="Mods">
          <ChipGroup
            label="Mods"
            hideLabel
            options={MOD_OPTIONS}
            value={filters.mods}
            onChange={(value) => set({ mods: pick<StatModCode>(value, STAT_MOD_CODES) })}
          />
        </FilterRow>
        {rangeRow(LENGTH_ROW)}
        {rangeRow(BPM_ROW)}
        <FilterRow label="Mode">
          <ChipGroup
            label="Mode"
            hideLabel
            options={MODE_OPTIONS}
            value={filters.mode}
            onChange={(value) => set({ mode: pick<Ruleset>(value, RULESETS) })}
          />
        </FilterRow>
        {rangeRow(MAPS_ROW)}
      </FilterPanel>
    </div>
  );
}
