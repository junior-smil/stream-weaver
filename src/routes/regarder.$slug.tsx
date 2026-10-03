import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ListVideo } from "lucide-react";
import { getPlaybackSources } from "@/lib/catalog.functions";
import { VideoPlayer, type PlayableSource } from "@/components/video-player";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const playbackQuery = (slug: string, episodeId?: string) =>
  queryOptions({
    queryKey: ["playback", slug, episodeId ?? null],
    queryFn: () => getPlaybackSources({ data: episodeId ? { slug, episodeId } : { slug } }),
  });

export const Route = createFileRoute("/regarder/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    ep: typeof search["ep"] === "string" ? search["ep"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ ep: search.ep }),
  loader: async ({ context, params, deps }) => {
    const data = await context.queryClient.ensureQueryData(playbackQuery(params.slug, deps.ep));
    if (!data.title) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.title) {
      return { meta: [{ title: "Lecture indisponible" }, { name: "robots", content: "noindex" }] };
    }
    return {
      meta: [
        { title: `Regarder ${loaderData.title.title} — Popcorn Movies` },
        {
          name: "description",
          content: `Lecture de ${loaderData.title.title} avec sélection de qualité Auto ou manuelle.`,
        },
        { property: "og:title", content: `Regarder ${loaderData.title.title}` },
        {
          property: "og:description",
          content: "Lecteur adaptatif HLS avec sélection de qualité.",
        },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
      La lecture n'a pas pu démarrer. Réessayez dans quelques instants.
    </p>
  ),
  notFoundComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
      Ce contenu n'est pas disponible.
    </p>
  ),
  component: WatchPage,
});

function WatchPage() {
  const { slug } = Route.useParams();
  const { ep } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useSuspenseQuery(playbackQuery(slug, ep));
  const title = data.title!;
  const sources = data.sources as PlayableSource[];
  const [activeIndex, setActiveIndex] = useState(0);
  const lastSaved = useRef(0);

  const flatEpisodes = useMemo(
    () =>
      data.episodes.flatMap((season) =>
        [...(season.episodes ?? [])]
          .sort((a, b) => a.episode_number - b.episode_number)
          .map((e) => ({ ...e, season_number: season.season_number })),
      ),
    [data.episodes],
  );

  const currentPos = flatEpisodes.findIndex((e) => e.id === ep);
  const nextEpisode = currentPos >= 0 ? flatEpisodes[currentPos + 1] : undefined;

  const { data: resume } = useQuery({
    queryKey: ["resume", title.id, ep ?? null, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      let q = supabase.from("watch_history").select("position_seconds").eq("title_id", title.id);
      q = ep ? q.eq("episode_id", ep) : q.is("episode_id", null);
      const { data: row } = await q.maybeSingle();
      return row?.position_seconds ?? 0;
    },
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [ep, slug]);

  async function saveProgress(position: number, duration: number) {
    if (!user) return;
    if (Math.abs(position - lastSaved.current) < 10) return;
    lastSaved.current = position;
    const payload = {
      position_seconds: Math.floor(position),
      duration_seconds: Math.floor(duration) || null,
      completed: duration > 0 && position / duration > 0.95,
    };
    let existing = supabase.from("watch_history").select("id").eq("title_id", title.id);
    existing = ep ? existing.eq("episode_id", ep) : existing.is("episode_id", null);
    const { data: row } = await existing.maybeSingle();
    if (row) {
      await supabase.from("watch_history").update(payload).eq("id", row.id);
    } else {
      await supabase
        .from("watch_history")
        .insert({ user_id: user.id, title_id: title.id, episode_id: ep ?? null, ...payload });
    }
  }

  const active = sources[activeIndex];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/titre/$slug" params={{ slug }}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Retour à la fiche
        </Link>
      </Button>

      <h1 className="font-display text-3xl sm:text-4xl">
        {title.title}
        {data.episode ? (
          <span className="ml-3 text-xl text-muted-foreground">
            E{String(data.episode.episode_number).padStart(2, "0")}
            {data.episode.name ? ` · ${data.episode.name}` : ""}
          </span>
        ) : null}
      </h1>

      <div className="mt-6">
        {active ? (
          <VideoPlayer
            source={active}
            poster={title.backdrop_url ?? title.poster_url}
            startAt={resume ?? 0}
            onProgress={saveProgress}
            onEnded={() => {
              if (nextEpisode) navigate({ to: "/regarder/$slug", params: { slug }, search: { ep: nextEpisode.id } });
            }}
          />
        ) : (
          <div className="surface-panel p-10 text-center">
            <h2 className="font-display text-2xl">Aucune source de lecture</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Un administrateur doit encore renseigner l'adresse du flux ou le code d'intégration pour
              ce contenu.
            </p>
          </div>
        )}
      </div>

      {sources.length > 1 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Sources</h2>
          <div className="flex flex-wrap gap-2">
            {sources.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                  i === activeIndex
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
                {s.language ? ` · ${s.language}` : ""}
                {s.integration_mode === "embed" ? " · lecteur externe" : ` · ${s.protocol.toUpperCase()}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!user ? (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">
            Connectez-vous
          </Link>{" "}
          pour enregistrer votre progression et reprendre la lecture plus tard.
        </p>
      ) : null}

      {flatEpisodes.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-2xl">
            <ListVideo className="h-5 w-5 text-primary" /> Épisodes
          </h2>
          <ul className="surface-panel divide-y divide-border">
            {flatEpisodes.map((e) => (
              <li key={e.id}>
                <Link
                  to="/regarder/$slug"
                  params={{ slug }}
                  search={{ ep: e.id }}
                  className={`flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-surface-raised ${
                    e.id === ep ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span className="font-display text-lg">
                    S{String(e.season_number).padStart(2, "0")}E
                    {String(e.episode_number).padStart(2, "0")}
                  </span>
                  <span className="truncate">{e.name ?? `Épisode ${e.episode_number}`}</span>
                  {e.runtime_minutes ? (
                    <span className="ml-auto flex-none text-xs">{e.runtime_minutes} min</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
