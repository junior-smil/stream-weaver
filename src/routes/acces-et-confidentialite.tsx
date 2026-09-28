import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/acces-et-confidentialite")({
  head: () => ({
    meta: [
      { title: "Accès, VPN et confidentialité — Popcorn Movies" },
      {
        name: "description",
        content:
          "Règles d'accès de Popcorn Movies : aucun blocage d'adresse IP ni de VPN, contrôles anti-abus proportionnés et restrictions limitées aux contenus concernés.",
      },
      { property: "og:title", content: "Accès, VPN et confidentialité" },
      {
        property: "og:description",
        content: "Aucun blocage d'IP ni de VPN, contrôles anti-abus proportionnés.",
      },
    ],
  }),
  component: AccessPage,
});

const SECTIONS = [
  {
    title: "Aucun blocage lié au VPN",
    items: [
      "Aucun blocage global des VPN, proxys de confidentialité ou adresses IP partagées.",
      "La géolocalisation par IP n'est jamais l'unique critère d'authentification ou de détection de fraude.",
      "Navigation, recherche, connexion et lecture sont autorisées via VPN.",
      "Aucun refus d'accès, déconnexion, pénalité ou réduction de qualité déclenchés par la seule détection d'un VPN.",
    ],
  },
  {
    title: "Contrôles anti-abus proportionnés",
    items: [
      "En cas d'activité réellement anormale, une limitation temporaire ou une vérification supplémentaire peut s'appliquer.",
      "Ces contrôles sont gradués, documentés et expliqués à l'utilisateur concerné.",
      "L'usage d'un VPN n'est jamais assimilé automatiquement à une fraude.",
    ],
  },
  {
    title: "Limites juridiques",
    items: [
      "Les restrictions territoriales prévues par les licences s'appliquent au contenu concerné, et non à tous les utilisateurs VPN.",
      "Chaque média diffusé doit être détenu, licencié ou explicitement autorisé.",
      "Une source distante interdisant le téléchargement ou le transcodage n'est ni copiée ni transformée.",
    ],
  },
  {
    title: "Données personnelles",
    items: [
      "Collecte minimale : compte, favoris et position de lecture.",
      "Les mesures de qualité de lecture restent anonymes et agrégées.",
      "Vous pouvez supprimer vos favoris et votre historique depuis votre espace personnel.",
    ],
  },
];

function AccessPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl sm:text-5xl">Accès, VPN et confidentialité</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Popcorn Movies n'applique aucune restriction réseau fondée sur l'adresse IP ou l'usage d'un
        VPN.
      </p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title} className="surface-panel p-6">
            <h2 className="font-display text-2xl">{s.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {s.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
