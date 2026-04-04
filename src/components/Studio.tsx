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
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
}

/* ── Types ────────────────────────────────────────────────────────── */
type Slot = "soprano" | "contraalto" | "tenor" | "bajo";

const TRACKS: { id: string; label: string; color: string; slot?: Slot }[] = [
  { id: "referencia", label: "Referencia", color: "#10b981" },
  { id: "soprano",    label: "Soprano",    color: "#db2777", slot: "soprano" },
  { id: "contraalto", label: "Contraalto", color: "#7c3aed", slot: "contraalto" },
  { id: "tenor",      label: "Tenor",      color: "#2563eb", slot: "tenor" },
  { id: "bajo",       label: "Bajo",       color: "#78716c", slot: "bajo" },
];

type TrackState = "idle" | "armed" | "recording" | "reviewing";

/* ── Waveform Track Row ───────────────────────────────────────────── */
function TrackRow({
  id, label, color, slot,
  url, muted, solo, armed,
  isAnyRecording,
  onMute, onSolo, onArm,
  onRecordEnd,
  hymnId,
}: {
  id: string; label: string; color: string; slot?: Slot;
  url: string | null;
  muted: boolean; solo: boolean; armed: boolean;
  isAnyRecording: boolean;
  onMute: () => void; onSolo: () => void; onArm: () => void;
  onRecordEnd: (blob: Blob) => void;
  hymnId: number;
}) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const recordRef = useRef<RecordPlugin | null>(null);
  const [trackState, setTrackState] = useState<TrackState>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [loaded, setLoaded] = useState(false);

  /* Init WaveSurfer when url available and not recording */
  useEffect(() => {
    if (!waveRef.current || !url || trackState === "recording") return;
    wsRef.current?.destroy();

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: color + "99",
      progressColor: color,
      height: 56,
      barWidth: 2, barGap: 1, barRadius: 3,
      interact: true,
    });
    if (muted) ws.setMuted(true);
    ws.load(url).then(() => setLoaded(true));
    wsRef.current = ws;
    return () => ws.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, trackState]);

  /* Sync mute */
  useEffect(() => {
    wsRef.current?.setMuted(muted);
  }, [muted]);

  /* Init recording WaveSurfer */
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
      height: 56,
      barWidth: 2, barGap: 1, barRadius: 3,
      plugins: [rec],
    });

    wsRef.current = ws;
    recordRef.current = rec;

    let secs = 0;
    rec.on("record-progress", (t) => {
      secs = t / 1000;
      setRecSeconds(secs);
    });

    rec.on("record-end", (blob) => {
      setTrackState("idle");
      onRecordEnd(blob);
    });

    await rec.startRecording({ channelCount: 2, sampleRate: 44100, echoCancellation: false, noiseSuppression: false } as MediaTrackConstraints);
    setTrackState("recording");
    setRecSeconds(0);
  }, [color, onRecordEnd]);

  const stopRecording = () => {
    recordRef.current?.stopRecording();
  };

  /* Play / pause this track individually */
  const togglePlay = () => {
    if (!wsRef.current || !loaded) return;
    if (wsRef.current.isPlaying()) wsRef.current.pause();
    else wsRef.current.play();
  };

  // Expose ws for parent sync
  useEffect(() => {
    (waveRef.current as HTMLElement & { __ws?: WaveSurfer }).__ws = wsRef.current ?? undefined;
  });

  return (
    <div className="flex border-b border-gray-800 last:border-0" style={{ minHeight: 80 }}>
      {/* Left panel */}
      <div className="w-36 shrink-0 flex flex-col justify-center gap-1.5 px-3 py-2 bg-gray-900 border-r border-gray-700">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-gray-200 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMute}
            title="Mute"
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
              muted ? "bg-yellow-500 text-black" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >M</button>
          <button
            onClick={onSolo}
            title="Solo"
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
              solo ? "bg-green-500 text-black" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >S</button>
          {slot && (
            <button
              onClick={trackState === "recording" ? stopRecording : onArm}
              title={trackState === "recording" ? "Detener" : "Armar grabación"}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                trackState === "recording"
                  ? "bg-red-600 text-white animate-pulse"
                  : armed
                  ? "bg-red-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {trackState === "recording" ? "■" : "●"}
            </button>
          )}
        </div>
        {trackState === "recording" && (
          <span className="text-[10px] font-mono text-red-400">{fmtTime(recSeconds)}</span>
        )}
      </div>

      {/* Waveform area */}
      <div className="flex-1 relative bg-gray-950 overflow-hidden">
        <div ref={waveRef} className="absolute inset-0 px-1 py-2" />
        {!url && trackState === "idle" && (
          <div className="absolute inset-0 flex items-center px-4">
            <span className="text-xs text-gray-600">
              {slot ? (armed ? "Listo para grabar — presiona ▶ para iniciar" : "Sin demo — arma (●) y presiona ▶") : "Sin audio de referencia"}
            </span>
          </div>
        )}
        {/* Click to play individual track */}
        {url && loaded && trackState === "idle" && (
          <button
            onClick={togglePlay}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
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
  hymnId, hymnTitle,
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
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [trimInfo, setTrimInfo] = useState<{ start: number; end: number } | null>(null);

  const reviewWaveRef = useRef<HTMLDivElement>(null);
  const reviewWsRef = useRef<WaveSurfer | null>(null);
  const reviewUrlRef = useRef<string | null>(null);
  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const trackWsRefs = useRef<Record<string, HTMLElement>>({});

  // Track URL map
  const trackUrls: Record<string, string | null> = {
    referencia: referenceType !== "youtube" ? referenceUrl : null,
    soprano: audioSopranoUrl,
    contraalto: audioContraaltoUrl,
    tenor: audioTenorUrl,
    bajo: audioBajoUrl,
  };

  /* ── Play all WaveSurfers in sync ── */
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

  /* ── Arm + start recording ── */
  const handlePlayWithRecord = () => {
    if (!armedSlot) { playAll(); return; }
    // Start reference audio if file
    if (referenceUrl && referenceType !== "youtube") {
      const audio = new Audio(referenceUrl);
      audio.volume = 0.75;
      refAudioRef.current = audio;
      audio.play().catch(() => {});
    }
    setIsRecording(true);
  };

  const handleRecordEnd = useCallback((blob: Blob, slot: Slot) => {
    refAudioRef.current?.pause();
    setIsRecording(false);
    setPendingBlob(blob);
    setPendingSlot(slot);
    if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
    reviewUrlRef.current = URL.createObjectURL(blob);
  }, []);

  /* ── Init review waveform ── */
  useEffect(() => {
    if (!pendingBlob || !reviewWaveRef.current || !reviewUrlRef.current) return;
    reviewWsRef.current?.destroy();
    const color = TRACKS.find(t => t.slot === pendingSlot)?.color ?? "#2563eb";
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: reviewWaveRef.current,
      waveColor: color + "88",
      progressColor: color,
      height: 72, barWidth: 2, barGap: 1, barRadius: 3,
      plugins: [regions],
    });
    ws.load(reviewUrlRef.current).then(() => {
      const dur = ws.getDuration();
      const reg = regions.addRegion({ start: 0, end: dur, color: color + "22", drag: true, resize: true });
      setTrimInfo({ start: 0, end: dur });
      reg.on("update-end", () => setTrimInfo({ start: reg.start, end: reg.end }));
    });
    reviewWsRef.current = ws;
    return () => ws.destroy();
  }, [pendingBlob, pendingSlot]);

  /* ── Upload ── */
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
      form.append("slot", pendingSlot);
      form.append("file", file);
      const res = await fetch(`/api/hymns/${hymnId}/upload`, { method: "POST", body: form });
      if (res.ok) {
        setPendingBlob(null); setPendingSlot(null);
        setArmedSlot(null);
        router.refresh();
      } else {
        alert("Error al subir");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const discardReview = () => {
    setPendingBlob(null); setPendingSlot(null);
    setTrimInfo(null);
  };

  const ytId = referenceUrl && referenceType === "youtube"
    ? referenceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-61px)]">
      {/* ── Transport bar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border-b border-gray-700">
        <button
          onClick={handlePlayWithRecord}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors"
        >
          {armedSlot ? (
            <><span className="w-2 h-2 rounded-full bg-red-500" />Grabar + Referencia</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>Play All</>
          )}
        </button>
        <button
          onClick={stopAll}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </button>
        <div className="h-4 w-px bg-gray-600 mx-1" />
        {armedSlot ? (
          <span className="text-xs text-red-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {TRACKS.find(t => t.slot === armedSlot)?.label} armada — presiona ▶ para grabar
          </span>
        ) : (
          <span className="text-xs text-gray-500">Arma una pista (●) para grabar con referencia</span>
        )}
        {ytId && (
          <div className="ml-auto text-xs text-amber-400 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            Usa auriculares con YouTube
          </div>
        )}
      </div>

      {/* ── Reference YouTube (if applicable) ── */}
      {ytId && (
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-700">
          <div className="relative rounded-lg overflow-hidden bg-black" style={{ width: "40%", aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen loading="lazy"
            />
          </div>
        </div>
      )}

      {/* ── Tracks ── */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {TRACKS.map(({ id, label, color, slot }) => (
          <TrackRow
            key={id}
            id={id} label={label} color={color} slot={slot}
            url={trackUrls[id]}
            muted={!!muted[id]}
            solo={solo === id}
            armed={armedSlot === slot}
            isAnyRecording={isRecording}
            onMute={() => setMuted(m => ({ ...m, [id]: !m[id] }))}
            onSolo={() => setSolo(s => s === id ? null : id)}
            onArm={() => {
              if (!slot) return;
              setArmedSlot(a => a === slot ? null : slot);
            }}
            onRecordEnd={(blob) => handleRecordEnd(blob, slot!)}
            hymnId={hymnId}
          />
        ))}
      </div>

      {/* ── Review panel ── */}
      {pendingBlob && pendingSlot && (
        <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TRACKS.find(t=>t.slot===pendingSlot)?.color }} />
              Revisión — {TRACKS.find(t => t.slot === pendingSlot)?.label}
            </span>
            {trimInfo && (
              <span className="text-[10px] text-gray-400">
                {fmtTime(trimInfo.start)} → {fmtTime(trimInfo.end)} · Arrastra para recortar
              </span>
            )}
          </div>
          <div ref={reviewWaveRef} className="w-full rounded-lg overflow-hidden bg-gray-800 px-1 py-1" />
          <div className="flex gap-2">
            <button
              onClick={upload} disabled={isUploading}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isUploading ? "Subiendo…" : "Subir"}
            </button>
            <button
              onClick={() => reviewWsRef.current?.playPause()}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
            >
              Reproducir
            </button>
            <button
              onClick={() => { setArmedSlot(pendingSlot); discardReview(); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Re-grabar
            </button>
            <button onClick={discardReview} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors">
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
