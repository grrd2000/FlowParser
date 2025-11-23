// frontend/components/SpendingDonut.tsx
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

export function SpendingDonut({ transactions }: Props) {
  const { labels, values, total } = useMemo(() => {
    const buckets = new Map<string, number>();

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (Number.isNaN(amount) || amount >= 0) continue; // tylko wydatki

      const d = parseDateStr(t.operation_date);
      if (!d) continue;

      const dayIndex = d.getDay(); // 0-6, 0 = Sunday
      const label = DAY_NAMES[dayIndex];

      const prev = buckets.get(label) ?? 0;
      buckets.set(label, prev + Math.abs(amount));
    }

    const entries = Array.from(buckets.entries()).sort(
      (a, b) => DAY_NAMES.indexOf(a[0]) - DAY_NAMES.indexOf(b[0])
    );

    const labels = entries.map(([label]) => label);
    const values = entries.map(([, value]) => value);
    const total = values.reduce((s, v) => s + v, 0);

    return { labels, values, total };
  }, [transactions]);

  if (!labels.length || total === 0) {
    return (
      <p className="text-xs text-slate-500">
        Brak danych o wydatkach. Zaimportuj wyciąg w zakładce Flow.
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
            type: "pie",
            labels,
            values,
            hole: 0.55,
            sort: false,
            textinfo: "none",
          } as any,
        ]}
        layout={{
          margin: { l: 0, r: 0, t: 10, b: 10 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          showlegend: true,
          legend: {
            orientation: "h",
            y: -0.15,
            x: 0,
            font: { size: 10, color: "#e5e7eb" },
          },
          annotations: [
            {
              text: `${total.toFixed(0)} zł`,
              x: 0.5,
              y: 0.5,
              font: { size: 14, color: "#e5e7eb" },
              showarrow: false,
            },
          ],
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
