import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchTmdb } from "@/lib/tmdb.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — Popcorn Movies" },
      { name: "description", content: "Back-office du catalogue Popcorn Movies." },
      { property: "og:title", content: "Administration — Popcorn Movies" },
      { property: "og:description", content: "Gestion du catalogue et des sources de lecture." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type TmdbResult = {
  tmdb_id: number;
  kind: "movie" | "tv";
  title: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string | null;
  vote_average: number | null;
};

function AdminHome() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    kind: "movie" as "movie" | "tv",
    title: "",
    slug: "",
    overview: "",
    poster_url: "",
    backdrop_url: "",
    trailer_url: "",
    genres: "",
    release_date: "",
    runtime_minutes: "",
    tmdb_id: "",
  });
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: titles } = useQuery({
    queryKey: ["admin-titles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("titles")
        .select("id, kind, slug, title, is_published, is_featured, is_trending, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (loading) {
    return <p className="px-4 py-24 text-center text-muted-foreground">Chargement…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl">Accès réservé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte n'a pas le rôle administrateur.
        </p>
      </div>
    );
  }

  async function runTmdbSearch() {
    if (!tmdbQuery.trim()) return;
    try {
      const res = await searchTmdb({ data: { query: tmdbQuery, kind: form.kind } });
      setTmdbResults(res.results as TmdbResult[]);
      if (res.results.length === 0) toast.info("Aucun résultat TMDB.");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("TMDB_API_KEY")
          ? "La clé TMDB n'est pas configurée : saisissez la fiche manuellement."
          : "La recherche TMDB a échoué.",
      );
    }
  }

  function applyTmdb(r: TmdbResult) {
    setForm((f) => ({
      ...f,
      kind: r.kind,
      title: r.title,
      slug: slugify(r.title),
      overview: r.overview ?? "",
      poster_url: r.poster_url ?? "",
      backdrop_url: r.backdrop_url ?? "",
      release_date: r.release_date ?? "",
      tmdb_id: String(r.tmdb_id),
    }));
    setTmdbResults([]);
    toast.success("Fiche pré-remplie, complétez puis enregistrez.");
  }

  async function createTitle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("titles").insert({
      kind: form.kind,
      title: form.title,
      slug: form.slug || slugify(form.title),
      overview: form.overview || null,
      poster_url: form.poster_url || null,
      backdrop_url: form.backdrop_url || null,
      trailer_url: form.trailer_url || null,
      genres: form.genres
        ? form.genres.split(",").map((g) => g.trim()).filter(Boolean)
        : [],
      release_date: form.release_date || null,
      runtime_minutes: form.runtime_minutes ? Number(form.runtime_minutes) : null,
      tmdb_id: form.tmdb_id ? Number(form.tmdb_id) : null,
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Cette adresse (slug) est déjà utilisée."
          : "L'enregistrement a échoué.",
      );
      return;
    }
    toast.success("Titre ajouté au catalogue");
    setForm({
      kind: "movie",
      title: "",
      slug: "",
      overview: "",
      poster_url: "",
      backdrop_url: "",
      trailer_url: "",
      genres: "",
      release_date: "",
      runtime_minutes: "",
      tmdb_id: "",
    });
    queryClient.invalidateQueries({ queryKey: ["admin-titles"] });
  }

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="border-border bg-background"
        {...props}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl sm:text-5xl">Administration</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ajoutez un film ou une série, puis renseignez l'adresse du flux ou le code d'intégration
        fourni par votre hébergeur de streaming.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={createTitle} className="surface-panel space-y-4 p-6">
          <h2 className="font-display text-2xl">Nouveau titre</h2>

          <div className="space-y-2">
            <Label htmlFor="kind">Type</Label>
            <select
              id="kind"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as "movie" | "tv" }))
              }
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="movie">Film</option>
              <option value="tv">Série</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmdb">Recherche TMDB (optionnelle)</Label>
            <div className="flex gap-2">
              <Input
                id="tmdb"
                value={tmdbQuery}
                onChange={(e) => setTmdbQuery(e.target.value)}
                placeholder="Titre à rechercher"
                className="border-border bg-background"
              />
              <Button type="button" variant="secondary" onClick={runTmdbSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {tmdbResults.length > 0 ? (
              <ul className="max-h-56 divide-y divide-border overflow-auto rounded-md border border-border">
                {tmdbResults.map((r) => (
                  <li key={`${r.kind}-${r.tmdb_id}`}>
                    <button
                      type="button"
                      onClick={() => applyTmdb(r)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-raised"
                    >
                      {r.poster_url ? (
                        <img src={r.poster_url} alt="" className="h-12 w-8 rounded object-cover" />
                      ) : null}
                      <span className="truncate">
                        {r.title}
                        {r.release_date ? ` (${r.release_date.slice(0, 4)})` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {field("title", "Titre", { required: true })}
          {field("slug", "Adresse (slug)", { placeholder: "auto depuis le titre" })}

          <div className="space-y-2">
            <Label htmlFor="overview">Synopsis</Label>
            <Textarea
              id="overview"
              value={form.overview}
              onChange={(e) => setForm((f) => ({ ...f, overview: e.target.value }))}
              rows={4}
              className="border-border bg-background"
            />
          </div>

          {field("poster_url", "Affiche (URL)")}
          {field("backdrop_url", "Image large (URL)")}
          {field("trailer_url", "Bande-annonce (URL)")}
          {field("genres", "Genres", { placeholder: "Action, Drame" })}
          {field("release_date", "Date de sortie", { type: "date" })}
          {field("runtime_minutes", "Durée (minutes)", { type: "number", min: 0 })}

          <Button type="submit" disabled={saving} className="w-full bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement…" : "Ajouter au catalogue"}
          </Button>
        </form>

        <section>
          <h2 className="font-display text-2xl">Catalogue ({titles?.length ?? 0})</h2>
          <ul className="surface-panel mt-4 divide-y divide-border">
            {titles?.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.kind === "movie" ? "Film" : "Série"} · /{t.slug} ·{" "}
                    {t.is_published ? "publié" : "brouillon"}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/admin/titres/$id" params={{ id: t.id }}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Gérer
                  </Link>
                </Button>
              </li>
            ))}
            {(titles?.length ?? 0) === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Aucun titre pour le moment.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
