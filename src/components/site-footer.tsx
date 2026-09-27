import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <span className="font-display text-2xl">
            Popcorn <span className="text-primary">Movies</span>
          </span>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Plateforme de découverte et de visionnage de films et séries. Lecture adaptative, qualité
            Auto ou manuelle, accès libre depuis n'importe quelle connexion.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg">Parcourir</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/films" className="hover:text-foreground">
                Films
              </Link>
            </li>
            <li>
              <Link to="/series" className="hover:text-foreground">
                Séries
              </Link>
            </li>
            <li>
              <Link to="/recherche" search={{ q: "" }} className="hover:text-foreground">
                Recherche
              </Link>
            </li>
            <li>
              <Link to="/acces-et-confidentialite" className="hover:text-foreground">
                Accès, VPN et confidentialité
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg">Accès sans restriction</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun blocage d'adresse IP, aucune détection de VPN ou de proxy de confidentialité. Les
            seules limites appliquées sont celles des licences propres à un contenu.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Popcorn Movies. Tout média diffusé doit être détenu, licencié ou
        explicitement autorisé.
      </div>
    </footer>
  );
}
