import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/titres/$id")({
  head: () => ({
    meta: [
      { title: "Gérer un titre — Popcorn Movies" },
      { name: "description", content: "Édition d'une fiche, de ses épisodes et de ses sources de lecture." },
      { property: "og:title", content: "Gérer un titre — Popcorn Movies" },
      { property: "og:description", content: "Back-office Popcorn Movies." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTitle,
});

const selectCls = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm";

function AdminTitle() {
  const { id } = Route.useParams();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-title", id],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: title }, { data: seasons }, { data: sources }] = await Promise.all([
        supabase.from("titles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("seasons")
          .select("id, season_number, name, episodes(id, episode_number, name, runtime_minutes)")
          .eq("title_id", id)
          .order("season_number"),
        supabase.from("media_sources").select("*").eq("title_id", id).order("sort_order"),
      ]);
      const episodeIds = (seasons ?? []).flatMap((s) => (s.episodes ?? []).map((e) => e.id));
      const { data: epSources } = episodeIds.length
        ? await supabase.from("media_sources").select("*").in("episode_id", episodeIds)
        : { data: [] };
      return { title, seasons: seasons ?? [], sources: [...(sources ?? []), ...(epSources ?? [])] };
    },
  });

  const [edit, setEdit] = useState({ title: "", overview: "", poster_url: "", backdrop_url: "", genres: "" });
  useEffect(() => {
    if (data?.title)
      setEdit({
        title: data.title.title,
        overview: data.title.overview ?? "",
        poster_url: data.title.poster_url ?? "",
        backdrop_url: data.title.backdrop_url ?? "",
        genres: (data.title.genres ?? []).join(", "),
      });
  }, [data?.title]);

  const [src, setSrc] = useState({
    target: "title",
    label: "Source principale",
    provider_name: "",
    integration_mode: "manifest" as "manifest" | "embed",
    protocol: "hls" as "hls" | "dash" | "mp4",
    manifest_url: "",
    embed_code: "",
    language: "",
  });
  const [season, setSeason] = useState({ number: "1", name: "" });
  const [episode, setEpisode] = useState({ season_id: "", number: "1", name: "", runtime: "" });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-title", id] });

  if (loading) return <p className="px-4 py-24 text-center text-muted-foreground">Chargement…</p>;
  if (!isAdmin)
    return <p className="px-4 py-24 text-center text-muted-foreground">Accès réservé aux administrateurs.</p>;
  if (!data?.title) return <p className="px-4 py-24 text-center text-muted-foreground">Titre introuvable.</p>;
  const t = data.title;

  async function patchTitle(values: Record<string, unknown>, msg = "Fiche enregistrée") {
    const { error } = await supabase.from("titles").update(values).eq("id", id);
    if (error) return toast.error("Mise à jour impossible.");
    toast.success(msg);
    refresh();
    qc.invalidateQueries({ queryKey: ["admin-titles"] });
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (src.integration_mode === "manifest" && !/^https?:\/\//.test(src.manifest_url))
      return toast.error("L'adresse du flux doit commencer par http(s)://");
    if (src.integration_mode === "embed" && !src.embed_code.includes("<iframe"))
      return toast.error("Collez le code <iframe> fourni par l'hébergeur.");
    const { error } = await supabase.from("media_sources").insert({
      title_id: src.target === "title" ? id : null,
      episode_id: src.target === "title" ? null : src.target,
      label: src.label || "Source",
      provider_name: src.provider_name || null,
      integration_mode: src.integration_mode,
      protocol: src.protocol,
      manifest_url: src.integration_mode === "manifest" ? src.manifest_url : null,
      embed_code: src.integration_mode === "embed" ? src.embed_code : null,
      language: src.language || null,
    });
    if (error) return toast.error("Source non enregistrée.");
    toast.success("Source ajoutée");
    setSrc((s) => ({ ...s, manifest_url: "", embed_code: "" }));
    refresh();
  }

  async function toggleSource(sid: string, active: boolean) {
    await supabase.from("media_sources").update({ is_active: active }).eq("id", sid);
    refresh();
  }
  async function deleteSource(sid: string) {
    await supabase.from("media_sources").delete().eq("id", sid);
    refresh();
  }
  async function addSeason(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("seasons")
      .insert({ title_id: id, season_number: Number(season.number), name: season.name || null });
    if (error) return toast.error("Saison non créée.");
    toast.success("Saison ajoutée");
    refresh();
  }
  async function addEpisode(e: React.FormEvent) {
    e.preventDefault();
    if (!episode.season_id) return toast.error("Choisissez une saison.");
    const { error } = await supabase.from("episodes").insert({
      season_id: episode.season_id,
      episode_number: Number(episode.number),
      name: episode.name || null,
      runtime_minutes: episode.runtime ? Number(episode.runtime) : null,
    });
    if (error) return toast.error("Épisode non créé.");
    toast.success("Épisode ajouté");
    setEpisode((ep) => ({ ...ep, number: String(Number(ep.number) + 1), name: "" }));
    refresh();
  }

  const allEpisodes = data.seasons.flatMap((s) =>
    (s.episodes ?? []).map((e) => ({ ...e, label: `S${s.season_number}E${e.episode_number} ${e.name ?? ""}` })),
  );
  const targetLabel = (s: { title_id: string | null; episode_id: string | null }) =>
    s.title_id ? "Titre" : allEpisodes.find((e) => e.id === s.episode_id)?.label ?? "Épisode";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin">
          <ChevronLeft className="mr-1 h-4 w-4" /> Catalogue
        </Link>
      </Button>
      <h1 className="mt-2 font-display text-4xl">{t.title}</h1>

      <div className="mt-4 flex flex-wrap gap-6 text-sm">
        {(
          [
            ["is_published", "Publié"],
            ["is_featured", "À la une"],
            ["is_trending", "Tendance"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2">
            <Switch checked={Boolean(t[key])} onCheckedChange={(v) => patchTitle({ [key]: v }, "Statut mis à jour")} />
            {label}
          </label>
        ))}
        {t.is_published ? (
          <Link to="/titre/$slug" params={{ slug: t.slug }} className="text-primary hover:underline">
            Voir la fiche publique
          </Link>
        ) : null}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <form
          className="surface-panel space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            patchTitle({
              title: edit.title,
              overview: edit.overview || null,
              poster_url: edit.poster_url || null,
              backdrop_url: edit.backdrop_url || null,
              genres: edit.genres.split(",").map((g) => g.trim()).filter(Boolean),
            });
          }}
        >
          <h2 className="font-display text-2xl">Informations</h2>
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Synopsis</Label>
            <Textarea rows={5} value={edit.overview} onChange={(e) => setEdit({ ...edit, overview: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Affiche (URL)</Label>
            <Input value={edit.poster_url} onChange={(e) => setEdit({ ...edit, poster_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Image large (URL)</Label>
            <Input value={edit.backdrop_url} onChange={(e) => setEdit({ ...edit, backdrop_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Genres</Label>
            <Input value={edit.genres} onChange={(e) => setEdit({ ...edit, genres: e.target.value })} />
          </div>
          <Button type="submit" className="bg-gradient-primary">Enregistrer</Button>
        </form>

        <form onSubmit={addSource} className="surface-panel space-y-4 p-6">
          <h2 className="font-display text-2xl">Ajouter une source de lecture</h2>
          <div className="space-y-2">
            <Label>Rattacher à</Label>
            <select className={selectCls} value={src.target} onChange={(e) => setSrc({ ...src, target: e.target.value })}>
              <option value="title">Le titre (film)</option>
              {allEpisodes.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <select
              className={selectCls}
              value={src.integration_mode}
              onChange={(e) => setSrc({ ...src, integration_mode: e.target.value as "manifest" | "embed" })}
            >
              <option value="manifest">A — Flux direct (URL HLS .m3u8 ou MP4)</option>
              <option value="embed">B — Code d'intégration iframe</option>
            </select>
          </div>
          {src.integration_mode === "manifest" ? (
            <>
              <div className="space-y-2">
                <Label>Format</Label>
                <select
                  className={selectCls}
                  value={src.protocol}
                  onChange={(e) => setSrc({ ...src, protocol: e.target.value as "hls" | "dash" | "mp4" })}
                >
                  <option value="hls">HLS (.m3u8) — qualités multiples</option>
                  <option value="mp4">MP4</option>
                  <option value="dash">DASH (.mpd)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>URL du flux</Label>
                <Input
                  placeholder="https://…/master.m3u8"
                  value={src.manifest_url}
                  onChange={(e) => setSrc({ ...src, manifest_url: e.target.value })}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Code iframe</Label>
              <Textarea
                rows={4}
                placeholder='<iframe src="https://…" allowfullscreen></iframe>'
                value={src.embed_code}
                onChange={(e) => setSrc({ ...src, embed_code: e.target.value })}
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input value={src.label} onChange={(e) => setSrc({ ...src, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Input value={src.provider_name} onChange={(e) => setSrc({ ...src, provider_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Langue</Label>
              <Input placeholder="VF" value={src.language} onChange={(e) => setSrc({ ...src, language: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" /> Ajouter la source
          </Button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Sources ({data.sources.length})</h2>
        <ul className="surface-panel mt-4 divide-y divide-border">
          {data.sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.label} <span className="text-muted-foreground">· {targetLabel(s)}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.integration_mode === "embed" ? "iframe" : `${s.protocol.toUpperCase()} · ${s.manifest_url}`}
                </p>
              </div>
              <Switch checked={s.is_active} onCheckedChange={(v) => toggleSource(s.id, v)} aria-label="Active" />
              <Button size="icon" variant="ghost" aria-label="Supprimer la source" onClick={() => deleteSource(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {data.sources.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">Aucune source.</li>
          ) : null}
        </ul>
      </section>

      {t.kind === "tv" ? (
        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="surface-panel space-y-4 p-6">
            <h2 className="font-display text-2xl">Saisons et épisodes</h2>
            {data.seasons.map((s) => (
              <div key={s.id}>
                <p className="font-medium">{s.name ?? `Saison ${s.season_number}`}</p>
                <ul className="mt-1 text-sm text-muted-foreground">
                  {[...(s.episodes ?? [])]
                    .sort((a, b) => a.episode_number - b.episode_number)
                    .map((e) => (
                      <li key={e.id}>E{e.episode_number} · {e.name ?? "Sans titre"}</li>
                    ))}
                </ul>
              </div>
            ))}
            <form onSubmit={addSeason} className="flex items-end gap-2 border-t border-border pt-4">
              <div className="w-20 space-y-2">
                <Label>N°</Label>
                <Input type="number" min={0} value={season.number} onChange={(e) => setSeason({ ...season, number: e.target.value })} />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Nom (optionnel)</Label>
                <Input value={season.name} onChange={(e) => setSeason({ ...season, name: e.target.value })} />
              </div>
              <Button type="submit" variant="secondary">Ajouter</Button>
            </form>
          </div>

          <form onSubmit={addEpisode} className="surface-panel space-y-4 p-6">
            <h2 className="font-display text-2xl">Nouvel épisode</h2>
            <select className={selectCls} value={episode.season_id} onChange={(e) => setEpisode({ ...episode, season_id: e.target.value })}>
              <option value="">Choisir une saison</option>
              {data.seasons.map((s) => (
                <option key={s.id} value={s.id}>Saison {s.season_number}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <Input type="number" min={1} value={episode.number} onChange={(e) => setEpisode({ ...episode, number: e.target.value })} aria-label="Numéro" />
              <Input className="col-span-2" placeholder="Titre de l'épisode" value={episode.name} onChange={(e) => setEpisode({ ...episode, name: e.target.value })} />
            </div>
            <Input type="number" placeholder="Durée (min)" value={episode.runtime} onChange={(e) => setEpisode({ ...episode, runtime: e.target.value })} />
            <Button type="submit" variant="secondary">Ajouter l'épisode</Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
