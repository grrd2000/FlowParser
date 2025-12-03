// frontend/app/import/page.tsx
import { UploadForm } from "@/components/UploadForm";
import Link from "next/link";

export default function ImportPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            Import Center
          </h1>
          <p className="text-sm text-slate-400">
            Wgrywaj pojedyncze lub mnogie wyciągi PDF z banku. Dane z batcha
            automatycznie zasilą Flow, Dashboard i Statements.
          </p>

        </div>
        <div className="hidden sm:flex gap-2 text-[11px] text-slate-400">
          <Link
            href="/flow"
            className="rounded-full border border-slate-700 px-3 py-1 hover:border-indigo-400/70 hover:text-slate-100"
          >
            Przejdź do Flow
          </Link>
          <Link
            href="/profile/statements"
            className="rounded-full border border-slate-700 px-3 py-1 hover:border-indigo-400/70 hover:text-slate-100"
          >
            Zobacz Statements
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-stretch justify-center">
        <div className="w-full max-w-3xl">
          <div className="relative rounded-3xl border border-slate-800 bg-slate-950/70 backdrop-blur-lg shadow-2xl shadow-black/60 overflow-hidden">
            {/* „półprzezroczyste tło” z gradientem */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-slate-900/60 to-emerald-500/10" />

            <div className="relative p-6 md:p-8 flex flex-col gap-6">
              {/* górny opis + info o bezpieczeństwie */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-50">
                    Wyciąg bankowy (PDF)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Obsługiwane są obecnie wyciągi PDF z{" "}
                    <span className="text-indigo-300 font-medium">PKO BP</span>.
                    System automatycznie rozpoznaje konto, okres, kwoty i saldo. Możesz
                    wgrać wiele plików naraz.
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 text-right space-y-1">
                  <div>
                    Dane są przetwarzane lokalnie – żadnych zewnętrznych usług,
                    żadnej chmury.
                  </div>
                </div>
              </div>

              {/* sekcja uploadu */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <UploadForm />
              </div>

              {/* sekcja „co dalej” */}
              <div className="grid gap-3 md:grid-cols-3 text-[11px]">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-slate-400 mb-1">Po imporcie</div>
                  <div className="text-slate-200">
                    Nowe transakcje pojawią się w{" "}
                    <span className="text-indigo-300">Flow</span>, a wykresy i
                    KPI w <span className="text-indigo-300">Dashboard</span>{" "}
                    zostaną automatycznie zaktualizowane.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-slate-400 mb-1">Statements</div>
                  <div className="text-slate-200">
                    Każdy wyciąg trafia do{" "}
                    <span className="text-indigo-300">Statements</span>, gdzie
                    zobaczysz status importu, liczbę wierszy i reimporty.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-slate-400 mb-1">Reimport</div>
                  <div className="text-slate-200">
                    Wgranie poprawionej wersji wyciągu dla tego samego okresu
                    nadpisuje istniejące dane, nie tworząc duplikatów.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* mobile short links */}
          <div className="mt-4 flex sm:hidden justify-between text-[11px] text-slate-400">
            <Link
              href="/flow"
              className="underline underline-offset-4 decoration-slate-600 hover:text-slate-200"
            >
              Przejdź do Flow
            </Link>
            <Link
              href="/profile/statements"
              className="underline underline-offset-4 decoration-slate-600 hover:text-slate-200"
            >
              Zobacz Statements
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
