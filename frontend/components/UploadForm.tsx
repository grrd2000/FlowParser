// frontend/components/UploadForm.tsx
"use client";

import { useState } from "react";
import { PUBLIC_API_BASE_URL } from "@/lib/clientApi";

export function UploadForm() {
  // TODO: pobierać account_id dynamicznie; na razie na sztywno 1
  // const [accountId] = useState<number>(1);

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<null | "idle" | "loading" | "success" | "error">(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("error");
      setMessage("Wybierz plik PDF.");
      return;
    }

    try {
      setStatus("loading");
      setMessage(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${PUBLIC_API_BASE_URL}/statements/import-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail = data?.detail ?? `Błąd API: ${res.status}`;
        throw new Error(String(detail));
      }

      const data = await res.json();
      setStatus("success");
      if (data.was_reimport) {
        setMessage(
          `Wyciąg dla tego konta i okresu był już wcześniej – dane zostały zaktualizowane. Wczytano ${data.imported_rows}/${data.total_rows} wierszy.`
        );
      } else {
        setMessage(
          `Import zakończony. Wczytano ${data.imported_rows}/${data.total_rows} wierszy.`
        );
      }

      // Na razie: prosty reload, żeby odświeżyć listę transakcji
      window.location.reload();
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Nieznany błąd podczas importu.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setStatus(null);
            setMessage(null);
          }}
          className="text-xs text-slate-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0
                     file:text-xs file:font-medium file:bg-slate-700 file:text-slate-100
                     hover:file:bg-slate-600"
        />
        <button
          type="submit"
          disabled={status === "loading" || !file}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium
                     bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700
                     disabled:text-slate-400 transition-colors"
        >
          {status === "loading" ? "Importuję..." : "Importuj PDF"}
        </button>
      </div>

      {status === "success" && message && (
        <p className="text-xs text-emerald-400">{message}</p>
      )}
      {status === "error" && message && (
        <p className="text-xs text-rose-400">{message}</p>
      )}
    </form>
  );
}
