"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/plugins/regions";

type Phase = "idle" | "recording" | "editing" | "uploading";

/* ── WAV encoder ─────────────────────────────────────────────────── */
function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const dataLen = buffer.length * numCh * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));

  str(0, "RIFF"); v.setUint32(4, 36 + dataLen, true);
  str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * numCh * 2, true); v.setUint16(32, numCh * 2, true);
  v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

/* ── Component ───────────────────────────────────────────────────── */
export default function ProDemoRecorder({
  hymnId,
  slot,
}: {
  hymnId: number;
  slot: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState([0, 0]);
  const [playing, setPlaying] = useState(false);
  const [trimInfo, setTrimInfo] = useState<{ start: number; end: number } | null>(null);

  const router = useRouter();
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<number | null>(null);
  const rawBlobRef = useRef<Blob | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  /* cleanup on unmount */
  useEffect(() => () => {
    wsRef.current?.destroy();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  /* ── Init WaveSurfer when entering editing phase ──────────────── */
  useEffect(() => {
    if (phase !== "editing" || !waveRef.current || !blobUrlRef.current) return;
    wsRef.current?.destroy();

    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "#93c5fd",
      progressColor: "#2563eb",
      height: 72,
      barWidth: 2,
      barGap: 1,
      barRadius: 3,
      plugins: [regions],
    });

    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));

    ws.load(blobUrlRef.current).then(() => {
      const dur = ws.getDuration();
      const reg = regions.addRegion({
        start: 0,
        end: dur,
        color: "rgba(37,99,235,0.12)",
        drag: true,
        resize: true,
      });
      regionRef.current = reg;
      setTrimInfo({ start: 0, end: dur });
      reg.on("update-end", () =>
        setTrimInfo({ start: reg.start, end: reg.end })
      );
    });

    wsRef.current = ws;
    return () => ws.destroy();
  }, [phase]);

  /* ── Start recording ─────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2,
          sampleRate: 44100,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      /* level meters via Web Audio */
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const splitter = audioCtx.createChannelSplitter(2);
      const analysers = [0, 1].map(() => {
        const a = audioCtx.createAnalyser();
        a.fftSize = 256;
        return a;
      });
      src.connect(splitter);
      analysers.forEach((a, i) => splitter.connect(a, i));

      const tick = () => {
        const buf = new Uint8Array(analysers[0].frequencyBinCount);
        const lvls = analysers.map((a) => {
          a.getByteFrequencyData(buf);
          return Math.min(
            1,
            Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length) / 64
          );
        });
        setLevels(lvls);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);

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
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setLevels([0, 0]);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        rawBlobRef.current = blob;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = URL.createObjectURL(blob);
        setPhase("editing");
      };

      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
      setSecs(0);
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      alert("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  /* ── Trim: decode → slice → re-encode as WAV ─────────────────── */
  const applyTrim = async (): Promise<Blob> => {
    if (!rawBlobRef.current || !trimInfo) return rawBlobRef.current!;
    const { start, end } = trimInfo;
    const ab = await rawBlobRef.current.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(ab);
    const sr = decoded.sampleRate;
    const s0 = Math.floor(start * sr);
    const s1 = Math.floor(end * sr);
    const len = s1 - s0;
    const trimmed = audioCtx.createBuffer(decoded.numberOfChannels, len, sr);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      trimmed.copyToChannel(decoded.getChannelData(ch).subarray(s0, s1), ch);
    }
    return encodeWav(trimmed);
  };

  /* ── Upload ──────────────────────────────────────────────────── */
  const upload = async () => {
    setPhase("uploading");
    try {
      const finalBlob = await applyTrim();
      const file = new File([finalBlob], `${slot}-${Date.now()}.wav`, {
        type: "audio/wav",
      });
      const form = new FormData();
      form.append("slot", slot);
      form.append("file", file);
      const res = await fetch(`/api/hymns/${hymnId}/upload`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        setPhase("idle");
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Error al subir");
        setPhase("editing");
      }
    } catch {
      alert("Error procesando el audio");
      setPhase("editing");
    }
  };

  const discard = () => {
    wsRef.current?.destroy();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    rawBlobRef.current = null;
    setPhase("idle");
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  /* ── IDLE ────────────────────────────────────────────────────── */
  if (phase === "idle") {
    return (
      <button
        onClick={startRecording}
        className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity mt-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
        </svg>
        Grabar
      </button>
    );
  }

  /* ── RECORDING ───────────────────────────────────────────────── */
  if (phase === "recording") {
    return (
      <div className="mt-2 space-y-2">
        {/* Level meters L / R */}
        <div className="flex items-end gap-1 h-8">
          {levels.map((lvl, i) => (
            <div key={i} className="flex flex-col-reverse gap-0.5 items-center">
              <span className="text-[9px] text-gray-400">{i === 0 ? "L" : "R"}</span>
              <div className="flex flex-col-reverse gap-px">
                {Array.from({ length: 12 }).map((_, bar) => (
                  <div
                    key={bar}
                    className="w-3 h-1.5 rounded-sm transition-colors"
                    style={{
                      backgroundColor:
                        bar / 12 < lvl
                          ? bar > 9 ? "#ef4444" : bar > 6 ? "#f59e0b" : "#22c55e"
                          : "#e5e7eb",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex-1 flex items-center gap-2 pl-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono font-bold text-red-600">{fmt(secs)}</span>
          </div>
        </div>
        <button
          onClick={stopRecording}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
          Detener
        </button>
      </div>
    );
  }

  /* ── EDITING ─────────────────────────────────────────────────── */
  if (phase === "editing") {
    const dur = wsRef.current?.getDuration() ?? 0;
    return (
      <div className="mt-2 space-y-2">
        {/* Waveform */}
        <div
          ref={waveRef}
          className="w-full rounded-xl overflow-hidden bg-gray-900 px-2 py-1"
        />

        {/* Trim info */}
        {trimInfo && (
          <p className="text-[10px] text-gray-400">
            Selección: {fmt(Math.round(trimInfo.start))} → {fmt(Math.round(trimInfo.end))}
            {" · "}
            {(trimInfo.end - trimInfo.start).toFixed(1)}s
            {dur > 0 && (
              <span className="ml-1 opacity-60">
                (total {fmt(Math.round(dur))})
              </span>
            )}
          </p>
        )}

        {/* Controles */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              if (playing) wsRef.current?.pause();
              else wsRef.current?.play();
            }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {playing ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="4" width="4" height="16" rx="1" />
                <rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
            {playing ? "Pausa" : "Reproducir"}
          </button>

          <button
            onClick={upload}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {trimInfo && dur > 0 && Math.round(trimInfo.end - trimInfo.start) < Math.round(dur)
              ? "Cortar y subir"
              : "Subir"}
          </button>

          <button
            onClick={startRecording}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Re-grabar
          </button>

          <button
            onClick={discard}
            className="text-xs px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            Descartar
          </button>
        </div>

        <p className="text-[10px] text-gray-400">
          Arrastra los bordes de la región azul para recortar
        </p>
      </div>
    );
  }

  /* ── UPLOADING ───────────────────────────────────────────────── */
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Procesando y subiendo…
    </div>
  );
}
