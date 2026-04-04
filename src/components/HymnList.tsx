import type { Hymn } from "@prisma/client";
import HymnCard from "./HymnCard";

export default function HymnList({
  hymns,
  emptyMessage,
}: {
  hymns: Hymn[];
  emptyMessage?: string;
}) {
  if (hymns.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg
          className="mx-auto w-10 h-10 mb-3 opacity-40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <p className="text-sm">{emptyMessage ?? "No se encontraron himnos"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hymns.map((hymn) => (
        <HymnCard key={hymn.id} hymn={hymn} />
      ))}
    </div>
  );
}
