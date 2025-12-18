import { motion } from "framer-motion";
import Link from "next/link";

const featureHighlights = [
  {
    title: "Importuj wyciągi bankowe",
    description: "PDF, CSV i XLSX zaczytujemy automatycznie, kategoryzując transakcje.",
    accent: "bg-emerald-400/20",
  },
  {
    title: "Analiza w czasie rzeczywistym",
    description: "Dashboard i Flow reagują na Twoje dane natychmiast po imporcie.",
    accent: "bg-indigo-400/20",
  },
  {
    title: "Eksperymenty w Labie",
    description: "Testuj scenariusze, porównuj okresy i szukaj anomalii w wydatkach.",
    accent: "bg-pink-400/20",
  },
];

const steps = [
  "Dodaj wyciąg bankowy jednym kliknięciem.",
  "Zobacz automatyczne kategorie i salda.",
  "Analizuj trendy w Dashboard i Flow.",
  "Eksperymentuj w Labie bez ryzyka.",
];

export default function LandingPage() {
  return (
    <div className="relative mx-auto max-w-screen-2xl overflow-hidden space-y-16 px-6 md:px-10 lg:px-14">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="bg-orbit bg-orbit--left" />
        <div className="bg-orbit bg-orbit--right" />
      </div>

      <section className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]" />
            Personal finance lab
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              Ogarnij przepływy finansowe z FlowParser.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 md:text-lg">
              Importuj wyciągi, eksploruj dane i odkrywaj trendy dzięki interaktywnym wizualizacjom. Wszystko w jednej,
              spójnej przestrzeni.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition-transform hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              Otwórz Dashboard
              <ArrowIcon />
            </Link>
            <Link
              href="/flow"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-indigo-300/60 hover:bg-indigo-500/20"
            >
              Poznaj Flow
              <SparklesIcon />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureHighlights.map((feature) => (
              <motion.div
                key={feature.title}
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 220, damping: 16 }}
                className="glass-card glass-card-hover-soft relative overflow-hidden p-4"
              >
                <div className={`absolute inset-0 ${feature.accent} blur-3xl opacity-40`} />
                <div className="relative space-y-2">
                  <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-slate-300">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -left-10 -top-14 h-28 w-28 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -right-4 -bottom-12 h-32 w-32 rounded-full bg-indigo-400/20 blur-3xl" />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="glass-card glass-card-hover-strong relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-emerald-400/10" />
            <div className="relative space-y-4 p-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>Podgląd</span>
                <span className="flex items-center gap-2 text-emerald-300">
                  Live
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PreviewStat label="Saldo" value="12 482,20 zł" trend="+820,50" positive />
                <PreviewStat label="Średni wydatek" value="-243,10 zł" trend="-2,3%" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Transakcje z ostatnich 7 dni</span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Aktualne
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <TransactionRow title="Restauracja Moko" amount="-74,50 zł" category="Jedzenie" />
                  <TransactionRow title="Przelew wynagrodzenie" amount="+8 200,00 zł" category="Przychód" positive />
                  <TransactionRow title="Paliwo" amount="-260,90 zł" category="Transport" />
                  <TransactionRow title="Abonament muzyka" amount="-24,99 zł" category="Subskrypcja" />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"
              >
                <div className="flex items-center justify-between text-slate-300">
                  <span>Sezonowość wydatków</span>
                  <span className="text-emerald-300">Stabilnie</span>
                </div>
                <div className="h-16 rounded-xl bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.45),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(79,70,229,0.4),transparent_55%)]" />
                <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  <span>Dashboard</span>
                  <span>Flow</span>
                  <span>Lab</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="relative glass-card glass-card-hover-soft border-white/10 px-6 py-8">
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Jak wygląda pierwsze 10 minut?</h2>
            <p className="max-w-2xl text-slate-300">
              Od razu widzisz, co dzieje się na Twoich kontach. Krok po kroku przechodzisz od importu do gotowych wniosków,
              bez zbędnej konfiguracji.
            </p>
            <div className="grid gap-3">
              {steps.map((step, index) => (
                <motion.div
                  key={step}
                  whileHover={{ x: 6 }}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-200">
                    {index + 1}
                  </span>
                  <p className="text-sm text-slate-200">{step}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InteractiveTile
              title="Stabilność cashflow"
              value="+18%"
              tone="positive"
              description="Twoje miesięczne saldo poprawia się trzeci miesiąc z rzędu."
            />
            <InteractiveTile
              title="Ryzyka"
              value="2"
              tone="warning"
              description="Dwie kategorie wydatków rosną szybciej niż zwykle."
            />
            <InteractiveTile
              title="Szanse"
              value="5"
              tone="neutral"
              description="Wydatki na subskrypcje można zoptymalizować o 140 zł."
            />
            <InteractiveTile
              title="Alerty"
              value="On"
              tone="positive"
              description="Powiadomienia o dużych transakcjach wysyłane w 15 min."
            />
          </div>
        </div>
      </section>

      <section className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-slate-950/60 to-indigo-950/40 p-8">
        <div className="absolute -left-8 -top-10 h-36 w-36 rotate-12 bg-gradient-to-br from-emerald-400/25 via-transparent to-transparent blur-3xl" />
        <div className="absolute -right-16 -bottom-12 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Gotowy na start?</p>
            <h3 className="text-2xl font-semibold text-white">FlowParser wspiera Twój sposób pracy z finansami.</h3>
            <p className="max-w-2xl text-slate-300">
              Zbuduj własny rytuał kontroli finansów: szybki import, wizualizacje, a później eksperymenty w Labie.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-indigo-500/20 transition-transform hover:-translate-y-0.5"
            >
              Przejdź do aplikacji
              <ArrowIcon />
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-emerald-500/15"
            >
              Otwórz Lab
              <SparklesIcon />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform"
    >
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3l1.6 3.6L17 8l-3.4 1.4L12 13l-1.6-3.6L7 8l3.4-1.4L12 3zM6 14l1 2.2L9 17l-2 0.8L6 20l-1-2.2L3 17l2-0.8L6 14zm12 0l1 2.2L21 17l-2 0.8L18 20l-1-2.2L15 17l2-0.8 1-2.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PreviewStat({
  label,
  value,
  trend,
  positive,
}: {
  label: string;
  value: string;
  trend: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
      <div className="flex items-center justify-between text-slate-400">
        <span>{label}</span>
        <span className={`text-xs font-medium ${positive ? "text-emerald-300" : "text-rose-300"}`}>
          {positive ? "+" : ""}
          {trend}
        </span>
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function TransactionRow({
  title,
  amount,
  category,
  positive,
}: {
  title: string;
  amount: string;
  category: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
      <div>
        <p className="text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">{category}</p>
      </div>
      <span className={`text-sm font-semibold ${positive ? "text-emerald-300" : "text-rose-300"}`}>{amount}</span>
    </div>
  );
}

function InteractiveTile({
  title,
  value,
  description,
  tone = "neutral",
}: {
  title: string;
  value: string;
  description: string;
  tone?: "positive" | "warning" | "neutral";
}) {
  const toneClass = {
    positive: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    warning: "from-amber-500/20 via-amber-500/10 to-transparent",
    neutral: "from-indigo-500/20 via-indigo-500/10 to-transparent",
  }[tone];

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${toneClass} opacity-80`} />
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{title}</p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{value}</span>
        </div>
        <p className="text-sm text-slate-200">{description}</p>
      </div>
    </motion.div>
  );
}
