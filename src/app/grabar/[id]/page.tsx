import { getHymn } from "@/lib/hymns";
import { notFound } from "next/navigation";
import Link from "next/link";
import Studio from "@/components/Studio";

export const dynamic = "force-dynamic";

export default async function GrabarPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();
  const hymn = await getHymn(id);
  if (!hymn) notFound();

  return (
    <div className="max-w-2xl mx-auto min-h-screen">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href={`/himno/${hymn.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{hymn.title}</h1>
          <p className="text-xs text-gray-400">Estudio de grabación</p>
        </div>
      </header>

      <Studio
        hymnId={hymn.id}
        hymnTitle={hymn.title}
        referenceUrl={hymn.audioGeneralUrl}
        referenceType={hymn.audioGeneralType}
        audioSopranoUrl={hymn.audioSopranoUrl}
        audioContraaltoUrl={hymn.audioContraaltoUrl}
        audioTenorUrl={hymn.audioTenorUrl}
        audioBajoUrl={hymn.audioBajoUrl}
      />
    </div>
  );
}
