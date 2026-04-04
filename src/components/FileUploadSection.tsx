"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Slot = "partitura" | "audioGeneral" | "soprano" | "contraalto" | "tenor" | "bajo";

const AUDIO_ACCEPT = "";

const SLOTS: { slot: Slot; label: string; accept: string }[] = [
  { slot: "partitura",    label: "Partitura (PDF)",  accept: ".pdf,application/pdf" },
  { slot: "audioGeneral", label: "Audio General",    accept: AUDIO_ACCEPT },
  { slot: "soprano",      label: "Demo Soprano",     accept: AUDIO_ACCEPT },
  { slot: "contraalto",   label: "Demo Contraalto",  accept: AUDIO_ACCEPT },
  { slot: "tenor",        label: "Demo Tenor",       accept: AUDIO_ACCEPT },
  { slot: "bajo",         label: "Demo Bajo",        accept: AUDIO_ACCEPT },
];

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function UploadIcon({ small }: { small?: boolean }) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

interface DropZoneProps {
  slot: Slot;
  label: string;
  accept: string;
  uploading: Slot | null;
  onFile: (slot: Slot, file: File) => void;
  small?: boolean;
}

function DropZone({ slot, label, accept, uploading, onFile, small }: DropZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = uploading === slot;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(slot, file);
  };

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={accept || undefined}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(slot, f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          w-full flex flex-col items-center justify-center gap-1
          ${small ? "px-2 py-3 text-xs" : "px-3 py-4 text-sm"}
          rounded-xl border-2 border-dashed transition-all
          ${busy
            ? "border-blue-300 bg-blue-50 opacity-70 cursor-not-allowed"
            : dragging
            ? "border-blue-500 bg-blue-50 scale-[1.02]"
            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50 cursor-pointer"
          }
        `}
      >
        {busy ? <Spinner /> : <UploadIcon small={small} />}
        <span className={`font-medium text-gray-600 ${small ? "text-xs" : "text-sm"}`}>
          {busy ? "Subiendo…" : label}
        </span>
        {!busy && (
          <span className="text-gray-400" style={{ fontSize: "10px" }}>
            {dragging ? "Suelta aquí" : "Toca o arrastra"}
          </span>
        )}
      </button>
    </div>
  );
}

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
      const isYt = ytUrl.includes("youtube.com") || ytUrl.includes("youtu.be");
      const res = await fetch(`/api/hymns/${hymnId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioGeneralUrl: ytUrl || null,
          audioGeneralType: ytUrl ? (isYt ? "youtube" : "file") : null,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSavingYt(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Subir / Cambiar Archivos
      </h3>

      {/* Partitura */}
      <div className="mb-3">
        <DropZone
          slot="partitura"
          label="Partitura (PDF)"
          accept=".pdf,application/pdf"
          uploading={uploading}
          onFile={handleFileUpload}
        />
      </div>

      {/* Audio general: URL */}
      <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          URL de referencia (YouTube, SoundCloud, MP3 directo, etc.)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveYtUrl}
            disabled={savingYt}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
          >
            {savingYt ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Audio general: archivo */}
      <div className="mb-4">
        <DropZone
          slot="audioGeneral"
          label="Audio General (MP3, WAV, M4A…)"
          accept={AUDIO_ACCEPT}
          uploading={uploading}
          onFile={handleFileUpload}
        />
      </div>

      {/* Demos por cuerda */}
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Demos por cuerda</p>
      <div className="grid grid-cols-2 gap-2">
        {SLOTS.filter((s) => !["partitura", "audioGeneral"].includes(s.slot)).map(({ slot, label, accept }) => (
          <DropZone
            key={slot}
            slot={slot}
            label={label}
            accept={accept}
            uploading={uploading}
            onFile={handleFileUpload}
            small
          />
        ))}
      </div>
    </div>
  );
}
