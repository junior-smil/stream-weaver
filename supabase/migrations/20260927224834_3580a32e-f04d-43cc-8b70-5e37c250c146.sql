-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- TIMESTAMP HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- AUTO PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATALOGUE
CREATE TYPE public.title_kind AS ENUM ('movie', 'tv');

CREATE TABLE public.titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.title_kind NOT NULL DEFAULT 'movie',
  tmdb_id INTEGER,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  trailer_url TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  release_date DATE,
  runtime_minutes INTEGER,
  vote_average NUMERIC(3,1),
  certification TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_trending BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX titles_kind_idx ON public.titles (kind);
CREATE INDEX titles_genres_idx ON public.titles USING GIN (genres);
GRANT SELECT ON public.titles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titles TO authenticated;
GRANT ALL ON public.titles TO service_role;
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published titles are public" ON public.titles FOR SELECT USING (is_published = true);
CREATE POLICY "admins read all titles" ON public.titles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage titles" ON public.titles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER titles_updated_at BEFORE UPDATE ON public.titles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  name TEXT,
  overview TEXT,
  poster_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (title_id, season_number)
);
GRANT SELECT ON public.seasons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons of published titles are public" ON public.seasons FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.titles t WHERE t.id = title_id AND t.is_published));
CREATE POLICY "admins manage seasons" ON public.seasons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  name TEXT,
  overview TEXT,
  still_url TEXT,
  runtime_minutes INTEGER,
  air_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, episode_number)
);
GRANT SELECT ON public.episodes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes of published titles are public" ON public.episodes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.seasons s JOIN public.titles t ON t.id = s.title_id
    WHERE s.id = season_id AND t.is_published
  ));
CREATE POLICY "admins manage episodes" ON public.episodes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- MEDIA SOURCES (external streaming links)
CREATE TYPE public.integration_mode AS ENUM ('manifest', 'embed');
CREATE TYPE public.stream_protocol AS ENUM ('hls', 'dash', 'mp4');

CREATE TABLE public.media_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID REFERENCES public.titles(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Source principale',
  provider_name TEXT,
  integration_mode public.integration_mode NOT NULL DEFAULT 'manifest',
  protocol public.stream_protocol NOT NULL DEFAULT 'hls',
  manifest_url TEXT,
  embed_code TEXT,
  language TEXT,
  quality_label TEXT,
  rights_region TEXT[] NOT NULL DEFAULT '{}',
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT source_target CHECK (
    (title_id IS NOT NULL AND episode_id IS NULL) OR (title_id IS NULL AND episode_id IS NOT NULL)
  ),
  CONSTRAINT source_payload CHECK (
    (integration_mode = 'manifest' AND manifest_url IS NOT NULL)
    OR (integration_mode = 'embed' AND embed_code IS NOT NULL)
  )
);
CREATE INDEX media_sources_title_idx ON public.media_sources (title_id);
CREATE INDEX media_sources_episode_idx ON public.media_sources (episode_id);
GRANT SELECT ON public.media_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_sources TO authenticated;
GRANT ALL ON public.media_sources TO service_role;
ALTER TABLE public.media_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active sources are public" ON public.media_sources FOR SELECT
  USING (
    is_active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until >= now())
  );
CREATE POLICY "admins manage sources" ON public.media_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER media_sources_updated_at BEFORE UPDATE ON public.media_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FAVORITES
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WATCH HISTORY
CREATE TABLE public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX watch_history_unique_movie ON public.watch_history (user_id, title_id) WHERE episode_id IS NULL;
CREATE UNIQUE INDEX watch_history_unique_episode ON public.watch_history (user_id, episode_id) WHERE episode_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history" ON public.watch_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER watch_history_updated_at BEFORE UPDATE ON public.watch_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEMO CONTENT
INSERT INTO public.titles (kind, slug, title, overview, poster_url, backdrop_url, genres, release_date, runtime_minutes, vote_average, is_featured, is_trending, is_published)
VALUES
  ('movie', 'big-buck-bunny', 'Big Buck Bunny', 'Un lapin débonnaire prend sa revanche sur trois rongeurs malveillants dans une forêt luxuriante. Court métrage d''animation libre de droits, idéal pour tester la lecture adaptative.', 'https://image.tmdb.org/t/p/w500/8VjQhR9LhOJtfKz5yvZvGz4Hh4x.jpg', NULL, ARRAY['Animation','Comédie','Famille'], '2008-05-20', 10, 7.6, true, true, true),
  ('movie', 'sintel', 'Sintel', 'Une jeune guerrière traverse un monde hostile à la recherche du dragon qu''elle a élevé. Film d''animation open source diffusé en flux HLS multi-qualité.', NULL, NULL, ARRAY['Animation','Fantastique','Aventure'], '2010-09-27', 15, 7.9, true, true, true),
  ('tv', 'tears-of-steel', 'Tears of Steel', 'Dans un Amsterdam futuriste, une équipe tente de réécrire le passé pour sauver l''humanité. Série de démonstration en flux adaptatif.', NULL, NULL, ARRAY['Science-fiction','Action'], '2012-09-26', 12, 7.2, false, true, true);

INSERT INTO public.media_sources (title_id, label, integration_mode, protocol, manifest_url, quality_label, language)
SELECT id, 'Flux adaptatif HLS', 'manifest', 'hls', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 'Auto (multi-qualité)', 'VF'
FROM public.titles WHERE slug = 'big-buck-bunny';

INSERT INTO public.media_sources (title_id, label, integration_mode, protocol, manifest_url, quality_label, language)
SELECT id, 'Flux adaptatif HLS', 'manifest', 'hls', 'https://test-streams.mux.dev/pts_shift/master.m3u8', 'Auto (multi-qualité)', 'VOSTFR'
FROM public.titles WHERE slug = 'sintel';

INSERT INTO public.seasons (title_id, season_number, name, overview)
SELECT id, 1, 'Saison 1', 'Première saison de démonstration.' FROM public.titles WHERE slug = 'tears-of-steel';

INSERT INTO public.episodes (season_id, episode_number, name, overview, runtime_minutes, air_date)
SELECT s.id, 1, 'Le futur brisé', 'Premier épisode de démonstration.', 12, '2012-09-26'
FROM public.seasons s JOIN public.titles t ON t.id = s.title_id WHERE t.slug = 'tears-of-steel';

INSERT INTO public.media_sources (episode_id, label, integration_mode, protocol, manifest_url, quality_label, language)
SELECT e.id, 'Flux adaptatif HLS', 'manifest', 'hls', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 'Auto (multi-qualité)', 'VOSTFR'
FROM public.episodes e
JOIN public.seasons s ON s.id = e.season_id
JOIN public.titles t ON t.id = s.title_id
WHERE t.slug = 'tears-of-steel' AND e.episode_number = 1;