// frontend/components/DashboardOverviewChart.tsx
"use client";

import { useMemo } from "react";
import type { Transaction } from "@/lib/serverApi";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  transactions: Transaction[];
};

/**
 * Wykres typu "PowerBI":
 * - słupki: przychody / wydatki per dzień (stacked),
 * - linia: skumulowane saldo.
 */
export function DashboardOverviewChart({ transactions }: Props) {
  const chartData = useMemo(() => {
    // agregacja po dniu
    const byDate = new Map<
      string,
      { date: string; income: number; expense: number }
    >();

    for (const t of transactions) {
      const d = t.operation_date;
      const amount = Number(t.amount);
      if (Number.isNaN(amount)) continue;

      if (!byDate.has(d)) {
        byDate.set(d, { date: d, income: 0, expense: 0 });
      }
      const bucket = byDate.get(d)!;

      if (amount > 0) bucket.income += amount;
      if (amount < 0) bucket.expense += amount; // ujemne
    }

    const sorted = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const dates: string[] = [];
    const incomes: number[] = [];
    const expenses: number[] = [];
    const cumulative: number[] = [];

    let running = 0;
    for (const row of sorted) {
      dates.push(row.date);
      incomes.push(row.income);
      expenses.push(row.expense); // ujemne
      running += row.income + row.expense;
      cumulative.push(running);
    }

    return { dates, incomes, expenses, cumulative };
  }, [transactions]);

  const { dates, incomes, expenses, cumulative } = chartData;

  if (dates.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Brak danych do wyświetlenia na wykresie. Zaimportuj wyciąg w zakładce
        Flow.
      </p>
    );
  }

  return (
    <motion.div
      className="h-80 w-full md:h-96"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Plot
        data={[
          {
            type: "bar",
            x: dates,
            y: incomes,
            name: "Przychody",
          } as any,
          {
            type: "bar",
            x: dates,
            y: expenses, // ujemne – słupki w dół
            name: "Wydatki",
          } as any,
          {
            type: "scatter",
            x: dates,
            y: cumulative,
            name: "Saldo skumulowane",
            mode: "lines+markers",
            yaxis: "y2",
          } as any,
        ]}
        layout={{
          margin: { l: 40, r: 40, t: 10, b: 40 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          barmode: "relative",
          xaxis: {
            tickfont: { size: 10, color: "#9ca3af" },
          },
          yaxis: {
            title: "Przychody / wydatki",
            tickfont: { size: 10, color: "#9ca3af" },
          },
          yaxis2: {
            title: "Saldo",
            overlaying: "y",
            side: "right",
            tickfont: { size: 10, color: "#e5e7eb" },
          },
          showlegend: true,
          legend: {
            orientation: "h",
            y: -0.25,
            x: 0,
            font: { size: 10, color: "#e5e7eb" },
          },
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
