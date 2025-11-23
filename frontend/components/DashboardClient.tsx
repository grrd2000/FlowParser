// frontend/components/DashboardClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Transaction } from "@/lib/serverApi";
import { KpiCard } from "@/components/KpiCard";
import { DashboardOverviewChart } from "@/components/DashboardOverviewChart";
import { SpendingDonut } from "@/components/SpendingDonut";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";

type Props = {
  transactions: Transaction[];
};

type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all" | "custom";

function parseDateStr(s: string): Date | null {
  // Bezpieczne parsowanie YYYY-MM-DD
  const parts = s.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DashboardClient({ transactions }: Props) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("1m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // 1) Wyznaczamy przefiltrowane transakcje wg wybranego zakresu
  const filtered = useMemo(() => {
    if (!transactions.length) return [];

    const today = startOfDay(new Date());
    let from: Date | null = null;
    let to: Date | null = today;

    switch (rangeKey) {
        case "1m": {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 1);
        from = d;
        break;
      }
      case "3m": {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 3);
        from = d;
        break;
      }
      case "6m": {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 6);
        from = d;
        break;
      }
      case "ytd": {
        from = new Date(today.getFullYear(), 0, 1);
        break;
      }
      case "all": {
        return [...transactions];
      }
      case "custom": {
        from = customFrom ? parseDateStr(customFrom) : null;
        to = customTo ? startOfDay(parseDateStr(customTo) ?? today) : today;
        break;
      }
    }

    return transactions.filter((t) => {
      const d = parseDateStr(t.operation_date);
      if (!d) return false;
      const day = startOfDay(d);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [transactions, rangeKey, customFrom, customTo]);

  // 2) Agregaty na podstawie przefiltrowanych transakcji
  const {
    income,
    expense,
    balance,
    txCount,
    daysCount,
    avgDailySpend,
    avgTxn,
    preview,
    hasMore,
    extraCount,
  } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const datesSet = new Set<string>();

    for (const t of filtered) {
      const amount = Number(t.amount);
      if (Number.isNaN(amount)) continue;

      datesSet.add(t.operation_date);

      if (amount > 0) income += amount;
      if (amount < 0) expense += amount;
    }

    const balance = income + expense;
    const txCount = filtered.length;
    const daysCount = datesSet.size || 1;
    const avgDailySpend =
      daysCount > 0 ? Math.abs(expense) / daysCount : 0;
    const avgTxn =
      txCount > 0 ? (income + expense) / txCount : 0;

    const sorted = [...filtered].sort((a, b) =>
      b.operation_date.localeCompare(a.operation_date)
    );
    const preview = sorted.slice(0, 5);
    const hasMore = sorted.length > 5;
    const extraCount = hasMore ? sorted.length - 5 : 0;

    return {
      income,
      expense,
      balance,
      txCount,
      daysCount,
      avgDailySpend,
      avgTxn,
      preview,
      hasMore,
      extraCount,
    };
  }, [filtered]);

  const rangeLabel =
    rangeKey === "1m"
      ? "Ostatni miesiąc"
      : rangeKey === "3m"
      ? "Ostatnie 3 miesiące"
      : rangeKey === "6m"
      ? "Ostatnie 6 miesięcy"
      : rangeKey === "ytd"
      ? "Year to date"
      : rangeKey === "all"
      ? "Cała historia"
      : "Zakres niestandardowy";

  return (
    <div className="space-y-5">
      {/* Nagłówek + filtry czasu */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-xs text-slate-500">
            Podsumowanie Twoich przepływów finansowych.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Zakres: <span className="text-slate-300">{rangeLabel}</span> —{" "}
            {filtered.length} transakcji
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 text-[11px] text-slate-400">
          {/* szybkie zakresy */}
          <div className="inline-flex rounded-full bg-slate-900/70 border border-slate-800 p-0.5">
            {(
              [
                ["1m", "1 mies."],
                ["3m", "3 mies."],
                ["6m", "6 mies."],
                ["ytd", "YTD"],
                ["all", "Wszystko"],
                ["custom", "Custom"],
              ] as [RangeKey, string][]
            ).map(([key, label]) => {
              const active = rangeKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRangeKey(key)}
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

          {/* daty custom */}
          {rangeKey === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Od</span>
              <input
                type="date"
                className="bg-slate-900/80 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span>do</span>
              <input
                type="date"
                className="bg-slate-900/80 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Saldo"
          value={`${balance.toFixed(2)} zł`}
          tone={balance >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Przychody"
          value={`${income.toFixed(2)} zł`}
          tone="positive"
        />
        <KpiCard
          label="Wydatki"
          value={`${Math.abs(expense).toFixed(2)} zł`}
          tone="negative"
        />
        <KpiCard
          label="Transakcje"
          value={String(txCount)}
          tone="neutral"
          subLabel={`${daysCount} dni w zakresie`}
        />
      </section>

      {/* Wykres główny + donut + heatmapa */}
      <section className="grid gap-4 lg:grid-cols-[2fr_1.2fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-indigo-400/60 hover:shadow-xl hover:shadow-indigo-500/10 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-200">
              Przepływy i saldo w czasie
            </h2>
            <span className="text-[11px] text-slate-500">
              Interaktywny wykres (zoom, hover)
            </span>
          </div>
          <DashboardOverviewChart transactions={filtered} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-medium text-slate-200">
                Wydatki wg dnia tygodnia
              </h2>
              <span className="text-[11px] text-slate-500">Donut</span>
            </div>
            <SpendingDonut transactions={filtered} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-medium text-slate-200">
                Heatmapa wydatków
              </h2>
            </div>
            <ActivityHeatmap transactions={filtered} />
          </div>
        </div>
      </section>

      {/* Ostatnie transakcje – 5 + "zanikająca" linia */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-500/70 transition-colors cursor-pointer">
        <Link href="/flow" className="block">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200">
              Ostatnie transakcje
            </h2>
            <span className="text-[11px] text-slate-500">
              kliknij, aby przejść do pełnej listy
            </span>
          </div>
          {preview.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 pb-4">
              Brak transakcji w wybranym zakresie. Zmień filtr dat lub
              zaimportuj wyciąg w zakładce Flow.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/80 border-t border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Opis</th>
                    <th className="px-3 py-2 text-right">Kwota</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-slate-800/80 hover:bg-slate-900/70 transition-colors"
                    >
                      <td className="px-3 py-2 align-top">
                        {t.operation_date}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="text-slate-100 line-clamp-2">
                          {t.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <span
                          className={
                            Number(t.amount) < 0
                              ? "text-rose-400"
                              : "text-emerald-400"
                          }
                        >
                          {t.amount} zł
                        </span>
                      </td>
                    </tr>
                  ))}

                  {hasMore && (
                    <tr className="border-t border-slate-800/80">
                      <td
                        colSpan={3}
                        className="px-3 py-2 text-center text-[11px] text-slate-500 italic"
                      >
                        + {extraCount} kolejnych transakcji w wybranym
                        zakresie — kliknij, aby zobaczyć pełną listę w
                        zakładce Flow
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Link>
      </section>
    </div>
  );
}
