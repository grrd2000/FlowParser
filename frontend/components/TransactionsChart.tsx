// frontend/components/TransactionsChart.tsx
"use client";

import { useMemo, useState } from "react";
import type { Transaction } from "@/lib/serverApi";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  transactions: Transaction[];
  initialGranularity?: Granularity;
};

type Granularity = "day" | "week" | "month" | "quarter";

function parseDateStr(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getIsoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function getQuarter(d: Date): { year: number; quarter: number } {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return { year: d.getFullYear(), quarter: q };
}

export function TransactionsChart({
  transactions,
  initialGranularity,
}: Props) {
  const [granularity, setGranularity] = useState<Granularity>(
    initialGranularity ?? "day"
  );

  const buckets = useMemo(() => {
    const map = new Map<
      string,
      { label: string; income: number; expense: number; net: number }
    >();

    for (const t of transactions) {
      const date = parseDateStr(t.operation_date);
      if (!date) continue;

      const amount = Number(t.amount);
      if (Number.isNaN(amount)) continue;

      let label: string;

      switch (granularity) {
        case "day":
          label = t.operation_date;
          break;
        case "week": {
          const { year, week } = getIsoWeek(date);
          label = `${year}-W${week.toString().padStart(2, "0")}`;
          break;
        }
        case "month": {
          const y = date.getFullYear();
          const m = (date.getMonth() + 1).toString().padStart(2, "0");
          label = `${y}-${m}`;
          break;
        }
        case "quarter": {
          const { year, quarter } = getQuarter(date);
          label = `${year}-Q${quarter}`;
          break;
        }
        default:
          label = t.operation_date;
      }

      if (!map.has(label)) {
        map.set(label, { label, income: 0, expense: 0, net: 0 });
      }
      const bucket = map.get(label)!;

      if (amount > 0) bucket.income += amount;
      if (amount < 0) bucket.expense += amount;
      bucket.net += amount;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [transactions, granularity]);

  const hasData = buckets.length > 0;
  const x = buckets.map((b) => b.label);
  const net = buckets.map((b) => b.net);
  const custom = buckets.map((b) => [b.income, b.expense]);

  const granularityOptions: { value: Granularity; label: string; hint: string }[] = [
    { value: "day", label: "Dziennie", hint: "Najbardziej szczegółowy widok" },
    { value: "week", label: "Tygodniowo", hint: "Wygładza krótkie skoki" },
    { value: "month", label: "Miesięcznie", hint: "Dobry do budżetów" },
    { value: "quarter", label: "Kwartalnie", hint: "Szersza perspektywa" },
  ];

  return (
    <div className="space-y-3">
      {/* przełącznik granulacji */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3">
        <div className="space-y-0.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
            Granulacja wykresu
          </p>
          <p className="text-sm text-slate-200">
            Płynnie zmieniaj poziom szczegółowości danych
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {granularityOptions.map(({ value, label, hint }) => {
            const active = granularity === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setGranularity(value)}
                className={[
                  "group relative overflow-hidden rounded-xl border px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide transition-all duration-300",
                  active
                    ? "border-white/10 bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-[0_10px_40px_rgba(56,189,248,0.35)]"
                    : "border-slate-800 bg-slate-900/70 text-slate-200 hover:-translate-y-0.5 hover:border-slate-700 hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "block text-[12px] font-semibold",
                    active ? "text-white" : "text-slate-100",
                  ].join(" ")}
                >
                  {label}
                </span>
                <span
                  className={[
                    "block text-[10px] font-normal",
                    active ? "text-white/85" : "text-slate-400",
                  ].join(" ")}
                >
                  {hint}
                </span>

                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-20"
                  style={{
                    background:
                      "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7), transparent 35%), radial-gradient(circle at 80% 0%, rgba(125,211,252,0.55), transparent 35%)",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* animowany wykres */}
      <div className="h-64 w-full">
        {hasData ? (
          <motion.div
            className="h-full w-full"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Plot
              data={[
                {
                  type: "bar",
                  x,
                  y: net,
                  name: "Saldo (netto)",
                  customdata: custom,
                  hovertemplate:
                    "Okres: %{x}<br>" +
                    "Saldo: %{y:.2f} zł<br>" +
                    "Przychody: %{customdata[0]:.2f} zł<br>" +
                    "Wydatki: %{customdata[1]:.2f} zł<br>" +
                    "<extra></extra>",
                } as any,
              ]}
              layout={{
                margin: { l: 40, r: 10, t: 10, b: 40 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                xaxis: {
                  title: "",
                  tickfont: { size: 10, color: "#9ca3af" },
                },
                yaxis: {
                  title: "zł",
                  tickfont: { size: 10, color: "#9ca3af" },
                },
                showlegend: false,
              }}
              config={{
                displaylogo: false,
                responsive: true,
                modeBarButtonsToRemove: [
                  "toImage",
                  "lasso2d",
                  "select2d",
                  "autoScale2d",
                ],
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </motion.div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800/80 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
            Brak danych do wyświetlenia na wykresie dla wybranego zakresu.
          </div>
        )}
      </div>
    </div>
  );
}
