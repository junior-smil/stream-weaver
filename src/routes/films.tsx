import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listTitles } from "@/lib/catalog.functions";
import { CatalogGrid } from "@/components/catalog-grid";

const moviesQuery = queryOptions({
  queryKey: ["titles", "movie"],
  queryFn: () => listTitles({ data: { kind: "movie" } }),
});

export const Route = createFileRoute("/films")({
  head: () => ({
    meta: [
      { title: "Films — Popcorn Movies" },
      {
        name: "description",
        content:
          "Tous les films du catalogue Popcorn Movies, filtrables par genre, avec lecture adaptative et sélection de qualité.",
      },
      { property: "og:title", content: "Films — Popcorn Movies" },
      { property: "og:description", content: "Catalogue de films avec lecteur multi-qualité." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(moviesQuery),
  errorComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
      Le catalogue des films est momentanément indisponible.
    </p>
  ),
  component: FilmsPage,
});

function FilmsPage() {
  const { data } = useSuspenseQuery(moviesQuery);
  return (
    <CatalogGrid
      heading="Films"
      intro="Parcourez les films disponibles et filtrez par genre. La qualité proposée dépend des renditions réellement fournies par chaque source."
      titles={data.titles}
    />
  );
}
