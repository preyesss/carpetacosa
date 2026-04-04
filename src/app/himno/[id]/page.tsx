import { getHymn } from "@/lib/hymns";
import { notFound } from "next/navigation";
import Link from "next/link";
import PartituraViewer from "@/components/PartituraViewer";
import AudioPlayer from "@/components/AudioPlayer";
import DemosByVoice from "@/components/DemosByVoice";
import MoveToActiveButton from "@/components/MoveToActiveButton";
import FileUploadSection from "@/components/FileUploadSection";

export const dynamic = "force-dynamic";

const TAG_STYLES: Record<string, string> = {
  CIPSA: "bg-blue-100 text-blue-700",
  Funeral: "bg-gray-200 text-gray-700",
  Bienvenida: "bg-green-100 text-green-700",
  Predicacion: "bg-orange-100 text-orange-700",
  "Santa Cena": "bg-purple-100 text-purple-700",
  Himnario: "bg-slate-100 text-slate-700",
};

function MetaRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return (
    <div className="flex gap-2">
      <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700">{String(value)}</span>
    </div>
  );
}

export default async function HimnoPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const hymn = await getHymn(id);
  if (!hymn) notFound();

  const tagStyle = hymn.tag ? TAG_STYLES[hymn.tag] ?? "bg-gray-100 text-gray-600" : null;
  const hasAnyDemo =
    hymn.audioSopranoUrl ||
    hymn.audioContraaltoUrl ||
    hymn.audioTenorUrl ||
    hymn.audioBajoUrl;

  return (
    <div className="max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link
          href="/repertorio"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{hymn.title}</h1>
            {hymn.tag && tagStyle && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagStyle}`}>
                {hymn.tag}
              </span>
            )}
            {hymn.status === "BACKLOG" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                Backlog
              </span>
            )}
          </div>
          {hymn.composer && (
            <p className="text-sm text-gray-400 mt-0.5">{hymn.composer}</p>
          )}
        </div>
        {hymn.status === "BACKLOG" && (
          <MoveToActiveButton hymnId={hymn.id} />
        )}
      </header>

      {/* Partitura — protagonista */}
      <div className="px-4 pt-4">
        <PartituraViewer url={hymn.partituraPdfUrl} />
      </div>

      {/* Resto del contenido */}
      <div className="px-4 pb-8 mt-6 space-y-6">
        {/* Audio general */}
        <AudioPlayer
          url={hymn.audioGeneralUrl}
          type={hymn.audioGeneralType}
          label="Audio General"
          hymnTitle={hymn.title}
        />

        {/* Demos por cuerda */}
        <DemosByVoice
          audioSopranoUrl={hymn.audioSopranoUrl}
          audioContraaltoUrl={hymn.audioContraaltoUrl}
          audioTenorUrl={hymn.audioTenorUrl}
          audioBajoUrl={hymn.audioBajoUrl}
        />

        {/* Metadata compacta */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          <MetaRow label="Tipo" value={hymn.hymnType} />
          <MetaRow label="Versión" value={hymn.version} />
          <MetaRow label="N° Himnario" value={hymn.hymnaryNumber ?? undefined} />
          <MetaRow label="Demo disponible" value={hymn.hasDemo ? "Sí" : undefined} />
          <MetaRow label="Solista" value={hymn.soloistNote} />
          <MetaRow label="Conf. 2021" value={hymn.inConference2021 ? "Sí" : undefined} />
          <MetaRow
            label="Fuente"
            value={
              hymn.source === "BOTH" ? "2025 + 2020"
              : hymn.source === "2025" ? "Repertorio 2025"
              : "Listado 2020"
            }
          />
        </div>

        {/* Subir archivos */}
        <div className="border-t border-gray-100 pt-6">
          <FileUploadSection
            hymnId={hymn.id}
            audioGeneralUrl={hymn.audioGeneralUrl}
          />
        </div>
      </div>
    </div>
  );
}
