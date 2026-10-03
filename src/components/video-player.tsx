import { useEffect, useRef, useState } from "react";

export type PlayableSource = {
  id: string;
  label: string;
  integration_mode: "manifest" | "embed";
  protocol: "hls" | "dash" | "mp4";
  manifest_url: string | null;
  embed_code: string | null;
  quality_label: string | null;
  language: string | null;
  provider_name: string | null;
};

const MIME: Record<string, string> = {
  hls: "application/x-mpegURL",
  dash: "application/dash+xml",
  mp4: "video/mp4",
};

/**
 * Video.js player with HLS (.m3u8) support through @videojs/http-streaming,
 * bundled with Video.js 8. Quality levels exposed by the remote manifest are
 * surfaced in a "Qualité" menu; Auto stays the default.
 */
export function VideoPlayer({
  source,
  poster,
  startAt = 0,
  onProgress,
  onEnded,
}: {
  source: PlayableSource;
  poster?: string | null;
  startAt?: number;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<{ dispose: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ label: string; index: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const qualityApi = useRef<{ setLevel: (index: number) => void } | null>(null);
  const progressCb = useRef(onProgress);
  const endedCb = useRef(onEnded);
  progressCb.current = onProgress;
  endedCb.current = onEnded;

  useEffect(() => {
    if (source.integration_mode !== "manifest" || !source.manifest_url) return;
    let disposed = false;
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);

    (async () => {
      const [{ default: videojs }] = await Promise.all([
        import("video.js"),
        import("video.js/dist/video-js.css"),
      ]);
      if (disposed || !containerRef.current) return;

      const videoEl = document.createElement("video-js");
      videoEl.classList.add("vjs-big-play-centered", "vjs-theme-popcorn");
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(videoEl);

      const player = videojs(videoEl as unknown as HTMLVideoElement, {
        controls: true,
        preload: "auto",
        fluid: false,
        responsive: true,
        playsinline: true,
        poster: poster ?? undefined,
        html5: {
          vhs: { overrideNative: true, limitRenditionByPlayerDimensions: true },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        },
        sources: [
          {
            src: source.manifest_url!,
            type: MIME[source.protocol] ?? MIME["hls"],
          },
        ],
      });

      playerRef.current = player as unknown as { dispose: () => void };

      const anyPlayer = player as unknown as {
        qualityLevels?: () => {
          length: number;
          levels_?: unknown[];
          on: (ev: string, cb: () => void) => void;
          selectedIndex: number;
          [index: number]: { height?: number; bitrate?: number; enabled: boolean };
        };
        currentTime: (t?: number) => number;
        duration: () => number;
        on: (ev: string, cb: () => void) => void;
      };

      if (startAt > 5) anyPlayer.currentTime(startAt);

      const qualityLevels = anyPlayer.qualityLevels?.();
      if (qualityLevels) {
        const refresh = () => {
          const list: { label: string; index: number }[] = [];
          for (let i = 0; i < qualityLevels.length; i += 1) {
            const lvl = qualityLevels[i];
            const height = lvl?.height;
            list.push({
              label: height ? `${height}p` : `Niveau ${i + 1}`,
              index: i,
            });
          }
          list.sort((a, b) => parseInt(b.label) - parseInt(a.label) || a.index - b.index);
          setLevels(list);
        };
        qualityLevels.on("addqualitylevel", refresh);
        qualityLevels.on("change", refresh);
        qualityApi.current = {
          setLevel: (index: number) => {
            for (let i = 0; i < qualityLevels.length; i += 1) {
              const lvl = qualityLevels[i];
              if (lvl) lvl.enabled = index === -1 || i === index;
            }
            setCurrentLevel(index);
          },
        };
      }

      anyPlayer.on("timeupdate", () => {
        const t = anyPlayer.currentTime();
        const d = anyPlayer.duration();
        if (Number.isFinite(t) && Number.isFinite(d) && d > 0) progressCb.current?.(Math.floor(t), Math.floor(d));
      });
      anyPlayer.on("ended", () => endedCb.current?.());
      anyPlayer.on("error", () => {
        setError(
          "Cette source est momentanément indisponible. Essayez une autre source si elle est proposée.",
        );
      });
    })();

    return () => {
      disposed = true;
      playerRef.current?.dispose();
      playerRef.current = null;
      qualityApi.current = null;
    };
  }, [source.id, source.manifest_url, source.protocol, source.integration_mode, poster, startAt]);

  if (source.integration_mode === "embed") {
    return (
      <div className="w-full">
        <div
          className="relative w-full overflow-hidden rounded-lg bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
          style={{ aspectRatio: "16 / 9" }}
          // Le code d'intégration provient du back-office (administrateurs uniquement).
          dangerouslySetInnerHTML={{ __html: source.embed_code ?? "" }}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Lecture assurée par {source.provider_name ?? "l'hébergeur externe"} : les réglages de qualité
          sont ceux de son lecteur.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black shadow-cinema"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div ref={containerRef} className="absolute inset-0" />
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-foreground">
          {error}
        </p>
      ) : null}

      {levels.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Qualité</span>
          <button
            type="button"
            onClick={() => qualityApi.current?.setLevel(-1)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              currentLevel === -1
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            Auto
          </button>
          {levels.map((lvl) => (
            <button
              key={lvl.index}
              type="button"
              onClick={() => qualityApi.current?.setLevel(lvl.index)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                currentLevel === lvl.index
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Qualité disponible : {source.quality_label ?? "unique, telle que fournie par la source"}.
        </p>
      )}
    </div>
  );
}
