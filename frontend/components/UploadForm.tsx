"use client";

import { useState, useEffect } from "react";

type Toast = {
  type: "success" | "error";
  message: string;
};

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  // auto-hide toast po 5 sekundach
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setToast(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${apiBase}/statements/import-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = "Błąd podczas importu wyciągu.";
        try {
          const data = await res.json();
          if (typeof data.detail === "string") {
            msg = data.detail;
          } else if (data.detail?.message) {
            msg = data.detail.message;
          }
        } catch {
          // jeśli nie da się sparsować JSON – zostawiamy default msg
        }

        setToast({
          type: "error",
          message: msg,
        });
        return;
      }

      const data = await res.json();

      const imported = data.imported_rows ?? data.total_rows ?? "?";
      const total = data.total_rows ?? "?";
      const errors = data.error_rows ?? 0;
      const wasReimport = Boolean(data.was_reimport);

      const baseText = wasReimport
        ? "Wyciąg dla tego konta i okresu już istniał – dane zostały zaktualizowane."
        : "Nowy wyciąg został zaimportowany.";

      const details = ` Wczytano ${imported}/${total} wierszy, błędy: ${errors}.`;

      setToast({
        type: "success",
        message: baseText + details,
      });

      // opcjonalnie: reset pliku po sukcesie
      setFile(null);
    } catch (err) {
      console.error(err);
      setToast({
        type: "error",
        message: "Nie udało się połączyć z API.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div className="space-y-1">
          <label className="text-xs text-slate-300">
            Wybierz plik wyciągu (PDF)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border file:border-slate-700 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:text-slate-200 hover:file:border-indigo-400 hover:file:text-slate-50"
          />
          <p className="text-[10px] text-slate-500">
            Plik nie jest wysyłany do żadnych zewnętrznych usług – wszystko
            przetwarzane lokalnie.
          </p>
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-medium text-slate-950 hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500"
        >
          {uploading ? "Importuję..." : "Importuj wyciąg"}
        </button>
      </form>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[200]">
          <div
            className={[
              "max-w-xs rounded-2xl border px-4 py-3 text-xs shadow-lg shadow-black/50 bg-slate-950/95 backdrop-blur",
              toast.type === "success"
                ? "border-emerald-500/60 text-emerald-100"
                : "border-rose-500/60 text-rose-100",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "h-1.5 w-1.5 rounded-full",
                      toast.type === "success"
                        ? "bg-emerald-400"
                        : "bg-rose-400",
                    ].join(" ")}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {toast.type === "success" ? "Import completed" : "Import failed"}
                  </span>
                </div>
                <p className="text-[11px] leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
