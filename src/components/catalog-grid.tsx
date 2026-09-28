import { useMemo, useState } from "react";
import type { CatalogTitle } from "@/lib/catalog.functions";
import { TitleCard } from "@/components/title-card";

export function CatalogGrid({
  heading,
  intro,
  titles,
}: {
  heading: string;
  intro: string;
  titles: CatalogTitle[];
}) {
  const [genre, setGenre] = useState<string | null>(null);

  const genres = useMemo(() => {
    const set = new Set<string>();
    titles.forEach((t) => t.genres?.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [titles]);

  const filtered = genre ? titles.filter((t) => t.genres?.includes(genre)) : titles;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="font-display text-4xl sm:text-5xl">{heading}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p>

      {genres.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGenre(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              genre === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous les genres
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                genre === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="surface-panel mt-10 p-8 text-center text-sm text-muted-foreground">
          Aucun titre pour cette sélection.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((t) => (
            <TitleCard key={t.id} title={t} className="w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
