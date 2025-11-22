// frontend/app/page.tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-400">
          Personal finance lab
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold">
          Ogarnij swoje przepływy pieniężne.
        </h1>
        <p className="text-sm md:text-base text-slate-400 max-w-xl">
          FlowParser łączy import wyciągów bankowych, analitykę i
          wizualizacje. Wszystko lokalnie, bez chmury – idealne jako
          osobisty finansowy cockpit i projekt do portfolio.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium
                       bg-emerald-600 hover:bg-emerald-500 text-slate-50 transition-colors"
          >
            Otwórz Dashboard
          </Link>
          <Link
            href="/flow"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium
                       bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
          >
            Zobacz Flow
          </Link>
        </div>
      </section>

      <section
        className="border border-slate-800/80 rounded-2xl bg-slate-900/40 p-4 md:p-5
                   grid gap-4 md:grid-cols-2"
      >
        <div className="space-y-2 text-sm text-slate-300">
          <h2 className="text-sm font-semibold text-slate-100">
            Jak to działa?
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Wrzucasz wyciąg PDF z banku.</li>
            <li>Dane trafiają do bazy (raw + przetworzone).</li>
            <li>Dashboard pokazuje wykresy, statystyki i tabelę operacji.</li>
            <li>
              Flow pozwala analizować trendy, okresy i przepływy w czasie.
            </li>
          </ul>
        </div>

        <div
          className="relative rounded-xl border border-slate-800/80 bg-slate-950/70 p-4
                     overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Preview
              </span>
              <span className="text-[11px] text-emerald-400">
                Live data
              </span>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/70 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Saldo</span>
                <span className="text-emerald-400 font-medium">
                  4 532,18 zł
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ostatni miesiąc</span>
                <span className="text-rose-400 font-medium">
                  -1 234,50 zł
                </span>
              </div>
              <div className="mt-2 h-12 rounded-md bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.35),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.25),transparent_55%)]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
