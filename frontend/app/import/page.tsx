// frontend/app/import/page.tsx
import { UploadForm } from "@/components/UploadForm";
import Link from "next/link";

export default function ImportPage() {
  return (
    <div className="relative mx-auto flex max-w-screen-2xl flex-col gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="badge-soft">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.35)]" />
            Stabilny import PDF w wersji produkcyjnej
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-white">Import Center</h1>
            <p className="mt-1 text-sm text-slate-300">
              Wgrywaj pojedyncze lub mnogie wyciągi PDF z banku. Dane z batcha automatycznie zasilą Flow,
              Dashboard i Statements.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex gap-2 text-[11px] text-slate-200">
          <Link href="/flow" className="button-ghost">
            Przejdź do Flow
          </Link>
          <Link href="/profile/statements" className="button-ghost">
            Zobacz Statements
          </Link>
        </div>
      </header>

      <main className="space-y-6">
        <section className="glass-card glass-card-hover-soft relative overflow-hidden">
          <div className="hero-accent hero-accent--primary" aria-hidden />
          <div className="hero-accent hero-accent--tertiary" aria-hidden />
          <div className="relative flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-indigo-100/80">Wyciąg bankowy (PDF)</p>
                <p className="text-sm text-slate-200">
                  Obsługiwane są wyciągi PDF z <span className="font-medium text-indigo-100">PKO BP</span>. System automatycznie
                  rozpoznaje konto, okres, kwoty i saldo. Możesz wgrać wiele plików naraz.
                </p>
              </div>
              <div className="glass-card flex items-center gap-2 bg-white/5 px-3 py-2 text-[11px] text-slate-200">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400/20 to-indigo-400/20 shadow-inner shadow-emerald-500/40" />
                <div className="leading-tight text-right">
                  <div className="font-semibold text-white">Lokalne przetwarzanie</div>
                  <div className="text-slate-300">Bez chmury, zero wycieków</div>
                </div>
              </div>
            </div>

            <div className="glass-card glass-card-hover-soft bg-white/5 p-4 shadow-lg shadow-black/20">
              <UploadForm />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-[11px]">
              {[{
                title: "Po imporcie",
                body: (
                  <>
                    Nowe transakcje pojawią się w <span className="text-indigo-200">Flow</span>, a wykresy i KPI w <span className="text-indigo-200">Dashboard</span>
                    zostaną natychmiast zasilone.
                  </>
                ),
              },
              {
                title: "Statements",
                body: (
                  <>
                    Każdy wyciąg trafia do <span className="text-indigo-200">Statements</span> z widokiem statusu importu, liczbą wierszy i historią reimportów.
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
                <div key={card.title} className="glass-card glass-card-hover-soft group bg-slate-900/60 p-3">
                  <div className="mb-1 flex items-center justify-between text-slate-300">
                    <span>{card.title}</span>
                    <span className="text-[9px] text-indigo-100/80 group-hover:translate-x-0.5 group-hover:text-indigo-100 transition-transform">→</span>
                  </div>
                  <div className="text-slate-100">{card.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex sm:hidden justify-between text-[11px] text-slate-300">
          <Link href="/flow" className="underline underline-offset-4 decoration-slate-700 transition hover:text-slate-50">
            Przejdź do Flow
          </Link>
          <Link href="/profile/statements" className="underline underline-offset-4 decoration-slate-700 transition hover:text-slate-50">
            Zobacz Statements
          </Link>
        </div>
      </main>
    </div>
  );
}
