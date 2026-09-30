import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TitleCard } from "@/components/title-card";
import type { CatalogTitle } from "@/lib/catalog.functions";

export const Route = createFileRoute("/_authenticated/mon-compte")({
  head: () => ({
    meta: [
      { title: "Mon espace — Popcorn Movies" },
      {
        name: "description",
        content: "Votre profil, vos favoris et votre historique de lecture sur Popcorn Movies.",
      },
      { property: "og:title", content: "Mon espace — Popcorn Movies" },
      { property: "og:description", content: "Profil, favoris et historique de lecture." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

type HistoryRow = {
  id: string;
  position_seconds: number;
  duration_seconds: number | null;
  updated_at: string;
  episode_id: string | null;
  titles: { slug: string; title: string; poster_url: string | null } | null;
};

function AccountPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const { data: favorites } = useQuery({
    queryKey: ["my-favorites", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select(
          "id, titles(id, kind, slug, title, overview, poster_url, backdrop_url, genres, release_date, runtime_minutes, vote_average, is_featured, is_trending)",
        )
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{ id: string; titles: CatalogTitle | null }>;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["my-history", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("watch_history")
        .select("id, position_seconds, duration_seconds, updated_at, episode_id, titles(slug, title, poster_url)")
        .order("updated_at", { ascending: false })
        .limit(40);
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, display_name: displayName });
    if (error) {
      toast.error("Le profil n'a pas pu être enregistré.");
      return;
    }
    toast.success("Profil mis à jour");
    queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
  }

  async function removeHistory(id: string) {
    await supabase.from("watch_history").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["my-history", user?.id] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl sm:text-5xl">Mon espace</h1>
      <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>

      {isAdmin ? (
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link to="/admin">Ouvrir l'administration</Link>
        </Button>
      ) : null}

      <Tabs defaultValue="favorites" className="mt-8">
        <TabsList>
          <TabsTrigger value="favorites">Favoris</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="profile">Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="favorites" className="mt-6">
          {(favorites?.length ?? 0) === 0 ? (
            <p className="surface-panel p-8 text-center text-sm text-muted-foreground">
              Aucun favori pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {favorites?.map((f) =>
                f.titles ? <TitleCard key={f.id} title={f.titles} className="w-full" /> : null,
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {(history?.length ?? 0) === 0 ? (
            <p className="surface-panel p-8 text-center text-sm text-muted-foreground">
              Votre historique est vide.
            </p>
          ) : (
            <ul className="surface-panel divide-y divide-border">
              {history?.map((h) => {
                const pct =
                  h.duration_seconds && h.duration_seconds > 0
                    ? Math.min(100, Math.round((h.position_seconds / h.duration_seconds) * 100))
                    : 0;
                return (
                  <li key={h.id} className="flex items-center gap-4 p-4">
                    {h.titles?.poster_url ? (
                      <img
                        src={h.titles.poster_url}
                        alt=""
                        className="h-20 w-14 flex-none rounded object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{h.titles?.title ?? "Titre retiré"}</p>
                      <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{pct}% visionné</p>
                    </div>
                    {h.titles?.slug ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link
                          to="/regarder/$slug"
                          params={{ slug: h.titles.slug }}
                          search={{ ep: h.episode_id ?? undefined }}
                        >
                          Reprendre
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Supprimer de l'historique"
                      onClick={() => removeHistory(h.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <form onSubmit={saveProfile} className="surface-panel max-w-md space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nom affiché</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="border-border bg-background"
              />
            </div>
            <Button type="submit" className="bg-gradient-primary">
              Enregistrer
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
