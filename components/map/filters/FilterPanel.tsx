"use client";

import { useMemo } from "react";
import { useMapStore } from "@/lib/map/store";
import type { Startup } from "@/lib/map/types";
import { computeFacets } from "@/lib/map/facets";
import { UTAH_COUNTIES } from "@/lib/map/filterConstants";
import { COLORS } from "@/lib/map/mapConfig";
import { FilterChip } from "./FilterChip";
import { FilterGroup } from "./FilterGroup";

const STAGE_OPTIONS = [
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B+",
  "Series D+",
];
const SIZE_OPTIONS = ["1", "2-10", "11-50", "51-200", "201-500", "200+"];
const SECTION_OPTIONS = [
  "B2B Software",
  "FinTech",
  "Security",
  "Bio/Medical Tech",
  "Energy",
  "Consumer",
  "Marketplaces",
];

interface FilterPanelProps {
  startups: Startup[];
}

type ArrayDim = "stage" | "size" | "section" | "county";

export function FilterPanel({ startups }: FilterPanelProps) {
  const { filters, setFilters, clearFilters } = useMapStore();
  const facets = useMemo(
    () => computeFacets(startups, filters),
    [startups, filters]
  );

  const toggleArrayValue = (dim: ArrayDim, value: string) => {
    const current = filters[dim];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [dim]: next });
  };

  const toggleHiring = () =>
    setFilters({ ...filters, hiring: !filters.hiring });

  const totalActive =
    filters.stage.length +
    filters.size.length +
    filters.section.length +
    filters.county.length +
    (filters.hiring ? 1 : 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            color: COLORS.textDim,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Filters · {facets.totalCount} match
          {facets.totalCount === 1 ? "" : "es"}
        </span>
        {totalActive > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.75rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            clear all
          </button>
        )}
      </div>

      <FilterGroup label="Stage" activeCount={filters.stage.length}>
        {STAGE_OPTIONS.map((value) => (
          <FilterChip
            key={value}
            label={value}
            count={facets.stage.get(value) ?? 0}
            active={filters.stage.includes(value)}
            onClick={() => toggleArrayValue("stage", value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Size" activeCount={filters.size.length}>
        {SIZE_OPTIONS.map((value) => (
          <FilterChip
            key={value}
            label={value}
            count={facets.size.get(value) ?? 0}
            active={filters.size.includes(value)}
            onClick={() => toggleArrayValue("size", value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Sector" activeCount={filters.section.length}>
        {SECTION_OPTIONS.map((value) => (
          <FilterChip
            key={value}
            label={value}
            count={facets.section.get(value) ?? 0}
            active={filters.section.includes(value)}
            onClick={() => toggleArrayValue("section", value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="County" activeCount={filters.county.length}>
        {UTAH_COUNTIES.map((value) => (
          <FilterChip
            key={value}
            label={value}
            count={facets.county.get(value) ?? 0}
            active={filters.county.includes(value)}
            onClick={() => toggleArrayValue("county", value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Hiring" activeCount={filters.hiring ? 1 : 0}>
        <FilterChip
          label="Hiring only"
          count={facets.hiringCount}
          active={filters.hiring}
          onClick={toggleHiring}
        />
      </FilterGroup>
    </div>
  );
}
