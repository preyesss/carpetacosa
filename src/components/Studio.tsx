"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/plugins/regions";
import RecordPlugin from "wavesurfer.js/plugins/record";

/* ── WAV encoder ─────────────────────────────────────────────────── */
function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const dataLen = buffer.length * numCh * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
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
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
    }
  return new Blob([ab], { type: "audio/wav" });
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
}

type Slot = "soprano" | "contraalto" | "tenor" | "bajo";
type TrackState = "idle" | "recording";

const TRACKS: { id: string; label: string; color: string; slot?: Slot }[] = [
  { id: "referencia", label: "Referencia", color: "#10b981" },
  { id: "soprano",    label: "Soprano",    color: "#db2777", slot: "soprano" },
  { id: "contraalto", label: "Contraalto", color: "#7c3aed", slot: "contraalto" },
  { id: "tenor",      label: "Tenor",      color: "#2563eb", slot: "tenor" },
  { id: "bajo",       label: "Bajo",       color: "#78716c", slot: "bajo" },
];

/* ── Track Row ───────────────────────────────────────────────────── */
function TrackRow({
  label, color, slot,
  url, ytId,
  muted, solo, armed,
  recordTrigger,
  onMute, onSolo, onArm,
  onRecordEnd,
}: {
  label: string; color: string; slot?: Slot;
  url: string | null;
  ytId?: string | null;
  muted: boolean; solo: boolean; armed: boolean;
  recordTrigger: number;
  onMute: () => void; onSolo: () => void; onArm: () => void;
  onRecordEnd: (blob: Blob) => void;
}) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const recordRef = useRef<RecordPlugin | null>(null);
  const [trackState, setTrackState] = useState<TrackState>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Refs para evitar stale closures en effects
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const trackStateRef = useRef(trackState);
  trackStateRef.current = trackState;

  useEffect(() => {
    if (!waveRef.current || !url || trackState === "recording") return;
    wsRef.current?.destroy();
    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: color + "88",
      progressColor: color,
      height: 56, barWidth: 2, barGap: 1, barRadius: 3,
    });
    ws.load(url).then(() => {
      setLoaded(true);
      if (muted) ws.setMuted(true);
    });
    wsRef.current = ws;
    return () => { ws.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, trackState]);

  useEffect(() => { wsRef.current?.setMuted(muted); }, [muted]);

  const startRecording = useCallback(async () => {
    if (!waveRef.current) return;
    wsRef.current?.destroy();
    const rec = RecordPlugin.create({
      mimeType: MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm",
      scrollingWaveform: true,
      renderRecordedAudio: false,
    });
    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: color + "cc",
      progressColor: color,
      height: 56, barWidth: 2, barGap: 1, barRadius: 3,
      plugins: [rec],
    });
    wsRef.current = ws;
    recordRef.current = rec;
    rec.on("record-progress", (t) => setRecSeconds(t / 1000));
    rec.on("record-end", (blob) => { setTrackState("idle"); onRecordEnd(blob); });
    await rec.startRecording({
      channelCount: 2, sampleRate: 44100,
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    } as MediaTrackConstraints);
    setTrackState("recording");
    setRecSeconds(0);
  }, [color, onRecordEnd]);

  const stopRecording = () => recordRef.current?.stopRecording();
  const togglePlay = () => {
    if (!wsRef.current || !loaded) return;
    wsRef.current.isPlaying() ? wsRef.current.pause() : wsRef.current.play();
  };

  /* Trigger recording — usa refs para leer valores actuales sin stale closure */
  useEffect(() => {
    if (recordTrigger === 0) return;
    if (armedRef.current && trackStateRef.current === "idle") {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordTrigger]);

  const isYt = !!ytId;
  const rowHeight = isYt ? 100 : 80;

  return (
    <div className="flex border-b border-gray-800" style={{ minHeight: rowHeight }}>
      {/* Left panel */}
      <div className="w-32 shrink-0 flex flex-col justify-center gap-2 px-3 py-2 bg-gray-900 border-r border-gray-700">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-bold text-gray-100 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={onMute}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${muted ? "bg-yellow-400 text-black" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
          >M</button>
          <button onClick={onSolo}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${solo ? "bg-green-400 text-black" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
          >S</button>
          {slot && (
            <button
              onClick={trackState === "recording" ? stopRecording : onArm}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                trackState === "recording" ? "bg-red-600 text-white animate-pulse"
                : armed ? "bg-red-500 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
            >{trackState === "recording" ? "■" : "●"}</button>
          )}
        </div>
        {trackState === "recording" && (
          <span className="text-[10px] font-mono text-red-400 tabular-nums">{fmtTime(recSeconds)}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-gray-950 overflow-hidden">

        {/* YouTube — player compacto mostrando solo controls + progreso */}
        {isYt && (
          <div className="absolute inset-0 flex flex-col justify-center px-3 gap-2">
            {/* iframe anclado al fondo: solo se ven los controles (~48px) */}
            <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ height: 48 }}>
              <div className="absolute w-full" style={{ bottom: 0, paddingBottom: "56.25%", left: 0 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen loading="lazy"
                />
              </div>
            </div>
            <p className="text-[10px] text-amber-400">
              Presiona ▶ en el player · Usa auriculares al grabar
            </p>
          </div>
        )}

        {/* Waveform (archivo de audio) — muestra progreso de reproducción */}
        {!isYt && <div ref={waveRef} className="absolute inset-0 px-1 py-2" />}

        {/* Empty state */}
        {!url && !isYt && trackState === "idle" && (
          <div className="absolute inset-0 flex items-center px-4">
            <span className="text-xs text-gray-600">
              {slot
                ? armed ? "▶ REC para grabar" : "Arma (●) y presiona ▶ REC"
                : "Sin audio de referencia"}
            </span>
          </div>
        )}

        {/* Play / pause al tocar la pista */}
        {url && loaded && !isYt && trackState === "idle" && (
          <button onClick={togglePlay}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 rounded-full p-2 transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main Studio ─────────────────────────────────────────────────── */
export default function Studio({
  hymnId,
  referenceUrl, referenceType,
  audioSopranoUrl, audioContraaltoUrl, audioTenorUrl, audioBajoUrl,
}: {
  hymnId: number; hymnTitle: string;
  referenceUrl: string | null; referenceType: string | null;
  audioSopranoUrl: string | null; audioContraaltoUrl: string | null;
  audioTenorUrl: string | null; audioBajoUrl: string | null;
}) {
  const router = useRouter();
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [solo, setSolo] = useState<string | null>(null);
  const [armedSlot, setArmedSlot] = useState<Slot | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTrigger, setRecordTrigger] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [trimInfo, setTrimInfo] = useState<{ start: number; end: number } | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);

  const reviewWaveRef = useRef<HTMLDivElement>(null);
  const reviewWsRef = useRef<WaveSurfer | null>(null);
  const reviewUrlRef = useRef<string | null>(null);
  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const trackWsRefs = useRef<Record<string, HTMLElement>>({});

  const ytId = referenceUrl && referenceType === "youtube"
    ? referenceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
    : null;

  const trackUrls: Record<string, string | null> = {
    referencia: referenceType !== "youtube" ? referenceUrl : null,
    soprano: audioSopranoUrl,
    contraalto: audioContraaltoUrl,
    tenor: audioTenorUrl,
    bajo: audioBajoUrl,
  };

  const playAll = () => {
    Object.values(trackWsRefs.current).forEach((el) => {
      const ws = (el as HTMLElement & { __ws?: WaveSurfer }).__ws;
      if (ws && !ws.isPlaying()) ws.play();
    });
  };
  const stopAll = () => {
    Object.values(trackWsRefs.current).forEach((el) => {
      const ws = (el as HTMLElement & { __ws?: WaveSurfer }).__ws;
      ws?.stop();
    });
  };

  const handlePlayRec = () => {
    if (!armedSlot) { playAll(); return; }
    // Play reference audio file simultaneously
    if (referenceUrl && referenceType !== "youtube") {
      const audio = new Audio(referenceUrl);
      audio.volume = 0.75;
      refAudioRef.current = audio;
      audio.play().catch(() => {});
    }
    setIsRecording(true);
    setRecordTrigger(t => t + 1); // signals the armed TrackRow to start recording
  };

  const handleRecordEnd = useCallback((blob: Blob, slot: Slot) => {
    refAudioRef.current?.pause();
    setIsRecording(false);
    setPendingBlob(blob);
    setPendingSlot(slot);
    if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
    reviewUrlRef.current = URL.createObjectURL(blob);
  }, []);

  /* Review waveform */
  useEffect(() => {
    if (!pendingBlob || !reviewWaveRef.current || !reviewUrlRef.current) return;
    reviewWsRef.current?.destroy();
    const color = TRACKS.find(t => t.slot === pendingSlot)?.color ?? "#2563eb";
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: reviewWaveRef.current,
      waveColor: color + "66",
      progressColor: color,
      height: 64, barWidth: 2, barGap: 1, barRadius: 3,
      plugins: [regions],
    });
    ws.on("play", () => setReviewPlaying(true));
    ws.on("pause", () => setReviewPlaying(false));
    ws.on("finish", () => setReviewPlaying(false));
    ws.load(reviewUrlRef.current).then(() => {
      const dur = ws.getDuration();
      const reg = regions.addRegion({ start: 0, end: dur, color: color + "22", drag: true, resize: true });
      setTrimInfo({ start: 0, end: dur });
      reg.on("update-end", () => setTrimInfo({ start: reg.start, end: reg.end }));
    });
    reviewWsRef.current = ws;
    return () => ws.destroy();
  }, [pendingBlob, pendingSlot]);

  const upload = async () => {
    if (!pendingBlob || !pendingSlot) return;
    setIsUploading(true);
    try {
      let finalBlob = pendingBlob;
      if (trimInfo) {
        const decoded = await new AudioContext().decodeAudioData(await pendingBlob.arrayBuffer());
        const sr = decoded.sampleRate;
        const s0 = Math.floor(trimInfo.start * sr);
        const s1 = Math.floor(trimInfo.end * sr);
        const trimmed = new AudioContext().createBuffer(decoded.numberOfChannels, s1 - s0, sr);
        for (let ch = 0; ch < decoded.numberOfChannels; ch++)
          trimmed.copyToChannel(decoded.getChannelData(ch).subarray(s0, s1), ch);
        finalBlob = encodeWav(trimmed);
      }
      const file = new File([finalBlob], `${pendingSlot}-${Date.now()}.wav`, { type: "audio/wav" });
      const form = new FormData();
      form.append("slot", pendingSlot); form.append("file", file);
      const res = await fetch(`/api/hymns/${hymnId}/upload`, { method: "POST", body: form });
      if (res.ok) {
        setPendingBlob(null); setPendingSlot(null); setArmedSlot(null);
        router.refresh();
      } else { alert("Error al subir"); }
    } finally { setIsUploading(false); }
  };

  const discardReview = () => { setPendingBlob(null); setPendingSlot(null); setTrimInfo(null); };

  return (
    <div className="flex flex-col h-[calc(100vh-61px)]">

      {/* ── Transport ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700 flex-wrap">
        {/* Play / Rec button — prominente */}
        <button
          onClick={handlePlayRec}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${
            armedSlot
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {armedSlot ? (
            <>
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              ▶ REC
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
              Play
            </>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={stopAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
          Stop
        </button>

        <div className="h-5 w-px bg-gray-600" />

        {armedSlot ? (
          <span className="text-sm text-red-400 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {TRACKS.find(t => t.slot === armedSlot)?.label} lista para grabar
          </span>
        ) : (
          <span className="text-xs text-gray-500">Presiona ● en una cuerda para armar la grabación</span>
        )}
      </div>

      {/* ── Tracks ── */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {TRACKS.map(({ id, label, color, slot }) => (
          <TrackRow
            key={id}
            label={label} color={color} slot={slot}
            url={trackUrls[id]}
            ytId={id === "referencia" ? ytId : null}
            muted={!!muted[id]}
            solo={solo === id}
            armed={armedSlot === slot}
            recordTrigger={recordTrigger}
            onMute={() => setMuted(m => ({ ...m, [id]: !m[id] }))}
            onSolo={() => setSolo(s => s === id ? null : id)}
            onArm={() => slot && setArmedSlot(a => a === slot ? null : slot)}
            onRecordEnd={(blob) => handleRecordEnd(blob, slot!)}
          />
        ))}
      </div>

      {/* ── Review panel ── */}
      {pendingBlob && pendingSlot && (
        <div className="border-t-2 border-blue-500 bg-gray-900 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TRACKS.find(t => t.slot === pendingSlot)?.color }} />
              Revisión — {TRACKS.find(t => t.slot === pendingSlot)?.label}
            </span>
            {trimInfo && (
              <span className="text-[10px] text-gray-400">
                {fmtTime(trimInfo.start)} → {fmtTime(trimInfo.end)} · Arrastra los bordes para recortar
              </span>
            )}
          </div>
          <div ref={reviewWaveRef} className="w-full rounded-xl overflow-hidden bg-gray-800 px-1 py-1" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={upload} disabled={isUploading}
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >{isUploading ? "Subiendo…" : "✓ Subir"}</button>
            <button onClick={() => reviewWsRef.current?.playPause()}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
            >{reviewPlaying ? "⏸ Pausa" : "▶ Reproducir"}</button>
            <button onClick={() => { setArmedSlot(pendingSlot); discardReview(); }}
              className="text-sm px-3 py-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >Re-grabar</button>
            <button onClick={discardReview} className="text-sm px-3 py-2 text-gray-500 hover:text-gray-300 transition-colors">
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
