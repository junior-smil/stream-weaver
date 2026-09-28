import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listTitles } from "@/lib/catalog.functions";
import { CatalogGrid } from "@/components/catalog-grid";

const seriesQuery = queryOptions({
  queryKey: ["titles", "tv"],
  queryFn: () => listTitles({ data: { kind: "tv" } }),
});

export const Route = createFileRoute("/series")({
  head: () => ({
    meta: [
      { title: "Séries — Popcorn Movies" },
      {
        name: "description",
        content:
          "Toutes les séries du catalogue Popcorn Movies : saisons, épisodes, reprise de lecture et enchaînement automatique.",
      },
      { property: "og:title", content: "Séries — Popcorn Movies" },
      { property: "og:description", content: "Séries avec saisons, épisodes et reprise de lecture." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seriesQuery),
  errorComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
      Le catalogue des séries est momentanément indisponible.
    </p>
  ),
  component: SeriesPage,
});

function SeriesPage() {
  const { data } = useSuspenseQuery(seriesQuery);
  return (
    <CatalogGrid
      heading="Séries"
      intro="Saisons et épisodes, avec reprise de lecture et passage à l'épisode suivant."
      titles={data.titles}
    />
  );
}
