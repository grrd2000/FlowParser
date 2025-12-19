"use client";

import { useCallback, useState } from "react";

type Phase = "queued" | "uploading" | "processing" | "done" | "error";

type FileItem = {
  id: string;
  file: File;
  phase: Phase;
  progress: number; // 0–100
  message?: string;
};

export function UploadForm() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  // dodawanie plików do kolejki
  const enqueueFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newItems: FileItem[] = [];
    const now = Date.now();

    Array.from(fileList).forEach((file, idx) => {
      if (file.type !== "application/pdf") return; // filtrujemy tylko PDF-y

      newItems.push({
        id: `${now}-${idx}-${file.name}`,
        file,
        phase: "queued",
        progress: 0,
      });
    });

    if (newItems.length === 0) return;

    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    enqueueFiles(e.target.files);
    // pozwala potem wybrać te same pliki jeszcze raz
    e.target.value = "";
  };

  // drag&drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // zabezpieczenie przed miganiem: sprawdzamy, czy faktycznie wyszliśmy z kontenera
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dt = e.dataTransfer;
    if (!dt) return;
    enqueueFiles(dt.files);
  };

  const handleStartImport = async () => {
    if (isRunning) return;

    const toProcess = files.filter(
      (f) => f.phase === "queued" || f.phase === "error"
    );
    if (toProcess.length === 0) return;

    setIsRunning(true);

    try {
      for (const item of toProcess) {
        // ustaw fazę na uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, phase: "uploading", progress: 0, message: undefined }
              : f
          )
        );

        try {
          const data = await uploadWithProgress(
            `${apiBase}/statements/import-pdf`,
            item.file,
            (percent) => {
              // upload 0–80
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === item.id
                    ? { ...f, progress: Math.min(80, percent) }
                    : f
                )
              );
            }
          );

          // processing 80–100
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, phase: "processing", progress: 90 }
                : f
            )
          );

          const imported = data.imported_rows ?? data.total_rows ?? "?";
          const total = data.total_rows ?? "?";
          const errors = data.error_rows ?? 0;
          const wasReimport = Boolean(data.was_reimport);

          const baseText = wasReimport
            ? "Zaktualizowano istniejący wyciąg (reimport)."
            : "Zaimportowano nowy wyciąg.";
          const details = ` Wczytano ${imported}/${total} wierszy, błędy: ${errors}.`;

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    phase: "done",
                    progress: 100,
                    message: baseText + details,
                  }
                : f
            )
          );
        } catch (err: any) {
          const msg =
            typeof err?.message === "string"
              ? err.message
              : "Błąd podczas importu tego pliku.";
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    phase: "error",
                    progress: 0,
                    message: msg,
                  }
                : f
            )
          );
        }
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearQueue = () => {
    setFiles([]);
  };

  const queuedCount = files.filter((f) => f.phase === "queued").length;
  const errorCount = files.filter((f) => f.phase === "error").length;
  const doneCount = files.filter((f) => f.phase === "done").length;

  const canStart = !isRunning && files.some((f) =>
    f.phase === "queued" || f.phase === "error"
  );

  return (
    <div className="space-y-4 text-sm">
      {/* dropzone + input */}
      <div
        className={[
          "relative overflow-hidden rounded-2xl border px-5 py-6 transition-all duration-300",
          isDragging
            ? "border-indigo-400/70 bg-gradient-to-br from-indigo-500/15 via-slate-900/70 to-emerald-500/10 shadow-[0_10px_40px_-20px_rgba(99,102,241,0.6)]"
            : "border-slate-800 bg-slate-900/60 hover:border-indigo-400/60 hover:bg-slate-900/80",
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_35%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.1),transparent_40%)]" />
        <div className="relative flex flex-col items-center gap-3 text-xs text-slate-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/80 text-lg text-indigo-200 shadow-inner shadow-black/40">
            ⬆️
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-50">
              Przeciągnij tutaj pliki PDF
            </p>
            <p className="text-[11px] text-slate-400">
              Możesz dodać wiele wyciągów naraz. Obsługiwane: PKO BP (PDF).
            </p>
          </div>
          <div className="mt-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-100 transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:text-slate-50">
              <span>Wybierz pliki...</span>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Dane przetwarzane lokalnie. Reimport tego samego okresu aktualizuje
            istniejące dane, bez duplikatów.
          </p>
        </div>
      </div>

      {/* przyciski akcji */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={handleStartImport}
          disabled={!canStart}
          className="inline-flex items-center justify-center gap-1 rounded-full
                     bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 px-4 py-1.5 font-semibold text-slate-950
                     shadow-lg shadow-indigo-900/40 transition-all hover:-translate-y-0.5 hover:shadow-indigo-900/60
                     disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
        >
          {isRunning ? "Importuję batch..." : "Start batch import"}
        </button>
        <button
          type="button"
          onClick={handleClearQueue}
          disabled={files.length === 0 || isRunning}
          className="inline-flex items-center justify-center rounded-full
                     border border-slate-700 px-3 py-1.5 text-slate-300 backdrop-blur
                     transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:text-slate-50 disabled:opacity-40"
        >
          Wyczyść kolejkę
        </button>

        <div className="ml-auto flex flex-wrap gap-3 text-slate-500">
          <span>Queued: {queuedCount}</span>
          <span>Done: {doneCount}</span>
          {errorCount > 0 && (
            <span className="text-rose-300">Errors: {errorCount}</span>
          )}
        </div>
      </div>

      {/* lista plików z progressem */}
      {files.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-inner shadow-black/30">
          {files.map((item) => (
            <FileRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileRow({ item }: { item: FileItem }) {
  const progress =
    item.phase === "done"
      ? 100
      : item.phase === "error"
      ? 0
      : item.progress;

  const isActive = item.phase === "uploading" || item.phase === "processing";

  const phaseLabel =
    item.phase === "queued"
      ? "Oczekuje na import"
      : item.phase === "uploading"
      ? "Wysyłanie pliku..."
      : item.phase === "processing"
      ? "Analiza PDF i zapis danych..."
      : item.phase === "done"
      ? "Zakończono"
      : "Błąd";

  const barColor =
    item.phase === "done"
      ? "bg-emerald-500"
      : item.phase === "error"
      ? "bg-rose-500"
      : "bg-indigo-500";

  const textColor =
    item.phase === "done"
      ? "text-emerald-300"
      : item.phase === "error"
      ? "text-rose-300"
      : "text-slate-300";

  return (
    <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] transition-colors hover:border-indigo-400/60 hover:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate font-medium text-slate-100">{item.file.name}</div>
        <div className={`text-[10px] ${textColor}`}>{phaseLabel}</div>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{
            width: `${isActive ? Math.max(5, progress) : progress}%`,
            backgroundImage:
              item.phase === "error"
                ? undefined
                : "linear-gradient(90deg, rgba(99,102,241,0.9), rgba(16,185,129,0.9))",
          }}
        />
      </div>
      {item.message && (
        <div className="mt-1 text-[10px] text-slate-400">
          {item.message}
        </div>
      )}
    </div>
  );
}

/**
 * Wysyła pojedynczy plik przez XHR z callbackiem postępu.
 * Rzuca Error przy błędzie, zwraca JSON przy sukcesie.
 */
async function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = (event.loaded / event.total) * 100;
      onProgress(percent);
    };

    xhr.onerror = () => {
      reject(new Error("Błąd sieci podczas wysyłania pliku."));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          resolve(data);
        } catch {
          reject(
            new Error("Nie udało się odczytać odpowiedzi z serwera.")
          );
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          const detail =
            typeof data.detail === "string"
              ? data.detail
              : data.detail?.message;
          reject(
            new Error(
              detail || `Serwer zwrócił błąd (${xhr.status}).`
            )
          );
        } catch {
          reject(
            new Error(
              `Serwer zwrócił błąd (${xhr.status}), brak szczegółów.`
            )
          );
        }
      }
    };

    xhr.send(formData);
  });
}
