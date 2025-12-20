"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  fetchCategories,
  fetchTransactions,
  type Category,
  type Transaction,
} from "@/lib/serverApi";

import { useAuth } from "@/components/AuthProvider";
import { SignedOutState } from "@/components/SignedOutState";


const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all";

type DashboardClientProps = {
  initialRange?: RangeKey;
};

type TxExt = Transaction & { amountNum: number; date: Date };
type CategoryBucket = {
  name: string;
  value: number;
  categoryId: number | null;
  color?: string | null;
};

export function DashboardClient({ initialRange = "3m" }: DashboardClientProps) {

  const { user, authLoading } = useAuth();

  const [transactions, setTransactions] = useState<TxExt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);






  // 1) Fetch danych raz po załadowaniu
  useEffect(() => {
    // czekamy aż auth się ustali
    if (authLoading) return;

    // niezalogowany -> nie fetchujemy, tylko ustawiamy stany
    if (!user) {
      setTransactions([]);
      setCategories([]);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rawTx, rawCategories] = await Promise.all([
          fetchTransactions(),
          fetchCategories(),
        ]);

        const parsed = normalizeTransactions(rawTx);
        setTransactions(parsed);
        setCategories(rawCategories);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Błąd podczas ładowania danych.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, user]);
  // 2) Wyliczenia zależne od zakresu
  const {
    filtered,
    startDate,
    metrics,
    netFlowSeries,
    categorySeries,
    heatmapSeries,
  } = useMemo(() => {
    const { filtered, startDate } = filterByRange(transactions, range);
    const metrics = computeMetrics(filtered);
    const netFlowSeries = buildNetFlowSeries(filtered, range);
    const categorySeries = groupByCategory(filtered);
    const heatmapSeries = buildHeatmap(filtered);
    return {
      filtered,
      startDate,
      metrics,
      netFlowSeries,
      categorySeries,
      heatmapSeries,
    };
  }, [transactions, range]);

  const coloredCategories = useMemo(
    () => applyCategoryColors(categorySeries, categories),
    [categorySeries, categories]
  );
  const rangeText = rangeLabel(range, startDate);
  const dailyAverage = useMemo(() => {
    if (!filtered.length) return 0;
    const { expenses } = computeMetrics(filtered);
    const daySet = new Set(
      filtered.map((t) => t.date.toISOString().slice(0, 10))
    );
    const days = Math.max(1, daySet.size);
    return Math.abs(expenses) / days;
  }, [filtered]);
  const topCategory = coloredCategories[0];

  // Signed out state (after all hooks to satisfy React Rules of Hooks)
  if (!authLoading && !user) {
    return (
      <SignedOutState
        title="Dashboard"
        desc="Zaloguj się, aby zobaczyć podsumowania, trendy i wizualizacje wydatków."
      />
    );
  }


  return (
    <div className="relative space-y-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-orbit bg-orbit--left" />
        <div className="bg-orbit bg-orbit--right" />
        <motion.div
          aria-hidden
          className="absolute inset-x-12 top-6 h-24 rounded-full bg-gradient-to-r from-white/5 via-white/0 to-white/5"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/85 via-slate-900/70 to-slate-950/60 p-6 md:p-8 shadow-2xl shadow-black/40"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,0.14),transparent_45%),radial-gradient(circle_at_80%_12%,rgba(129,140,248,0.16),transparent_42%),radial-gradient(circle_at_75%_75%,rgba(236,72,153,0.18),transparent_50%)]" />
        <motion.div
          aria-hidden
          className="absolute -inset-x-10 top-6 h-14 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18),transparent_65%)] blur-3xl"
          animate={{ opacity: [0.18, 0.38, 0.18] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200 shadow-lg shadow-indigo-500/15">
              Puls Flow
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-90" />
                <span className="absolute inset-0 animate-[pulse-ring_5s_ease-in-out_infinite] rounded-full bg-emerald-400/50" />
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                Dashboard inspirowany Flow
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Ten widok korzysta z gradientów i animacji ze strony Flow, aby uwidocznić rytm finansów. Zakres danych: {" "}
                <span className="text-white font-medium">{rangeText}</span>. Wybierz scenariusz, a wykresy, kategorie i heatmapy od razu się dostosują.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <RangeChips active={range} onChange={setRange} />
              <div className="text-[11px] text-slate-400">
                Przełącz zakres, by zsynchronizować wszystkie sekcje.
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/flow"
                className="group inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[12px] font-semibold text-slate-900 shadow-lg shadow-white/25 transition-transform hover:-translate-y-0.5"
              >
                Pełen widok Flow
                <span className="h-6 w-6 rounded-full bg-slate-900 text-white grid place-items-center text-[10px] transition-transform group-hover:translate-x-0.5">
                  ↗
                </span>
              </Link>
              <Link
                href="/import"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-emerald-500/15"
              >
                Importuj dane
              </Link>
              <Link href="/statements" className="button-ghost">
                Zestawienia
              </Link>
            </div>
          </div>

          <div className="relative grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <InsightPill
              label="Średnie dzienne wydatki"
              value={formatCurrency(dailyAverage)}
              hint="Rozbite tylko na wydatki w wybranym zakresie"
            />
            <InsightPill
              label="Dominująca kategoria"
              value={topCategory ? topCategory.name : "Brak danych"}
              hint="Największy udział w wydatkach"
              color={topCategory?.color || "#a855f7"}
            />
            <InsightPill
              label="Liczba transakcji"
              value={filtered.length.toString()}
              hint="Zliczone po wszystkich wpływach i wydatkach"
            />
            <InsightPill
              label="Śledź szczegóły"
              value="Przejdź do Flow"
              href="/flow"
              hint="Pełna lista transakcji z filtrami"
            />
          </div>
        </div>
      </motion.section>

      {error && (
        <div className="rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      )}

      {/* GÓRNE KPI */}
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Saldo netto"
          value={formatCurrency(metrics.net)}
          subtitle="Suma wpływów i wydatków"
          tone={metrics.net >= 0 ? "positive" : "negative"}
          loading={loading}
        />
        <KpiCard
          label="Wydatki"
          value={formatCurrency(-Math.min(metrics.expenses, 0))}
          subtitle="Łącznie w wybranym okresie"
          tone="negative"
          loading={loading}
        />
        <KpiCard
          label="Wpływy"
          value={formatCurrency(Math.max(metrics.income, 0))}
          subtitle="Łączne wpływy"
          tone="positive"
          loading={loading}
        />
      </section>

      {/* ŚRODEK: FLOW + DONUT */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* FLOW W CZASIE */}
        <div className="lg:col-span-2 glass-card glass-card-hover-soft p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">Przepływy w czasie</h2>
              <p className="text-[11px] text-slate-400">
                Dzienny wynik netto – wpływy minus wydatki.
              </p>
            </div>
            <span className="badge-soft">Dynamiczny wykres</span>
          </div>
          <NetFlowChart series={netFlowSeries} loading={loading} />
        </div>

        {/* PODZIAŁ KATEGORII */}
        <div className="glass-card glass-card-hover-soft p-4 md:p-5 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-50 mb-1">Rozkład wydatków</h2>
              <p className="text-[11px] text-slate-400">
                Udział kategorii w całkowitych wydatkach.
              </p>
            </div>
            <span className="badge-soft">Top 8</span>
          </div>
          <CategoryDonutChart categories={coloredCategories} loading={loading} />
        </div>
      </section>

      {/* DÓŁ: HEATMAP + OSTATNIE TRANSAKCJE */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* HEATMAP */}
        <div className="glass-card glass-card-hover-soft p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">Heatmapa aktywności</h2>
              <p className="text-[11px] text-slate-400">
                Intensywność przepływów według dnia tygodnia i pory dnia.
              </p>
            </div>
            <span className="badge-soft">12 tygodni</span>
          </div>
          <HeatmapGrid data={heatmapSeries} loading={loading} />
        </div>

        {/* OSTATNIE TRANSAKCJE */}
        <div className="glass-card glass-card-hover-soft p-4 md:p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-50 mb-1">Ostatnie transakcje</h2>
              <p className="text-[11px] text-slate-400">
                Kilka ostatnich zapisów – pełna lista w zakładce <span className="text-slate-100">Flow</span>.
              </p>
            </div>
            <Link
              href="/flow"
              className="text-[11px] text-indigo-200 hover:text-white underline-offset-4 hover:underline"
            >
              Zobacz wszystko
            </Link>
          </div>
          <RecentTransactionsList
            transactions={filtered.slice(-6).reverse()}
            loading={loading}
          />
        </div>
      </section>
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function KpiCard({
  label,
  value,
  subtitle,
  tone,
  loading,
}: {
  label: string;
  value: string;
  subtitle: string;
  tone: "positive" | "negative";
  loading: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300 bg-emerald-500/10"
      : "text-rose-300 bg-rose-500/10";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 p-5 shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/25">
      <div className="absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute inset-px rounded-3xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(129,140,248,0.14),transparent_45%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </div>
      <div className="relative flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.1em] text-slate-400">
          {label}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-medium ${toneClass}`}
        >
          {tone === "positive" ? "↗" : "↘"}
          {tone === "positive" ? "Pozytywnie" : "Ostrożnie"}
        </span>
      </div>
      <div
        className={`relative mt-3 text-2xl font-semibold leading-none ${
          loading ? "text-slate-600 animate-pulse" : "text-white"
        }`}
      >
        {loading ? "—" : value}
      </div>
      <div className="relative mt-3 text-[12px] text-slate-400">{subtitle}</div>
    </div>
  );
}

function RangeChips({
  active,
  onChange,
}: {
  active: RangeKey;
  onChange: (value: RangeKey) => void;
}) {
  const options: { key: RangeKey; label: string; desc: string }[] = [
    { key: "1m", label: rangeLabelShort("1m"), desc: "Ostatnie 30 dni" },
    { key: "3m", label: rangeLabelShort("3m"), desc: "Kwartał" },
    { key: "6m", label: rangeLabelShort("6m"), desc: "Pół roku" },
    { key: "ytd", label: rangeLabelShort("ytd"), desc: "Rok bieżący" },
    { key: "all", label: rangeLabelShort("all"), desc: "Cała historia" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`group relative overflow-hidden rounded-full border px-3 py-2 text-[11px] font-semibold transition-all duration-200 ${
            active === opt.key
              ? "border-transparent bg-gradient-to-r from-emerald-400 via-indigo-400 to-pink-400 text-slate-900 shadow-lg shadow-indigo-500/30"
              : "border-white/10 bg-white/5 text-slate-100 hover:border-white/30 hover:bg-white/15"
          }`}
        >
          <span className="block leading-tight">
            {opt.label}
          </span>
          <span
            className={`block text-[10px] font-normal transition-opacity ${
              active === opt.key ? "text-slate-700" : "text-slate-300/80"
            }`}
          >
            {opt.desc}
          </span>
          <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-hidden>
            <span className="absolute inset-x-0 -top-6 h-16 bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
          </span>
        </button>
      ))}
    </div>
  );
}

function InsightPill({
  label,
  value,
  hint,
  href,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  color?: string;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 px-4 py-3 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200/60 hover:shadow-indigo-500/25">
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
        <div className="absolute inset-px rounded-2xl bg-gradient-to-r from-emerald-400/25 via-indigo-400/20 to-pink-400/20 blur" />
      </div>
      <div className="relative space-y-1">
        <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{label}</div>
        <div className="flex items-center gap-2 text-base font-semibold text-white">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color ?? "#60a5fa" }}
            aria-hidden
          />
          <span>{value}</span>
        </div>
        <div className="text-[11px] text-slate-400">{hint}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

function NetFlowChart({
  series,
  loading,
}: {
  series: { x: string; net: number; income: number; expense: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center text-[11px] text-slate-500">
        Ładowanie danych...
      </div>
    );
  }
  if (series.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-[11px] text-slate-500">
        Brak danych w wybranym okresie.
      </div>
    );
  }

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "line",
      stacked: false,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true },
      foreColor: "#94a3b8",
    },
    // theme: {
    //   mode: "dark",
    // },
    stroke: {
      curve: "smooth",
      width: [0, 0, 2],
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: "#1e293b",
      strokeDashArray: 3,
    },
    xaxis: {
      type: "category",
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        style: { colors: "#94a3b8", fontSize: "10px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748b", fontSize: "10px" },
        formatter: (val: number) => formatNumberCompact(val),
      },
    },
    tooltip: {
      shared: true,
      theme: "dark",
      fillSeriesColor: false,
      style: {
        fontSize: "11px",
        fontFamily: "inherit",
      },
      x: {
        formatter: (value: string) => value,
      },
      y: {
        formatter: (val: number, opts) => {
          const sName =
            opts?.seriesIndex === 0
              ? "Wpływy"
              : opts?.seriesIndex === 1
              ? "Wydatki"
              : "Netto";

          if (opts?.seriesIndex === 1) {
            return `${sName}: ${formatCurrency(-val)}`;
          }
          return `${sName}: ${formatCurrency(val)}`;
        },
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontSize: "10px",
      labels: { colors: "#cbd5f5" },
    },
    plotOptions: {
      bar: {
        columnWidth: "60%",
        borderRadius: 4,
      },
    },
    colors: ["#22c55e", "#fb7185", "#60a5fa"],
  };

  const seriesData: ApexAxisChartSeries = [
    {
      name: "Wpływy",
      type: "column",
      data: series.map((s) => ({
        x: s.x,
        y: s.income,
      })),
    },
    {
      name: "Wydatki",
      type: "column",
      data: series.map((s) => ({
        x: s.x,
        y: Math.abs(s.expense),
      })),
    },
    {
      name: "Netto",
      type: "line",
      data: series.map((s) => ({
        x: s.x,
        y: s.net,
      })),
    },
  ];

  return (
    <div className="h-56">
      <ReactApexChart
        type="line"
        options={options}
        series={seriesData}
        height="100%"
      />
    </div>
  );
}



const DONUT_FALLBACK_COLORS = [
  "#fbbf24",
  "#22c55e",
  "#06b6d4",
  "#a855f7",
  "#f97316",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
];

function CategoryDonutChart({
  categories,
  loading,
}: {
  categories: CategoryBucket[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-slate-500">
        Ładowanie danych...
      </div>
    );
  }
  if (categories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-slate-500">
        Brak wydatków w wybranym okresie.
      </div>
    );
  }

  const colors = categories.map(
    (c, idx) => c.color || DONUT_FALLBACK_COLORS[idx % DONUT_FALLBACK_COLORS.length]
  );

  const options: ApexCharts.ApexOptions = {
    chart: { type: "donut" },
    legend: {
      show: false,
    },
    labels: categories.map((c) => c.name),
    colors,
    dataLabels: { enabled: false },
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: { size: "60%" },
      },
    },
    tooltip: {
      y: {
        formatter: (v: number) => formatCurrency(v),
      },
    },
  };

  const seriesData = categories.map((c) => c.value);

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center justify-center">
        <ReactApexChart
          type="donut"
          options={options}
          series={seriesData}
          height={180}
        />
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto pr-1 text-[11px]">
        {categories.map((c, idx) => (
          <div
            key={c.name}
            className="flex items-center justify-between text-slate-200"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: colors[idx] }}
                aria-hidden
              />
              <span>{c.name}</span>
            </span>
            <span className="text-slate-400">
              {formatCurrency(c.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapGrid({
  data,
  loading,
}: {
  data: { weekIndex: number; dayIndex: number; value: number }[];
  loading: boolean;
}) {
  const days = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

  // wszystkie tygodnie obecne w danych
  const weekSet = new Set<number>();
  for (const d of data) {
    weekSet.add(d.weekIndex);
  }
  const allWeeks = Array.from(weekSet).sort((a, b) => a - b);

  const MAX_WEEKS = 12;
  const trimmed = allWeeks.length > MAX_WEEKS;
  const weeks = trimmed ? allWeeks.slice(-MAX_WEEKS) : allWeeks;

  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  const getValue = (dayIdx: number, weekIdx: number) => {
    const entry = data.find(
      (d) => d.dayIndex === dayIdx && d.weekIndex === weekIdx
    );
    return entry?.value ?? 0;
  };

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center text-[11px] text-slate-500">
        Ładowanie danych...
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-[11px] text-slate-500">
        Brak danych w wybranym okresie.
      </div>
    );
  }

  return (
  <div className="space-y-2 text-[10px]">
    {/* nagłówki tygodni */}
    <div className="flex items-center">
      <div className="w-8" />
      <div className="flex gap-1 flex-1 justify-between">
        {weeks.map((w) => (
          <span key={w} className="text-slate-400">
            T{w + 1}
          </span>
        ))}
      </div>
    </div>

    {trimmed && (
      <div className="text-right text-[9px] text-slate-500">
        Pokazuję ostatnie {MAX_WEEKS} tygodni (z {allWeeks.length})
      </div>
    )}

    {/* ...reszta: wiersze z dniami tygodnia */}
    <div className="space-y-1">
      {days.map((label, dayIdx) => (
        <div key={label} className="flex items-center gap-1">
          <div className="w-8 text-slate-400">{label}</div>
          <div className="flex gap-1 flex-1">
            {weeks.map((w) => {
              const val = getValue(dayIdx, w);
              const intensity = Math.min(1, Math.abs(val) / max);
              const bg =
                intensity === 0
                  ? "bg-slate-800/40"
                  : val >= 0
                  ? "bg-emerald-400"
                  : "bg-rose-400";
              const opacity =
                intensity === 0 ? 0.25 : 0.3 + intensity * 0.7;

              return (
                <div
                  key={w}
                  className={`h-5 flex-1 rounded-md ${bg}`}
                  style={{ opacity }}
                  title={`T${w + 1}, ${label}: ${val.toFixed(2)}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </div>
);

}



function RecentTransactionsList({
  transactions,
  loading,
}: {
  transactions: Transaction[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center text-[11px] text-slate-500">
        Ładowanie danych...
      </div>
    );
  }
  if (transactions.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[11px] text-slate-500">
        Brak transakcji w wybranym okresie.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transactions.map((t, idx) => {
        const amount = parseAmount(t.amount as any);
        const isPositive = amount >= 0;
        const isFaded = idx === transactions.length - 1;

        return (
            <div
              key={t.id}
              className={[
                "flex items-center justify-between rounded-xl px-2 py-1.5 text-[11px]",
                "transition-all duration-150 hover:bg-slate-900/80 hover:scale-[1.01]",
                isFaded
                  ? "bg-slate-900/20 text-slate-500"
                  : "bg-slate-900/60 text-slate-100",
              ].join(" ")}
            >
            <div className="flex flex-col">
              <span className="truncate max-w-[180px]">
                {t.description}
              </span>
              <span className="text-slate-500">
                {t.operation_date}
              </span>
            </div>
            <div
              className={
                isPositive ? "text-emerald-300" : "text-rose-300"
              }
            >
              {formatCurrency(amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- DATA HELPERS ---------- */

function normalizeTransactions(transactions: Transaction[]): TxExt[] {
  return transactions
    .map((t) => ({
      ...t,
      amountNum: parseAmount(t.amount as any),
      date: parseDate(t.operation_date),
    }))
    .filter((t) => !!t.date) as TxExt[];
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/\s/g, "")
    .replace("PLN", "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string | null | undefined): Date {
  if (!raw) return new Date(NaN);
  const d = new Date(raw);
  return d;
}

function filterByRange(data: TxExt[], range: RangeKey) {
  if (data.length === 0) {
    return { filtered: [] as TxExt[], startDate: null as Date | null };
  }
  const sorted = [...data].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const lastDate = sorted[sorted.length - 1].date;
  const start = computeStartDate(lastDate, range);
  if (!start) {
    return { filtered: sorted, startDate: null as Date | null };
  }
  const filtered = sorted.filter((t) => t.date >= start);
  return { filtered, startDate: start };
}

function computeStartDate(last: Date, range: RangeKey): Date | null {
  const d = new Date(last);
  switch (range) {
    case "1m":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "3m":
      d.setMonth(d.getMonth() - 3);
      return d;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "ytd":
      return new Date(d.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

function computeMetrics(data: TxExt[]) {
  let income = 0;
  let expenses = 0;
  for (const t of data) {
    if (t.amountNum >= 0) income += t.amountNum;
    else expenses += t.amountNum;
  }
  const net = income + expenses;
  return { income, expenses, net };
}

function groupByDay(data: TxExt[]) {
  type Agg = { net: number; income: number; expense: number };

  const map = new Map<string, Agg>();

  for (const t of data) {
    const key = t.date.toISOString().slice(0, 10); // YYYY-MM-DD
    const agg = map.get(key) ?? { net: 0, income: 0, expense: 0 };

    if (t.amountNum >= 0) {
      agg.income += t.amountNum;
    } else {
      agg.expense += t.amountNum; // ujemne
    }
    agg.net = agg.income + agg.expense;

    map.set(key, agg);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, agg]) => ({
      date,
      net: agg.net,
      income: agg.income,
      expense: agg.expense,
    }));
}


function groupByCategory(data: TxExt[]): CategoryBucket[] {
  const UNCATEGORIZED_LABEL = "Brak kategorii";

  const map = new Map<string, CategoryBucket>();
  for (const t of data) {
    if (t.amountNum >= 0) continue; // tylko wydatki
    const categoryId = t.category_id ?? null;
    const name = t.category?.trim() || UNCATEGORIZED_LABEL;
    const key = categoryId != null ? `id-${categoryId}` : `name-${name}`;

    const current = map.get(key) ?? {
      name,
      value: 0,
      categoryId,
    };

    map.set(key, {
      ...current,
      name,
      categoryId,
      value: current.value + Math.abs(t.amountNum),
    });
  }
  return Array.from(map.values())
    .sort((a, b) => {
      if (a.name === UNCATEGORIZED_LABEL) return 1;
      if (b.name === UNCATEGORIZED_LABEL) return -1;
      return b.value - a.value;
    })
    .map((bucket) => ({ ...bucket }));
}

function applyCategoryColors(
  buckets: CategoryBucket[],
  categories: Category[]
): CategoryBucket[] {
  if (categories.length === 0) return buckets;

  const colorById = new Map<number, string>();
  const colorByName = new Map<string, string>();

  for (const cat of categories) {
    if (!cat.color) continue;
    if (cat.id != null) {
      colorById.set(cat.id, cat.color);
    }
    if (cat.name) {
      colorByName.set(cat.name.trim(), cat.color);
    }
  }

  return buckets.map((bucket) => {
    const colorFromId =
      bucket.categoryId != null ? colorById.get(bucket.categoryId) : undefined;
    const colorFromName = colorByName.get(bucket.name);
    return {
      ...bucket,
      color: colorFromId ?? colorFromName ?? bucket.color ?? null,
    };
  });
}

function buildHeatmap(data: TxExt[]) {
  if (data.length === 0) return [] as { weekIndex: number; dayIndex: number; value: number }[];

  // sortujemy po dacie i bierzemy najstarszą jako początek zakresu
  const sorted = [...data].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const start = sorted[0].date;
  const dayMs = 24 * 60 * 60 * 1000;

  const map = new Map<string, number>();

  for (const t of data) {
    const diffDays = Math.floor(
      (t.date.getTime() - start.getTime()) / dayMs
    );
    const weekIndex = Math.floor(diffDays / 7);
    const dayIndex = (t.date.getDay() + 6) % 7; // Pn=0

    const key = `${weekIndex}-${dayIndex}`;
    map.set(key, (map.get(key) ?? 0) + t.amountNum);
  }

  return Array.from(map.entries()).map(([key, value]) => {
    const [weekStr, dayStr] = key.split("-");
    return {
      weekIndex: Number(weekStr),
      dayIndex: Number(dayStr),
      value,
    };
  });
}


function rangeLabel(range: RangeKey, startDate: Date | null) {
  if (!startDate) return "całej historii";
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  return `okres od ${startDate.toLocaleDateString("pl-PL", opts)}`;
}

function rangeLabelShort(range: RangeKey) {
  switch (range) {
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    case "6m":
      return "6M";
    case "ytd":
      return "YTD";
    case "all":
      return "ALL";
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateShort(isoDate: string) {
  // "2025-09-01" -> "01.09"
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}`;
}

function formatDateLong(isoDate: string) {
  // "2025-09-01" -> "01.09.2025"
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

function formatNumberCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(".0", "") + "M";
  }
  if (abs >= 1_000) {
    return (value / 1_000).toFixed(1).replace(".0", "") + "k";
  }
  return value.toFixed(0);
}

function buildNetFlowSeries(data: TxExt[], range: RangeKey) {
  type Agg = { net: number; income: number; expense: number };

  const map = new Map<string, Agg>();

  for (const t of data) {
    const d = t.date;
    const year = d.getFullYear();
    const month = d.getMonth(); // 0–11

    let key: string;

    switch (range) {
      case "1m": {
        // dziennie: YYYY-MM-DD
        key = d.toISOString().slice(0, 10);
        break;
      }
      case "3m": {
        // tygodnie: YYYY-Www
        const { year: y, week } = getIsoWeek(d);
        key = `${y}-W${String(week).padStart(2, "0")}`;
        break;
      }
      case "6m":
      case "ytd": {
        // miesiące: YYYY-MM
        key = `${year}-${String(month + 1).padStart(2, "0")}`;
        break;
      }
      case "all": {
        // kwartały: YYYY-Qx
        const q = Math.floor(month / 3) + 1;
        key = `${year}-Q${q}`;
        break;
      }
    }

    const agg = map.get(key) ?? { net: 0, income: 0, expense: 0 };

    if (t.amountNum >= 0) {
      agg.income += t.amountNum;
    } else {
      agg.expense += t.amountNum; // ujemne
    }
    agg.net = agg.income + agg.expense;

    map.set(key, agg);
  }

  const points = Array.from(map.entries()).map(([key, agg]) => ({
    key,
    label: labelForBucket(key, range),
    net: agg.net,
    income: agg.income,
    expense: agg.expense,
  }));

  // sortujemy po key (formaty typu YYYY-MM, YYYY-Www, YYYY-Qx są do tego OK)
  points.sort((a, b) => (a.key < b.key ? -1 : 1));

  return points.map((p) => ({
    x: p.label,
    net: p.net,
    income: p.income,
    expense: p.expense,
  }));
}

// Pomocniczo: tydzień ISO
function getIsoWeek(date: Date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), week };
}

function labelForBucket(key: string, range: RangeKey) {
  switch (range) {
    case "1m": {
      // YYYY-MM-DD -> dd.MM
      const [y, m, d] = key.split("-");
      if (!y || !m || !d) return key;
      return `${d}.${m}`;
    }
    case "3m": {
      // YYYY-Www -> Tww
      const parts = key.split("-W");
      const week = parts[1] ?? key;
      return `T${week}`;
    }
    case "6m":
    case "ytd": {
      // YYYY-MM -> MM.YY
      const [y, m] = key.split("-");
      if (!y || !m) return key;
      return `${m}.${y.slice(-2)}`;
    }
    case "all": {
      // YYYY-Qx -> Qx YY
      const [y, q] = key.split("-Q");
      if (!y || !q) return key;
      return `Q${q} ${y.slice(-2)}`;
    }
  }
}
