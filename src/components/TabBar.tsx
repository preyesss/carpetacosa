"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const tabs = [
  { label: "Repertorio Activo", value: "active" },
  { label: "Backlog", value: "backlog" },
];

export default function TabBar({ activeTab }: { activeTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = (tab: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tab);
    params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => handleClick(tab.value)}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${
            activeTab === tab.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
