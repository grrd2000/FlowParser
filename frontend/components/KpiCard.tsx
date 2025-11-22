// frontend/components/KpiCard.tsx
"use client";

import { motion } from "framer-motion";

type Props = {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  subLabel?: string;
};

export function KpiCard({ label, value, tone, subLabel }: Props) {
  const toneClasses =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
      ? "text-rose-300"
      : "text-slate-100";

  return (
    <motion.div
      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4
                 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10
                 transition-all cursor-default"
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
    >
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${toneClasses}`}>{value}</div>
      {subLabel && (
        <div className="text-[11px] text-slate-500 mt-1">{subLabel}</div>
      )}
    </motion.div>
  );
}
