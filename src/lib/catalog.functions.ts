import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const TITLE_COLUMNS =
  "id, kind, slug, title, overview, poster_url, backdrop_url, genres, release_date, runtime_minutes, vote_average, is_featured, is_trending";

export type CatalogTitle = {
  id: string;
  kind: "movie" | "tv";
  slug: string;
  title: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[];
  release_date: string | null;
  runtime_minutes: number | null;
  vote_average: number | null;
  is_featured: boolean;
  is_trending: boolean;
};

export const getHomeCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("titles")
    .select(TITLE_COLUMNS)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return { titles: [] as CatalogTitle[], error: "Catalogue indisponible" };
  const titles = (data ?? []) as CatalogTitle[];
  return {
    titles,
    featured: titles.filter((t) => t.is_featured),
    trending: titles.filter((t) => t.is_trending),
    movies: titles.filter((t) => t.kind === "movie"),
    series: titles.filter((t) => t.kind === "tv"),
    error: null as string | null,
  };
});

export const listTitles = createServerFn({ method: "GET" })
  .inputValidator((input: { kind?: "movie" | "tv"; genre?: string; q?: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    let query = supabase.from("titles").select(TITLE_COLUMNS).eq("is_published", true);
    if (data.kind) query = query.eq("kind", data.kind);
    if (data.genre) query = query.contains("genres", [data.genre]);
    if (data.q) query = query.ilike("title", `%${data.q}%`);
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) return { titles: [] as CatalogTitle[], error: "Recherche indisponible" };
    return { titles: (rows ?? []) as CatalogTitle[], error: null as string | null };
  });

export const getTitleDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: title } = await supabase
      .from("titles")
      .select(TITLE_COLUMNS)
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!title) return { title: null, seasons: [], sources: [], similar: [] };

    const [{ data: seasons }, { data: sources }, { data: similar }] = await Promise.all([
      supabase
        .from("seasons")
        .select("id, season_number, name, overview, episodes(id, episode_number, name, overview, still_url, runtime_minutes, air_date)")
        .eq("title_id", title.id)
        .order("season_number"),
      supabase
        .from("media_sources")
        .select("id, label, integration_mode, protocol, manifest_url, embed_code, language, quality_label, provider_name")
        .eq("title_id", title.id)
        .order("sort_order"),
      supabase
        .from("titles")
        .select(TITLE_COLUMNS)
        .eq("is_published", true)
        .eq("kind", title.kind)
        .neq("id", title.id)
        .limit(12),
    ]);

    return {
      title: title as CatalogTitle,
      seasons: seasons ?? [],
      sources: sources ?? [],
      similar: (similar ?? []) as CatalogTitle[],
    };
  });

export const getPlaybackSources = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; episodeId?: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: title } = await supabase
      .from("titles")
      .select(TITLE_COLUMNS)
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!title) return { title: null, sources: [], episode: null, episodes: [] };

    const sourcesQuery = supabase
      .from("media_sources")
      .select("id, label, integration_mode, protocol, manifest_url, embed_code, language, quality_label, provider_name")
      .order("sort_order");

    const { data: sources } = data.episodeId
      ? await sourcesQuery.eq("episode_id", data.episodeId)
      : await sourcesQuery.eq("title_id", title.id);

    const { data: episodes } = await supabase
      .from("seasons")
      .select("id, season_number, name, episodes(id, episode_number, name, runtime_minutes)")
      .eq("title_id", title.id)
      .order("season_number");

    let episode: { id: string; name: string | null; episode_number: number } | null = null;
    if (data.episodeId) {
      const { data: ep } = await supabase
        .from("episodes")
        .select("id, name, episode_number")
        .eq("id", data.episodeId)
        .maybeSingle();
      episode = ep ?? null;
    }

    return { title: title as CatalogTitle, sources: sources ?? [], episode, episodes: episodes ?? [] };
  });
