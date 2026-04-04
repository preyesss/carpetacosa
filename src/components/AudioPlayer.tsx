"use client";

import { useState } from "react";

function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

export default function AudioPlayer({
  url,
  type,
  label = "Audio General",
  hymnTitle,
}: {
  url: string | null;
  type: string | null;
  label?: string;
  hymnTitle?: string;
}) {
  const [showVideo, setShowVideo] = useState(false);

  if (!url) {
    const q = hymnTitle ? encodeURIComponent(hymnTitle + " himno") : "";
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          {label}
        </p>
        <p className="text-sm text-gray-400 mb-3">Sin audio todavía.</p>
        {hymnTitle && (
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.youtube.com/results?search_query=${q}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.75 15.5v-7l6.25 3.5-6.25 3.5z"/>
              </svg>
              Buscar en YouTube
            </a>
            <a
              href={`https://open.spotify.com/search/${q}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Buscar en Spotify
            </a>
          </div>
        )}
      </div>
    );
  }

  const isYouTube = type === "youtube";
  const ytId = isYouTube ? extractYouTubeId(url) : null;

  return (
    <div>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
        {label}
      </span>

      {isYouTube && ytId ? (
        <div className="space-y-1.5">
          {/* Player: collapsed = solo controles (56px), expandido = video completo */}
          <div
            className="relative overflow-hidden rounded-xl bg-black"
            style={{ height: showVideo ? undefined : "56px" }}
          >
            <div
              className="w-full"
              style={
                showVideo
                  ? { position: "relative", paddingBottom: "56.25%" }
                  : { position: "absolute", bottom: 0, left: 0, width: "100%", paddingBottom: "56.25%" }
              }
            >
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                title={label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          <button
            onClick={() => setShowVideo(!showVideo)}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showVideo
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              }
            </svg>
            {showVideo ? "Ocultar video" : "Ver video"}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <audio controls className="w-full rounded-xl" src={url}>
            Tu navegador no soporta el elemento de audio.
          </audio>
          <a
            href={url}
            download
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar audio
          </a>
        </div>
      )}
    </div>
  );
}
