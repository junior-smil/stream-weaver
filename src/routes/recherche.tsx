import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { listTitles } from "@/lib/catalog.functions";
import { TitleCard } from "@/components/title-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/recherche")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Recherche — Popcorn Movies" },
      {
        name: "description",
        content: "Recherchez un film ou une série dans le catalogue Popcorn Movies.",
      },
      { property: "og:title", content: "Recherche — Popcorn Movies" },
      { property: "og:description", content: "Trouvez un film ou une série par son titre." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => listTitles({ data: { q } }),
    enabled: q.trim().length > 0,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="font-display text-4xl sm:text-5xl">Recherche</h1>

      <form
        className="mt-6 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/recherche", search: { q: term.trim() } });
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Titre du film ou de la série"
            className="border-border bg-surface pl-9"
            aria-label="Terme de recherche"
          />
        </div>
        <Button type="submit" className="bg-gradient-primary">
          Rechercher
        </Button>
      </form>

      {q.trim().length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Saisissez un titre pour lancer la recherche.
        </p>
      ) : isFetching ? (
        <p className="mt-10 text-sm text-muted-foreground">Recherche en cours…</p>
      ) : (data?.titles.length ?? 0) === 0 ? (
        <p className="surface-panel mt-10 p-8 text-center text-sm text-muted-foreground">
          Aucun résultat pour « {q} ».
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data?.titles.map((t) => (
            <TitleCard key={t.id} title={t} className="w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
