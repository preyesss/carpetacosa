"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/plugins/regions";

/* ── WAV encoder ──────────────────────────────────────────────── */
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
  for (let i = 0; i < buffer.length; i++)
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  return new Blob([ab], { type: "audio/wav" });
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
}

/* ── Types ──────────────────────────────────────────────────────── */
type Slot = "soprano" | "contraalto" | "tenor" | "bajo";
type RecPhase = "idle" | "recording" | "reviewing" | "uploading";

const VOICES: { slot: Slot; label: string; color: string; bg: string }[] = [
  { slot: "soprano",    label: "Soprano",    color: "#db2777", bg: "#fdf2f8" },
  { slot: "contraalto", label: "Contraalto", color: "#7c3aed", bg: "#f5f3ff" },
  { slot: "tenor",      label: "Tenor",      color: "#2563eb", bg: "#eff6ff" },
  { slot: "bajo",       label: "Bajo",       color: "#374151", bg: "#f9fafb" },
];

/* ── VU Meter ───────────────────────────────────────────────────── */
function VuMeter({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-end gap-1">
      {levels.map((lvl, i) => (
        <div key={i} className="flex flex-col-reverse gap-px items-center">
          <span className="text-[9px] text-gray-400 mb-0.5">{i === 0 ? "L" : "R"}</span>
          {Array.from({ length: 10 }).map((_, bar) => (
            <div
              key={bar}
              className="w-2.5 h-1.5 rounded-sm transition-colors duration-75"
              style={{
                backgroundColor:
                  bar / 10 < lvl
                    ? bar > 7 ? "#ef4444" : bar > 5 ? "#f59e0b" : "#22c55e"
                    : "#e5e7eb",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Voice Track ────────────────────────────────────────────────── */
function VoiceTrack({
  hymnId,
  slot,
  label,
  color,
  bg,
  existingUrl,
  referenceUrl,
  referenceType,
  onRecordStart,
  onRecordEnd,
  isBlocked,
}: {
  hymnId: number;
  slot: Slot;
  label: string;
  color: string;
  bg: string;
  existingUrl: string | null;
  referenceUrl: string | null;
  referenceType: string | null;
  onRecordStart: () => void;
  onRecordEnd: () => void;
  isBlocked: boolean;
}) {
  const [phase, setPhase] = useState<RecPhase>("idle");
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
  const refAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    wsRef.current?.destroy();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    refAudioRef.current?.pause();
  }, []);

  /* Init WaveSurfer on review */
  useEffect(() => {
    if (phase !== "reviewing" || !waveRef.current || !blobUrlRef.current) return;
    wsRef.current?.destroy();
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: color + "88",
      progressColor: color,
      height: 56,
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
        start: 0, end: dur,
        color: color + "22",
        drag: true, resize: true,
      });
      regionRef.current = reg;
      setTrimInfo({ start: 0, end: dur });
      reg.on("update-end", () =>
        setTrimInfo({ start: reg.start, end: reg.end })
      );
    });
    wsRef.current = ws;
    return () => ws.destroy();
  }, [phase, color]);

  const startRecording = async () => {
    try {
      onRecordStart();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 2, sampleRate: 44100, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

      /* Play reference audio */
      if (referenceUrl && referenceType !== "youtube") {
        const audio = new Audio(referenceUrl);
        audio.volume = 0.8;
        refAudioRef.current = audio;
        audio.play().catch(() => {});
      }

      /* VU meters */
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const splitter = audioCtx.createChannelSplitter(2);
      const analysers = [0, 1].map(() => {
        const a = audioCtx.createAnalyser(); a.fftSize = 256; return a;
      });
      src.connect(splitter);
      analysers.forEach((a, i) => splitter.connect(a, i));
      const buf = new Uint8Array(analysers[0].frequencyBinCount);
      const tick = () => {
        const lvls = analysers.map((a) => {
          a.getByteFrequencyData(buf);
          return Math.min(1, Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length) / 64);
        });
        setLevels(lvls);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);

      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        refAudioRef.current?.pause();
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setLevels([0, 0]);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        rawBlobRef.current = blob;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = URL.createObjectURL(blob);
        setPhase("reviewing");
        onRecordEnd();
      };
      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
      setSecs(0);
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      onRecordEnd();
      alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  const applyTrimAndUpload = async () => {
    if (!rawBlobRef.current) return;
    setPhase("uploading");
    try {
      let finalBlob: Blob = rawBlobRef.current;
      if (trimInfo) {
        const decoded = await new AudioContext().decodeAudioData(await rawBlobRef.current.arrayBuffer());
        const sr = decoded.sampleRate;
        const s0 = Math.floor(trimInfo.start * sr);
        const s1 = Math.floor(trimInfo.end * sr);
        const trimmed = new AudioContext().createBuffer(decoded.numberOfChannels, s1 - s0, sr);
        for (let ch = 0; ch < decoded.numberOfChannels; ch++)
          trimmed.copyToChannel(decoded.getChannelData(ch).subarray(s0, s1), ch);
        finalBlob = encodeWav(trimmed);
      }
      const file = new File([finalBlob], `${slot}-${Date.now()}.wav`, { type: "audio/wav" });
      const form = new FormData();
      form.append("slot", slot);
      form.append("file", file);
      const res = await fetch(`/api/hymns/${hymnId}/upload`, { method: "POST", body: form });
      if (res.ok) { setPhase("idle"); router.refresh(); }
      else { alert((await res.json().catch(() => ({}))).error ?? "Error al subir"); setPhase("reviewing"); }
    } catch { alert("Error procesando el audio"); setPhase("reviewing"); }
  };

  const discard = () => {
    wsRef.current?.destroy();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null; rawBlobRef.current = null;
    setPhase("idle");
  };

  const hasRef = referenceUrl && referenceType !== "youtube";

  return (
    <div className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: color + "44", backgroundColor: bg }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm" style={{ color }}>{label}</span>
        {existingUrl && phase === "idle" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Demo subido</span>
        )}
      </div>

      {/* Existing demo */}
      {existingUrl && phase === "idle" && (
        <audio controls className="w-full h-8" src={existingUrl} />
      )}

      {/* ── idle ── */}
      {phase === "idle" && (
        <div className="space-y-1">
          <button
            onClick={startRecording}
            disabled={isBlocked}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: color }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
            </svg>
            {existingUrl ? "Re-grabar" : "Grabar"}
          </button>
          {hasRef && (
            <p className="text-[10px] text-gray-400">El audio de referencia sonará automáticamente</p>
          )}
          {referenceType === "youtube" && (
            <p className="text-[10px] text-amber-600">
              YouTube: reproduce el video manualmente y presiona Grabar con auriculares
            </p>
          )}
        </div>
      )}

      {/* ── recording ── */}
      {phase === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <VuMeter levels={levels} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg font-mono font-bold text-red-600">{fmt(secs)}</span>
              </div>
              {hasRef && <span className="text-xs text-gray-500">🎵 Referencia sonando…</span>}
            </div>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Detener
          </button>
        </div>
      )}

      {/* ── reviewing ── */}
      {phase === "reviewing" && (
        <div className="space-y-2">
          <div ref={waveRef} className="w-full rounded-xl overflow-hidden bg-gray-900 px-1 py-1" />
          {trimInfo && (
            <p className="text-[10px] text-gray-400">
              {fmt(trimInfo.start)} → {fmt(trimInfo.end)}
              {" · "}{(trimInfo.end - trimInfo.start).toFixed(1)}s
              <span className="ml-1 opacity-50">· Arrastra los bordes para recortar</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { playing ? wsRef.current?.pause() : wsRef.current?.play(); }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {playing
                ? <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg> Pausa</>
                : <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg> Reproducir</>
              }
            </button>
            <button
              onClick={applyTrimAndUpload}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-colors"
              style={{ backgroundColor: color }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Subir
            </button>
            <button
              onClick={startRecording}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Re-grabar
            </button>
            <button onClick={discard} className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* ── uploading ── */}
      {phase === "uploading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Procesando y subiendo…
        </div>
      )}
    </div>
  );
}

/* ── Studio ─────────────────────────────────────────────────────── */
function extractYtId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function Studio({
  hymnId, hymnTitle,
  referenceUrl, referenceType,
  audioSopranoUrl, audioContraaltoUrl, audioTenorUrl, audioBajoUrl,
}: {
  hymnId: number;
  hymnTitle: string;
  referenceUrl: string | null;
  referenceType: string | null;
  audioSopranoUrl: string | null;
  audioContraaltoUrl: string | null;
  audioTenorUrl: string | null;
  audioBajoUrl: string | null;
}) {
  const [activeRecording, setActiveRecording] = useState<Slot | null>(null);
  const [ytExpanded, setYtExpanded] = useState(false);

  const existingUrls: Record<Slot, string | null> = {
    soprano: audioSopranoUrl,
    contraalto: audioContraaltoUrl,
    tenor: audioTenorUrl,
    bajo: audioBajoUrl,
  };

  const ytId = referenceUrl && referenceType === "youtube" ? extractYtId(referenceUrl) : null;

  return (
    <div className="px-4 py-6 space-y-6">

      {/* ── Pista de referencia ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">1</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">Pista de referencia</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Solo escuchar</span>
        </div>

        {!referenceUrl && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-400 text-center">
            Sin audio de referencia — agrégalo desde la página del himno
          </div>
        )}

        {referenceUrl && referenceType !== "youtube" && (
          <audio controls className="w-full rounded-xl" src={referenceUrl} />
        )}

        {ytId && (
          <div className="space-y-2">
            <div
              className="relative rounded-xl overflow-hidden bg-black transition-all duration-300"
              style={{ aspectRatio: "16/9", width: ytExpanded ? "100%" : "55%" }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                title="Referencia"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="absolute inset-0 w-full h-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setYtExpanded(!ytExpanded)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {ytExpanded ? "Reducir" : "Ampliar"}
              </button>
              <p className="text-[10px] text-amber-600">
                Usa auriculares para que la referencia no entre al micrófono
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Pistas de voz ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">2</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">Cuerdas</span>
          {activeRecording && (
            <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Grabando {VOICES.find(v => v.slot === activeRecording)?.label}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {VOICES.map(({ slot, label, color, bg }) => (
            <VoiceTrack
              key={slot}
              hymnId={hymnId}
              slot={slot}
              label={label}
              color={color}
              bg={bg}
              existingUrl={existingUrls[slot]}
              referenceUrl={referenceUrl}
              referenceType={referenceType}
              isBlocked={activeRecording !== null && activeRecording !== slot}
              onRecordStart={() => setActiveRecording(slot)}
              onRecordEnd={() => setActiveRecording(null)}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center pb-4">
        Usa auriculares para grabar con la referencia sonando sin interferencias
      </p>
    </div>
  );
}
