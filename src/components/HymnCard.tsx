import Link from "next/link";
import type { Hymn } from "@prisma/client";

const TAG_STYLES: Record<string, string> = {
  CIPSA: "bg-blue-100 text-blue-700",
  Funeral: "bg-gray-200 text-gray-700",
  Bienvenida: "bg-green-100 text-green-700",
  Predicacion: "bg-orange-100 text-orange-700",
  "Santa Cena": "bg-purple-100 text-purple-700",
  Himnario: "bg-slate-100 text-slate-700",
};

const TYPE_STYLES: Record<string, string> = {
  Himnario: "bg-slate-100 text-slate-600",
  Villancico: "bg-red-100 text-red-600",
  Spirituals: "bg-amber-100 text-amber-600",
  "Santa Cena": "bg-purple-100 text-purple-600",
};

export default function HymnCard({ hymn }: { hymn: Hymn }) {
  const tagStyle = hymn.tag ? TAG_STYLES[hymn.tag] ?? "bg-gray-100 text-gray-600" : null;
  const typeStyle = hymn.hymnType ? TYPE_STYLES[hymn.hymnType] ?? "bg-gray-100 text-gray-600" : null;

  return (
    <Link
      href={`/himno/${hymn.id}`}
      className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all duration-150 min-h-[60px]"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{hymn.title}</p>
        {hymn.composer && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{hymn.composer}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {hymn.hasDemo && (
          <span className="w-2 h-2 rounded-full bg-green-500" title="Demo disponible" />
        )}
        {hymn.tag && tagStyle && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagStyle}`}>
            {hymn.tag}
          </span>
        )}
        {hymn.hymnType && !hymn.tag && typeStyle && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeStyle}`}>
            {hymn.hymnType}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
