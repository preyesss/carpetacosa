"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RecState = "idle" | "recording" | "preview";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function DemoRecorder({
  hymnId,
  slot,
}: {
  hymnId: number;
  slot: string;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const router = useRouter();

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        setState("preview");
      };

      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  const upload = async () => {
    if (!blobRef.current) return;
    setUploading(true);
    try {
      const ext = blobRef.current.type.includes("mp4") ? "mp4" : "webm";
      const file = new File(
        [blobRef.current],
        `${slot}-${Date.now()}.${ext}`,
        { type: blobRef.current.type }
      );
      const form = new FormData();
      form.append("slot", slot);
      form.append("file", file);
      const res = await fetch(`/api/hymns/${hymnId}/upload`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        setState("idle");
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Error al subir la grabación");
      }
    } finally {
      setUploading(false);
    }
  };

  const discard = () => {
    setState("idle");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  if (state === "idle") {
    return (
      <button
        onClick={start}
        className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity mt-1"
        title="Grabar demo"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
        </svg>
        Grabar
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 mt-1">
        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {fmt(seconds)}
        </span>
        <button
          onClick={stop}
          className="text-xs font-medium px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
        >
          Detener
        </button>
      </div>
    );
  }

  // preview
  return (
    <div className="mt-2 space-y-1.5">
      <audio controls className="w-full h-8" src={previewUrl!} />
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={upload}
          disabled={uploading}
          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {uploading ? "Subiendo…" : "Subir"}
        </button>
        <button
          onClick={start}
          disabled={uploading}
          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 transition-colors"
        >
          Re-grabar
        </button>
        <button
          onClick={discard}
          disabled={uploading}
          className="text-xs px-2.5 py-1 rounded-lg text-gray-400 hover:text-gray-600 disabled:opacity-60 transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
