"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Slot =
  | "partitura"
  | "audioGeneral"
  | "soprano"
  | "contraalto"
  | "tenor"
  | "bajo";

const AUDIO_ACCEPT = "audio/*,.m4a,audio/mp4,audio/x-m4a";

const SLOTS: { slot: Slot; label: string; accept: string }[] = [
  { slot: "partitura",   label: "Partitura (PDF)", accept: ".pdf,application/pdf" },
  { slot: "audioGeneral", label: "Audio General",  accept: `${AUDIO_ACCEPT},video/mp4` },
  { slot: "soprano",     label: "Demo Soprano",    accept: AUDIO_ACCEPT },
  { slot: "contraalto",  label: "Demo Contraalto", accept: AUDIO_ACCEPT },
  { slot: "tenor",       label: "Demo Tenor",      accept: AUDIO_ACCEPT },
  { slot: "bajo",        label: "Demo Bajo",       accept: AUDIO_ACCEPT },
];

export default function FileUploadSection({
  hymnId,
  audioGeneralUrl,
}: {
  hymnId: number;
  audioGeneralUrl: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState<Slot | null>(null);
  const [ytUrl, setYtUrl] = useState(audioGeneralUrl ?? "");
  const [savingYt, setSavingYt] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileUpload = async (slot: Slot, file: File) => {
    setUploading(slot);
    try {
      const form = new FormData();
      form.append("slot", slot);
      form.append("file", file);
      const res = await fetch(`/api/hymns/${hymnId}/upload`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Error al subir el archivo");
      }
    } finally {
      setUploading(null);
    }
  };

  const handleSaveYtUrl = async () => {
    setSavingYt(true);
    try {
      const isYt =
        ytUrl.includes("youtube.com") || ytUrl.includes("youtu.be");
      const res = await fetch(`/api/hymns/${hymnId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioGeneralUrl: ytUrl || null,
          audioGeneralType: ytUrl ? (isYt ? "youtube" : "file") : null,
        }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSavingYt(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Subir / Cambiar Archivos
      </h3>

      {/* YouTube URL input for audioGeneral */}
      <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          URL de referencia (YouTube, SoundCloud, MP3 directo, etc.)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... o https://ejemplo.com/himno.mp3"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveYtUrl}
            disabled={savingYt}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
          >
            {savingYt ? "..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Audio general: file upload */}
      <div className="mb-3">
        <input
          ref={(el) => { refs.current["audioGeneral"] = el; }}
          type="file"
          accept={`${AUDIO_ACCEPT},video/mp4`}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload("audioGeneral", f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => refs.current["audioGeneral"]?.click()}
          disabled={uploading === "audioGeneral"}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 text-sm text-gray-600 font-medium transition-all disabled:opacity-60"
        >
          {uploading === "audioGeneral" ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
          O subir archivo de audio general (MP3, WAV, etc.)
        </button>
      </div>

      {/* File upload buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SLOTS.filter((s) => s.slot !== "audioGeneral").map(
          ({ slot, label, accept }) => (
            <div key={slot}>
              <input
                ref={(el) => { refs.current[slot] = el; }}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(slot, f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => refs.current[slot]?.click()}
                disabled={uploading === slot}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 text-xs text-gray-600 font-medium transition-all disabled:opacity-60"
              >
                {uploading === slot ? (
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                )}
                {label}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
