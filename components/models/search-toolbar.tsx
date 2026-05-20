"use client";

import { ArrowDownWideNarrow, Grid2X2, List, Search } from "lucide-react";

import { ModelStatus, ModelType } from "@/types/model";

type SortOption = "recent" | "usage_desc" | "usage_asc" | "name_asc" | "provider";

type SearchToolbarProps = {
  searchValue: string;
  statusFilter: "ALL" | ModelStatus;
  providerFilter: string;
  typeFilter: "ALL" | ModelType;
  sortBy: SortOption;
  compactCards: boolean;
  providerOptions: string[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "ALL" | ModelStatus) => void;
  onProviderChange: (value: string) => void;
  onTypeChange: (value: "ALL" | ModelType) => void;
  onSortChange: (value: SortOption) => void;
  onToggleLayout: () => void;
  onReset: () => void;
};

const statusOptions: Array<{ label: string; value: "ALL" | ModelStatus }> = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Idle", value: "IDLE" },
  { label: "Offline", value: "OFFLINE" },
  { label: "Error", value: "ERROR" },
  { label: "Updating", value: "UPDATING" }
];

const typeOptions: Array<{ label: string; value: "ALL" | ModelType }> = [
  { label: "All Types", value: "ALL" },
  { label: "API", value: "API" },
  { label: "Local", value: "LOCAL" }
];

const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: "Sort: Recently Added", value: "recent" },
  { label: "Sort: Usage High-Low", value: "usage_desc" },
  { label: "Sort: Usage Low-High", value: "usage_asc" },
  { label: "Sort: Name", value: "name_asc" },
  { label: "Sort: Provider", value: "provider" }
];

export function SearchToolbar({
  searchValue,
  statusFilter,
  providerFilter,
  typeFilter,
  sortBy,
  compactCards,
  providerOptions,
  onSearchChange,
  onStatusChange,
  onProviderChange,
  onTypeChange,
  onSortChange,
  onToggleLayout,
  onReset
}: SearchToolbarProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto_auto]">
      <label className="flex h-11 items-center gap-2 rounded-lg border border-cyan-900/40 bg-sky-950/40 px-3">
        <Search className="h-4 w-4 text-cyan-700" />
        <input
          className="w-full bg-transparent text-sm text-cyan-100 outline-none placeholder:text-cyan-700"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search models..."
          value={searchValue}
        />
      </label>

      <select
        className="h-11 rounded-lg border border-cyan-900/40 bg-sky-950/40 px-3 text-sm text-cyan-200 outline-none focus:border-cyan-500/60"
        onChange={(event) => onStatusChange(event.target.value as "ALL" | ModelStatus)}
        value={statusFilter}
      >
        {statusOptions.map((option) => (
          <option className="bg-[#071523]" key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        className="h-11 rounded-lg border border-cyan-900/40 bg-sky-950/40 px-3 text-sm text-cyan-200 outline-none focus:border-cyan-500/60"
        onChange={(event) => onProviderChange(event.target.value)}
        value={providerFilter}
      >
        <option className="bg-[#071523]" value="ALL">
          All Providers
        </option>
        {providerOptions.map((provider) => (
          <option className="bg-[#071523]" key={provider} value={provider}>
            {provider}
          </option>
        ))}
      </select>

      <select
        className="h-11 rounded-lg border border-cyan-900/40 bg-sky-950/40 px-3 text-sm text-cyan-200 outline-none focus:border-cyan-500/60"
        onChange={(event) => onTypeChange(event.target.value as "ALL" | ModelType)}
        value={typeFilter}
      >
        {typeOptions.map((option) => (
          <option className="bg-[#071523]" key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="flex h-11 items-center gap-2 rounded-lg border border-cyan-900/40 bg-sky-950/40 px-3 text-cyan-400">
        <ArrowDownWideNarrow className="h-4 w-4" />
        <select
          className="bg-transparent text-sm text-cyan-200 outline-none"
          onChange={(event) => onSortChange(event.target.value as SortOption)}
          value={sortBy}
        >
          {sortOptions.map((option) => (
            <option className="bg-[#071523]" key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        className="inline-flex h-11 items-center justify-center rounded-lg border border-cyan-900/40 bg-sky-950/40 px-3 text-cyan-200 transition hover:border-cyan-500/50 hover:text-cyan-100"
        onClick={onToggleLayout}
        type="button"
      >
        {compactCards ? <List className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
      </button>

      <button
        className="h-11 rounded-lg border border-cyan-900/40 bg-sky-950/35 px-3 text-sm text-cyan-300 transition hover:border-cyan-500/60 hover:text-cyan-100"
        onClick={onReset}
        type="button"
      >
        Reset
      </button>
    </div>
  );
}
