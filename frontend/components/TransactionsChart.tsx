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

  if (buckets.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Brak danych do wyświetlenia na wykresie dla wybranego zakresu.
      </p>
    );
  }

  const x = buckets.map((b) => b.label);
  const net = buckets.map((b) => b.net);
  const custom = buckets.map((b) => [b.income, b.expense]);

  return (
    <div className="space-y-3">
      {/* przełącznik granulacji */}
      <div className="inline-flex rounded-full bg-slate-900/70 border border-slate-800 p-0.5 text-[11px]">
        {(
          [
            ["day", "Dziennie"],
            ["week", "Tygodniowo"],
            ["month", "Miesięcznie"],
            ["quarter", "Kwartalnie"],
          ] as [Granularity, string][]
        ).map(([value, label]) => {
          const active = granularity === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setGranularity(value)}
              className={[
                "px-3 py-1 rounded-full transition-colors",
                active
                  ? "bg-indigo-500 text-slate-50"
                  : "text-slate-400 hover:text-slate-100",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* animowany wykres */}
      <div className="h-64 w-full">
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
      </div>
    </div>
  );
}
