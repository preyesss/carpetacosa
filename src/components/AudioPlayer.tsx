"use client";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function AudioPlayer({
  url,
  type,
  label = "Audio General",
}: {
  url: string | null;
  type: string | null;
  label?: string;
}) {
  if (!url) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-100 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-center text-gray-400">
          <svg className="mx-auto w-6 h-6 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <p className="text-xs">Sin audio</p>
        </div>
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
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      ) : (
        <audio controls className="w-full rounded-xl" src={url}>
          Tu navegador no soporta el elemento de audio.
        </audio>
      )}
    </div>
  );
}
