"use client";

import { useState } from "react";

export default function PartituraViewer({ url }: { url: string | null }) {
  const [fullscreen, setFullscreen] = useState(false);

  if (!url) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-100 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-center text-gray-400">
          <svg className="mx-auto w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Sin partitura</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Partitura</span>
        <div className="flex gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Abrir
          </a>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {fullscreen ? "Reducir" : "Expandir"}
          </button>
        </div>
      </div>
      <iframe
        src={url}
        className={`w-full rounded-xl border border-gray-200 bg-white transition-all duration-300 ${
          fullscreen ? "h-screen" : "h-[500px]"
        }`}
        title="Partitura"
      />
    </div>
  );
}
