"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const HYMN_TYPES = ["Himnario", "Villancico", "Spirituals", "Santa Cena"];

export default function AddHymnButton({ defaultStatus }: { defaultStatus: "ACTIVE" | "BACKLOG" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    composer: "",
    hymnType: "",
    status: defaultStatus,
  });

  const reset = () => {
    setForm({ title: "", composer: "", hymnType: "", status: defaultStatus });
    setError("");
  };

  const close = () => { setOpen(false); reset(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("El título es obligatorio"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/hymns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        close();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al crear el himno");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => titleRef.current?.focus(), 50); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nuevo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Nuevo himno</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                <input
                  ref={titleRef}
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Nombre del himno"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Compositor</label>
                <input
                  type="text"
                  value={form.composer}
                  onChange={(e) => setForm(f => ({ ...f, composer: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select
                    value={form.hymnType}
                    onChange={(e) => setForm(f => ({ ...f, hymnType: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">Sin tipo</option>
                    {HYMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(f => ({ ...f, status: e.target.value as "ACTIVE" | "BACKLOG" }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="BACKLOG">Backlog</option>
                  </select>
                </div>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {saving ? "Guardando…" : "Agregar himno"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
