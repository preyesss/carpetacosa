import { getHymns, type MissingFilter } from "@/lib/hymns";
import TabBar from "@/components/TabBar";
import SearchBar from "@/components/SearchBar";
import HymnList from "@/components/HymnList";
import MissingFilterBar from "@/components/MissingFilter";
import AddHymnButton from "@/components/AddHymnButton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { tab?: string; q?: string; missing?: string };
}

export default async function RepertorioPage({ searchParams }: Props) {
  const tab = searchParams.tab === "backlog" ? "backlog" : "active";
  const query = searchParams.q ?? "";
  const status = tab === "active" ? "ACTIVE" : "BACKLOG";

  const missing = (searchParams.missing?.split(",").filter(Boolean) ?? []) as MissingFilter[];

  const hymns = await getHymns(status, query || undefined, missing.length > 0 ? missing : undefined);

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Repertorio</h1>
          <AddHymnButton defaultStatus={status} />
        </div>
        <Suspense>
          <TabBar activeTab={tab} />
        </Suspense>
        <Suspense>
          <SearchBar defaultValue={query} />
        </Suspense>
        <Suspense>
          <MissingFilterBar active={missing} />
        </Suspense>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            {hymns.length} {hymns.length === 1 ? "himno" : "himnos"}
            {query ? ` · "${query}"` : ""}
            {missing.length > 0 ? ` · faltan: ${missing.join(", ")}` : ""}
          </span>
        </div>
        <HymnList
          hymns={hymns}
          emptyMessage={
            query || missing.length > 0
              ? "No se encontraron himnos con esos filtros"
              : tab === "active"
              ? "No hay himnos en el repertorio activo"
              : "El backlog está vacío"
          }
        />
      </main>
    </div>
  );
}
