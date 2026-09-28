import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Star, Heart, Clock } from "lucide-react";
import { toast } from "sonner";
import { getTitleDetail } from "@/lib/catalog.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { TitleRow } from "@/components/title-card";

const detailQuery = (slug: string) =>
  queryOptions({
    queryKey: ["title-detail", slug],
    queryFn: () => getTitleDetail({ data: { slug } }),
  });

export const Route = createFileRoute("/titre/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(detailQuery(params.slug));
    if (!data.title) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.title) {
      return {
        meta: [{ title: "Titre indisponible — Popcorn Movies" }, { name: "robots", content: "noindex" }],
      };
    }
    const t = loaderData.title;
    const description = (t.overview ?? `Regardez ${t.title} sur Popcorn Movies.`).slice(0, 180);
    const meta: Array<Record<string, string>> = [
      { title: `${t.title} — Popcorn Movies` },
      { name: "description", content: description },
      { property: "og:title", content: `${t.title} — Popcorn Movies` },
      { property: "og:description", content: description },
    ];
    if (t.backdrop_url?.startsWith("https://")) {
      meta.push({ property: "og:image", content: t.backdrop_url });
      meta.push({ name: "twitter:image", content: t.backdrop_url });
    }
    return { meta };
  },
  errorComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
      Cette fiche n'a pas pu s'afficher.
    </p>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Ce titre n'est pas disponible</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Il a peut-être été retiré du catalogue.
      </p>
    </div>
  ),
  component: TitleDetail;
});

function TitleDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(slug));
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const title = data.title!;

  const { data: favorite } = useQuery({
    queryKey: ["favorite", title.id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: row } = await supabase
        .from("favorites")
        .select("id")
        .eq("title_id", title.id)
        .maybeSingle();
      return row?.id ?? null;
    },
  });

  async function toggleFavorite() {
    if (!user) return;
    if (favorite) {
      await supabase.from("favorites").delete().eq("id", favorite);
      toast.success("Retiré de vos favoris");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, title_id: title.id });
      toast.success("Ajouté à vos favoris");
    }
    queryClient.invalidateQueries({ queryKey: ["favorite", title.id, user.id] });
    queryClient.invalidateQueries({ queryKey: ["my-favorites"] });
  }

  const hasDirectSource = data.sources.length > 0;
  const firstEpisode = data.seasons[0]?.episodes?.[0];

  return (
    <div>
      <section className="relative">
        {title.backdrop_url ? (
          <div className="absolute inset-0">
            <img src={title.backdrop_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-hero-fade" />
          </div>
        ) : null}

        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 md:flex-row">
          {title.poster_url ? (
            <img
              src={title.poster_url}
              alt={`Affiche de ${title.title}`}
              className="w-48 flex-none rounded-lg border border-border/60 shadow-cinema"
            />
          ) : null}

          <div className="flex-1">
            <span className="text-xs uppercase tracking-widest text-primary">
              {title.kind === "movie" ? "Film" : "Série"}
            </span>
            <h1 className="mt-2 font-display text-4xl sm:text-6xl">{title.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {title.release_date ? <span>{title.release_date.slice(0, 4)}</span> : null}
              {title.runtime_minutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {title.runtime_minutes} min
                </span>
              ) : null}
              {title.vote_average ? (
                <span className="inline-flex items-center gap-1 text-gold">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {Number(title.vote_average).toFixed(1)}
                </span>
              ) : null}
            </div>

            {title.genres?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {title.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground"
                  >
                    {g}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {title.overview ?? "Synopsis non renseigné."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {hasDirectSource || firstEpisode ? (
                <Button asChild size="lg" className="bg-gradient-primary">
                  <Link
                    to="/regarder/$slug"
                    params={{ slug: title.slug }}
                    search={{ ep: hasDirectSource ? undefined : firstEpisode?.id }}
                  >
                    <Play className="mr-2 h-5 w-5" /> Regarder
                  </Link>
                </Button>
              ) : (
                <span className="surface-panel px-4 py-2 text-sm text-muted-foreground">
                  Aucune source de lecture disponible pour le moment.
                </span>
              )}

              {user ? (
                <Button size="lg" variant="secondary" onClick={toggleFavorite}>
                  <Heart className={`mr-2 h-5 w-5 ${favorite ? "fill-current text-primary" : ""}`} />
                  {favorite ? "Dans mes favoris" : "Ajouter aux favoris"}
                </Button>
              ) : (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth">Se connecter pour enregistrer</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {data.seasons.length > 0 ? (
          <section className="mt-6">
            <h2 className="mb-4 font-display text-2xl">Saisons et épisodes</h2>
            <div className="space-y-6">
              {data.seasons.map((season) => (
                <div key={season.id} className="surface-panel p-5">
                  <h3 className="font-display text-xl">
                    {season.name ?? `Saison ${season.season_number}`}
                  </h3>
                  {season.overview ? (
                    <p className="mt-1 text-sm text-muted-foreground">{season.overview}</p>
                  ) : null}
                  <ul className="mt-4 divide-y divide-border">
                    {[...(season.episodes ?? [])]
                      .sort((a, b) => a.episode_number - b.episode_number)
                      .map((ep) => (
                        <li key={ep.id} className="flex items-center gap-4 py-3">
                          <span className="w-10 flex-none font-display text-xl text-muted-foreground">
                            {String(ep.episode_number).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {ep.name ?? `Épisode ${ep.episode_number}`}
                            </p>
                            {ep.overview ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{ep.overview}</p>
                            ) : null}
                          </div>
                          <Button asChild size="sm" variant="secondary">
                            <Link
                              to="/regarder/$slug"
                              params={{ slug: title.slug }}
                              search={{ ep: ep.id }}
                            >
                              <Play className="mr-1.5 h-4 w-4" /> Lire
                            </Link>
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <TitleRow heading="À voir aussi" titles={data.similar} />
      </div>
    </div>
  );
}
