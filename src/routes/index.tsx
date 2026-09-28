import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Play, Info, ShieldCheck, Gauge, Subtitles } from "lucide-react";
import { getHomeCatalog } from "@/lib/catalog.functions";
import { TitleRow, TitleCard } from "@/components/title-card";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-cinema.jpg";

const homeQuery = queryOptions({
  queryKey: ["home-catalog"],
  queryFn: () => getHomeCatalog(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Popcorn Movies — films et séries en streaming adaptatif" },
      {
        name: "description",
        content:
          "Découvrez des films et séries avec un lecteur adaptatif HLS : qualité Auto ou manuelle, favoris, reprise de lecture et accès sans blocage d'IP ni de VPN.",
      },
      { property: "og:title", content: "Popcorn Movies — films et séries" },
      {
        property: "og:description",
        content: "Catalogue de films et séries, lecteur multi-qualité, favoris et reprise de lecture.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Le catalogue est momentanément indisponible</h1>
      <p className="mt-2 text-muted-foreground">Réessayez dans quelques instants.</p>
    </div>
  ),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(homeQuery);
  const featured = data.featured?.[0] ?? data.titles[0];

  return (
    <div>
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src={featured?.backdrop_url ?? heroImage}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-hero-fade" />
        </div>

        <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-end px-4 pb-16 pt-28">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
            À l'affiche
          </span>
          <h1 className="max-w-3xl font-display text-5xl leading-none sm:text-7xl">
            {featured?.title ?? "Votre catalogue commence ici"}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {featured?.overview ??
              "Ajoutez vos premiers films et séries depuis l'espace d'administration, puis collez le lien du flux ou le code d'intégration de votre hébergeur."}
          </p>

          {featured ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-primary">
                <Link to="/regarder/$slug" params={{ slug: featured.slug }} search={{ ep: undefined }}>
                  <Play className="mr-2 h-5 w-5" /> Regarder
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/titre/$slug" params={{ slug: featured.slug }}>
                  <Info className="mr-2 h-5 w-5" /> Plus d'infos
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <TitleRow heading="Tendances" titles={data.trending ?? []} />
        <TitleRow heading="Films" titles={data.movies ?? []} />
        <TitleRow heading="Séries" titles={data.series ?? []} />

        {data.titles.length === 0 ? (
          <div className="surface-panel mt-12 p-8 text-center">
            <h2 className="font-display text-2xl">Le catalogue est vide</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous avec un compte administrateur pour ajouter des films, des séries et leurs
              sources de lecture.
            </p>
          </div>
        ) : null}

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Gauge,
              title: "Qualité Auto ou manuelle",
              text: "Le lecteur lit les flux HLS et propose les résolutions réellement présentes dans le manifeste.",
            },
            {
              icon: ShieldCheck,
              title: "Aucun blocage VPN",
              text: "Navigation, connexion et lecture autorisées quelle que soit votre adresse IP.",
            },
            {
              icon: Subtitles,
              title: "Sous-titres et reprise",
              text: "Pistes fournies par la source, favoris et reprise de lecture là où vous vous êtes arrêté.",
            },
          ].map((f) => (
            <div key={f.title} className="surface-panel p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>

        {data.titles.length > 0 ? (
          <section className="mt-20">
            <h2 className="mb-4 font-display text-2xl">Tout le catalogue</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {data.titles.map((t) => (
                <TitleCard key={t.id} title={t} className="w-full" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
