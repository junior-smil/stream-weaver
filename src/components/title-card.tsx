import { Link } from "@tanstack/react-router";
import { Play, Star } from "lucide-react";
import type { CatalogTitle } from "@/lib/catalog.functions";

export function TitleCard({ title, className = "" }: { title: CatalogTitle; className?: string }) {
  const year = title.release_date ? title.release_date.slice(0, 4) : null;

  return (
    <Link
      to="/titre/$slug"
      params={{ slug: title.slug }}
      className={`group relative block w-40 overflow-hidden rounded-lg border border-border/60 bg-surface transition-transform duration-300 hover:-translate-y-1 hover:shadow-glow sm:w-48 ${className}`}
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-surface-raised">
        {title.poster_url ? (
          <img
            src={title.poster_url}
            alt={`Affiche de ${title.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-poster-fade p-3 text-center">
            <span className="font-display text-xl leading-tight text-muted-foreground">
              {title.title}
            </span>
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-primary">
            <Play className="h-5 w-5 text-primary-foreground" />
          </span>
        </div>
        <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {title.kind === "movie" ? "Film" : "Série"}
        </span>
      </div>
      <div className="p-3">
        <h3 className="truncate font-display text-lg leading-tight">{title.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {year ? <span>{year}</span> : null}
          {title.vote_average ? (
            <span className="inline-flex items-center gap-1 text-gold">
              <Star className="h-3 w-3 fill-current" />
              {Number(title.vote_average).toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function TitleRow({ heading, titles }: { heading: string; titles: CatalogTitle[] }) {
  if (titles.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-4 font-display text-2xl tracking-wide">{heading}</h2>
      <div className="scroll-row">
        {titles.map((t) => (
          <TitleCard key={t.id} title={t} />
        ))}
      </div>
    </section>
  );
}
