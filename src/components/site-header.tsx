import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/films", label: "Films" },
  { to: "/series", label: "Séries" },
] as const;

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    navigate({ to: "/recherche", search: { q: term.trim() } });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary text-sm font-bold text-primary-foreground">
            PM
          </span>
          <span className="font-display text-2xl leading-none tracking-wide">
            Popcorn <span className="text-primary">Movies</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden w-64 items-center gap-2 md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Rechercher un titre"
              className="h-9 border-border bg-surface pl-9 text-sm"
              aria-label="Rechercher un titre"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <>
              {isAdmin ? (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/admin">Administration</Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" size="sm">
                <Link to="/mon-compte">Mon espace</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Quitter
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="bg-gradient-primary">
              <Link to="/auth">Se connecter</Link>
            </Button>
          )}
          <button
            type="button"
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-surface px-4 py-4 md:hidden">
          <form onSubmit={submitSearch} className="mb-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Rechercher un titre"
              className="border-border bg-background"
              aria-label="Rechercher un titre"
            />
          </form>
          <div className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-2 text-sm text-muted-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link to="/admin" onClick={() => setOpen(false)} className="py-2 text-sm text-muted-foreground">
                Administration
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
