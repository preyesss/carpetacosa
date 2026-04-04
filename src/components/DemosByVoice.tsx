const VOICES = [
  { key: "soprano", label: "Soprano", color: "text-pink-600 bg-pink-50 border-pink-200" },
  { key: "contraalto", label: "Contraalto", color: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "tenor", label: "Tenor", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "bajo", label: "Bajo", color: "text-gray-700 bg-gray-50 border-gray-200" },
] as const;

interface Props {
  audioSopranoUrl: string | null;
  audioContraaltoUrl: string | null;
  audioTenorUrl: string | null;
  audioBajoUrl: string | null;
}

export default function DemosByVoice({
  audioSopranoUrl,
  audioContraaltoUrl,
  audioTenorUrl,
  audioBajoUrl,
}: Props) {
  const urls: Record<string, string | null> = {
    soprano: audioSopranoUrl,
    contraalto: audioContraaltoUrl,
    tenor: audioTenorUrl,
    bajo: audioBajoUrl,
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Demos por Cuerda</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VOICES.map(({ key, label, color }) => (
          <div key={key} className={`rounded-xl border p-3 ${color}`}>
            <p className="text-xs font-semibold mb-2">{label}</p>
            {urls[key] ? (
              <audio controls className="w-full h-8" src={urls[key]!}>
                Tu navegador no soporta el elemento de audio.
              </audio>
            ) : (
              <div className="h-8 flex items-center">
                <span className="text-xs opacity-60">Sin demo</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
