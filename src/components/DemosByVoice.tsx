import ProDemoRecorder from "./ProDemoRecorder";

const VOICES = [
  { key: "soprano",    label: "Soprano",    accent: "#db2777" },
  { key: "contraalto", label: "Contraalto", accent: "#7c3aed" },
  { key: "tenor",      label: "Tenor",      accent: "#2563eb" },
  { key: "bajo",       label: "Bajo",       accent: "#64748b" },
] as const;

interface Props {
  hymnId: number;
  audioSopranoUrl: string | null;
  audioContraaltoUrl: string | null;
  audioTenorUrl: string | null;
  audioBajoUrl: string | null;
}

export default function DemosByVoice({
  hymnId,
  audioSopranoUrl,
  audioContraaltoUrl,
  audioTenorUrl,
  audioBajoUrl,
}: Props) {
  const urls: Record<string, string | null> = {
    soprano:    audioSopranoUrl,
    contraalto: audioContraaltoUrl,
    tenor:      audioTenorUrl,
    bajo:       audioBajoUrl,
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Demos por Cuerda
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {VOICES.map(({ key, label, accent }) => (
          <div key={key} className="rounded-xl border border-gray-100 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                <p className="text-xs font-semibold text-gray-800">{label}</p>
              </div>
              {urls[key] && (
                <a
                  href={urls[key]!}
                  download
                  className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  title={`Descargar demo ${label}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}
            </div>

            {urls[key] ? (
              <audio controls className="w-full h-8" src={urls[key]!}>
                Tu navegador no soporta el elemento de audio.
              </audio>
            ) : (
              <div className="h-8 flex items-center">
                <span className="text-xs text-gray-400">Sin demo</span>
              </div>
            )}

            <ProDemoRecorder hymnId={hymnId} slot={key} />
          </div>
        ))}
      </div>
    </div>
  );
}
