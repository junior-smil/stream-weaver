import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Popcorn Movies" },
      {
        name: "description",
        content:
          "Connectez-vous ou créez un compte Popcorn Movies pour enregistrer vos favoris et reprendre vos lectures.",
      },
      { property: "og:title", content: "Connexion — Popcorn Movies" },
      { property: "og:description", content: "Favoris et reprise de lecture avec votre compte." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/mon-compte", replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true);
          toast.success("Compte créé : confirmez votre adresse e-mail pour vous connecter.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenue !");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error(
        message.includes("Invalid login credentials")
          ? "Adresse e-mail ou mot de passe incorrect."
          : message,
      );
    } finally {
      setPending(false);
    }
  }

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("La connexion Google n'a pas abouti.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/mon-compte" });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="font-display text-4xl">
        {mode === "signin" ? "Connexion" : "Créer un compte"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Favoris, historique et reprise de lecture sur tous vos appareils.
      </p>

      {confirmSent ? (
        <div className="surface-panel mt-6 p-4 text-sm">
          Un e-mail de confirmation vient d'être envoyé à {email}. Cliquez sur le lien qu'il contient
          pour activer votre compte.
        </div>
      ) : null}

      <form onSubmit={submit} className="surface-panel mt-6 space-y-4 p-6">
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="displayName">Nom affiché</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex"
              className="border-border bg-background"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-border bg-background"
          />
        </div>

        <Button type="submit" disabled={pending} className="w-full bg-gradient-primary">
          {pending ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </Button>

        <div className="relative py-2 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-surface px-2">ou</span>
          <span className="absolute left-0 top-1/2 h-px w-full bg-border" />
        </div>

        <Button type="button" variant="secondary" className="w-full" onClick={googleSignIn}>
          Continuer avec Google
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Pas encore de compte ? Créer un compte"
          : "Déjà inscrit ? Se connecter"}
      </button>

      <p className="mt-8 text-xs text-muted-foreground">
        L'accès n'est jamais refusé en raison de votre adresse IP ou de l'usage d'un VPN.
      </p>
    </div>
  );
}
