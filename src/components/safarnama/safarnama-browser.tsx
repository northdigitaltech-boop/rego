"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { StoryCard } from "@/components/safarnama/story-card";
import { TRAVEL_TYPES, STORY_CITIES, type StoryRow } from "@/lib/safarnama";
import { cn } from "@/lib/utils";

export function SafarnamaBrowser({ stories }: { stories: StoryRow[] }) {
  const [query, setQuery] = React.useState("");
  const [city, setCity] = React.useState("all");
  const [type, setType] = React.useState("all");

  const results = React.useMemo(() => {
    return stories.filter((s) => {
      if (city !== "all") {
        const hay = `${s.city ?? ""} ${s.destination ?? ""}`.toLowerCase();
        if (!hay.includes(city.toLowerCase())) return false;
      }
      if (type !== "all" && s.travel_type !== type) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${s.title} ${s.destination ?? ""} ${s.city ?? ""} ${s.author_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stories, query, city, type]);

  return (
    <div>
      {/* Search + selects */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by destination, title or traveller…"
            className="w-full bg-transparent text-sm text-forest focus:outline-none"
          />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="auth-input sm:w-44">
          <option value="all">All cities</option>
          {STORY_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Travel-type chips */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip label="All types" active={type === "all"} onClick={() => setType("all")} />
        {TRAVEL_TYPES.map((t) => (
          <Chip key={t.slug} label={t.label} active={type === t.slug} onClick={() => setType(t.slug)} />
        ))}
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {results.length} stor{results.length === 1 ? "y" : "ies"}
      </p>

      {results.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center text-muted-foreground">
          No stories match your filters yet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-forest-600 bg-forest-600 text-white"
          : "border-border bg-card text-forest hover:border-gold/60 hover:text-gold"
      )}
    >
      {label}
    </button>
  );
}
