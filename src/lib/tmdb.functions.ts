import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TmdbResult = {
  tmdb_id: number;
  kind: "movie" | "tv";
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string | null;
  vote_average: number | null;
};

const IMG = "https://image.tmdb.org/t/p";

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux administrateurs");
}

/** Recherche TMDB (films et séries). Nécessite la clé TMDB_API_KEY côté serveur. */
export const searchTmdb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string; kind: "movie" | "tv" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);

    const key = process.env["TMDB_API_KEY"];
    if (!key) {
      return {
        results: [] as TmdbResult[],
        error:
          "La clé TMDB n'est pas encore enregistrée. Saisissez les informations manuellement ou ajoutez la clé pour activer la recherche automatique.",
      };
    }

    const isV4 = key.length > 60;
    const url = new URL(`https://api.themoviedb.org/3/search/${data.kind}`);
    url.searchParams.set("query", data.query);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("include_adult", "false");
    if (!isV4) url.searchParams.set("api_key", key);

    const res = await fetch(url, {
      headers: isV4 ? { Authorization: `Bearer ${key}`, accept: "application/json" } : { accept: "application/json" },
    });

    if (!res.ok) {
      return { results: [] as TmdbResult[], error: "La recherche TMDB a échoué. Vérifiez la clé enregistrée." };
    }

    const json = (await res.json()) as {
      results?: Array<Record<string, unknown>>;
    };

    const results: TmdbResult[] = (json.results ?? []).slice(0, 12).map((r) => ({
      tmdb_id: Number(r["id"]),
      kind: data.kind,
      title: String(r["title"] ?? r["name"] ?? ""),
      original_title: (r["original_title"] ?? r["original_name"] ?? null) as string | null,
      overview: (r["overview"] as string | null) || null,
      poster_url: r["poster_path"] ? `${IMG}/w500${r["poster_path"]}` : null,
      backdrop_url: r["backdrop_path"] ? `${IMG}/original${r["backdrop_path"]}` : null,
      release_date: (r["release_date"] ?? r["first_air_date"] ?? null) as string | null,
      vote_average: r["vote_average"] != null ? Number(r["vote_average"]) : null,
    }));

    return { results, error: null as string | null };
  });
