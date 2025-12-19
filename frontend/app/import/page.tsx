// frontend/app/import/page.tsx
import { UploadForm } from "@/components/UploadForm";
import Link from "next/link";

export default function ImportPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(52,211,153,0.08),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(15,23,42,0.95))]" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300 shadow-md shadow-black/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.15)]" />
              Stabilny import PDF w wersji produkcyjnej
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-50">Import Center</h1>
              <p className="mt-1 text-sm text-slate-400">
                Wgrywaj pojedyncze lub mnogie wyciągi PDF z banku. Dane z batcha
                automatycznie zasilą Flow, Dashboard i Statements.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex gap-2 text-[11px] text-slate-200">
            <Link
              href="/flow"
              className="rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 transition-all hover:-translate-y-0.5 hover:border-indigo-400/80 hover:bg-slate-900 hover:text-slate-50"
            >
              Przejdź do Flow
            </Link>
            <Link
              href="/profile/statements"
              className="rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 transition-all hover:-translate-y-0.5 hover:border-indigo-400/80 hover:bg-slate-900 hover:text-slate-50"
            >
              Zobacz Statements
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(79,70,229,0.12),transparent_45%),radial-gradient(ellipse_at_80%_0%,rgba(16,185,129,0.08),transparent_45%)]" />
              <div className="relative flex flex-col gap-4 p-6 sm:p-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-indigo-200/80">
                      Wyciąg bankowy (PDF)
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Obsługiwane są wyciągi PDF z <span className="font-medium text-indigo-200">PKO BP</span>. System automatycznie
                      rozpoznaje konto, okres, kwoty i saldo. Możesz wgrać wiele plików naraz.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400/20 to-indigo-400/20 shadow-inner shadow-emerald-500/40" />
                    <div className="leading-tight text-right">
                      <div className="font-semibold text-slate-100">Lokalne przetwarzanie</div>
                      <div className="text-slate-400">Bez chmury, zero wycieków</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-black/20 ring-1 ring-indigo-500/5">
                  <UploadForm />
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-[11px]">
                  {[{
                    title: "Po imporcie",
                    body: (
                      <>
                        Nowe transakcje pojawią się w <span className="text-indigo-300">Flow</span>, a wykresy i KPI w <span className="text-indigo-300">Dashboard</span> zostaną natychmiast zasilone.
                      </>
                    ),
                  },
                  {
                    title: "Statements",
                    body: (
                      <>
                        Każdy wyciąg trafia do <span className="text-indigo-300">Statements</span> z widokiem statusu importu, liczbą wierszy i historią reimportów.
                      </>
                    ),
                  },
                  {
                    title: "Reimport",
                    body: (
                      <>
                        Wgranie poprawionej wersji wyciągu dla tego samego okresu nadpisuje dane bez duplikatów. Możesz poprawiać batch bez ryzyka.
                      </>
                    ),
                  }].map((card) => (
                    <div
                      key={card.title}
                      className="group rounded-2xl border border-slate-800/70 bg-slate-950/70 p-3 transition-all hover:-translate-y-1 hover:border-indigo-400/60 hover:bg-slate-950/90 hover:shadow-lg hover:shadow-indigo-900/40"
                    >
                      <div className="mb-1 flex items-center justify-between text-slate-400">
                        <span>{card.title}</span>
                        <span className="text-[9px] text-indigo-200/80 group-hover:translate-x-0.5 group-hover:text-indigo-200 transition-transform">→</span>
                      </div>
                      <div className="text-slate-200">{card.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 shadow-xl shadow-black/40 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Stan kolejki</p>
                    <p className="text-lg font-semibold text-slate-50">Batch w toku</p>
                    <p className="text-xs text-slate-400">Możesz dodać kolejne pliki nawet w trakcie.</p>
                  </div>
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border border-indigo-500/40" />
                    <div className="absolute inset-2 rounded-full border border-indigo-500/50 blur" />
                    <div className="absolute inset-4 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-400 opacity-80 animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                  {["Lokalnie", "Szybkość", "Bezpiecznie"].map((label) => (
                    <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 px-2 py-2 text-slate-200">
                      <div className="text-[10px] text-slate-400">{label}</div>
                      <div className="text-sm font-semibold text-indigo-200">ON</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-black/40 backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Kroki importu</span>
                  <span className="text-[11px] text-indigo-200/80">Automatyzacja</span>
                </div>
                <div className="mt-3 space-y-2">
                  {["Upload & walidacja PDF", "Parsowanie tabel i transakcji", "Rejestracja w Flow oraz Dashboard"].map((step, idx) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[12px] text-slate-200 transition-all hover:border-indigo-400/70 hover:bg-slate-900"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-400/20 text-[11px] font-semibold text-indigo-100">
                        0{idx + 1}
                      </div>
                      <div className="leading-tight">
                        <div className="font-medium">{step}</div>
                        <div className="text-[11px] text-slate-400">Synchronizacja bez potrzeby odświeżania.</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-black/40 backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Przydatne skróty</span>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-100">UX</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-200">
                  <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 transition hover:border-indigo-400/70">
                    <span>Drop pliki</span>
                    <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-indigo-100">Drag & Drop</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 transition hover:border-indigo-400/70">
                    <span>Batch import</span>
                    <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-indigo-100">auto</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 transition hover:border-indigo-400/70">
                    <span>Szybki reimport</span>
                    <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-indigo-100">smart diff</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 transition hover:border-indigo-400/70">
                    <span>Wsparcie</span>
                    <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-indigo-100">live</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-4 flex sm:hidden justify-between text-[11px] text-slate-300">
            <Link
              href="/flow"
              className="underline underline-offset-4 decoration-slate-700 transition hover:text-slate-50"
            >
              Przejdź do Flow
            </Link>
            <Link
              href="/profile/statements"
              className="underline underline-offset-4 decoration-slate-700 transition hover:text-slate-50"
            >
              Zobacz Statements
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
