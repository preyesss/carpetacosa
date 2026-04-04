"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MissingFilter } from "@/lib/hymns";

const OPTIONS: { value: MissingFilter; label: string; icon: string }[] = [
  { value: "partitura", label: "Sin partitura", icon: "📄" },
  { value: "audio",     label: "Sin audio",     icon: "🎵" },
  { value: "demos",     label: "Sin demos",     icon: "🎤" },
];

export default function MissingFilterBar({
  active,
}: {
  active: MissingFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggle = (value: MissingFilter) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const current = params.get("missing")?.split(",").filter(Boolean) as MissingFilter[] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    if (next.length > 0) {
      params.set("missing", next.join(","));
    } else {
      params.delete("missing");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(({ value, label, icon }) => {
        const isActive = active.includes(value);
        return (
          <button
            key={value}
            onClick={() => toggle(value)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              isActive
                ? "bg-amber-100 border-amber-300 text-amber-800"
                : "bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            <span>{icon}</span>
            {label}
            {isActive && (
              <span className="ml-0.5 text-amber-600">×</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
