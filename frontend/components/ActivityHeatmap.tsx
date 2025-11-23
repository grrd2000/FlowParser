// frontend/components/ActivityHeatmap.tsx
"use client";

import { useMemo } from "react";
import type { Transaction } from "@/lib/serverApi";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  transactions: Transaction[];
};

const DAY_NAMES = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

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

export function ActivityHeatmap({ transactions }: Props) {
  const { xLabels, yLabels, zMatrix } = useMemo(() => {
    const weeksSet = new Set<string>();
    const map = new Map<string, Map<number, number>>();

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (Number.isNaN(amount) || amount >= 0) continue; // tylko wydatki

      const d = parseDateStr(t.operation_date);
      if (!d) continue;
      const { year, week } = getIsoWeek(d);
      const weekKey = `${year}-W${week.toString().padStart(2, "0")}`;
      const dayIndex = d.getDay(); // 0-6

      weeksSet.add(weekKey);
      if (!map.has(weekKey)) {
        map.set(weekKey, new Map());
      }
      const inner = map.get(weekKey)!;
      const prev = inner.get(dayIndex) ?? 0;
      inner.set(dayIndex, prev + Math.abs(amount));
    }

    const yLabels = Array.from(weeksSet).sort();
    const xLabels = [...DAY_NAMES];

    const zMatrix = yLabels.map((wk) => {
      const row = map.get(wk);
      return xLabels.map((_, dayIndex) =>
        row?.get(dayIndex) ? row.get(dayIndex)! : 0
      );
    });

    return { xLabels, yLabels, zMatrix };
  }, [transactions]);

  if (!yLabels.length) {
    return (
      <p className="text-xs text-slate-500">
        Brak danych o wydatkach, żeby zbudować heatmapę.
      </p>
    );
  }

  return (
    <motion.div
      className="h-72 w-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Plot
        data={[
          {
            type: "heatmap",
            x: xLabels,
            y: yLabels,
            z: zMatrix,
            colorscale: "Viridis",
            hovertemplate:
              "Tydzień: %{y}<br>Dzień: %{x}<br>Wydatki: %{z:.2f} zł<extra></extra>",
          } as any,
        ]}
        layout={{
          margin: { l: 60, r: 10, t: 10, b: 30 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: {
            tickfont: { size: 10, color: "#9ca3af" },
          },
          yaxis: {
            tickfont: { size: 9, color: "#9ca3af" },
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
  );
}
