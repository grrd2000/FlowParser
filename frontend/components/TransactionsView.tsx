// frontend/components/TransactionsView.tsx
"use client";

import { useEffect, useState } from "react";
import type { Transaction } from "@/lib/serverApi";
import { fetchTransactionsClient } from "@/lib/clientApi";
import { TransactionsChart } from "./TransactionsChart";

type Props = {
  initialTransactions: Transaction[];
  initialAccountId?: number;
};

type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all" | "custom";

export function TransactionsView({
  initialTransactions,
  initialAccountId = 1,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [accountId] = useState<number>(initialAccountId);

  const [rangeKey, setRangeKey] = useState<RangeKey>("1m");

  const [from, setFromDate] = useState<string>("");
  const [to, setToDate] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // mini-dashboard – liczymy statystyki
  const totals = (() => {
    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (Number.isNaN(amount)) continue;
      if (amount > 0) income += amount;
      if (amount < 0) expense += amount;
    }

    const balance = income + expense;
    return { income, expense, balance, count: transactions.length };
  })();

  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchTransactionsClient({
        accountId,
        from: from || undefined,
        to: to || undefined,
      });

      setTransactions(data);
    } catch (err: any) {
      setError(err?.message ?? "Nie udało się pobrać transakcji.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFromDate("");
    setToDate("");
    // przywróć dane początkowe z SSR
    setTransactions(initialTransactions);
    setError(null);
  };

  function parseDateStr(s: string): Date | null {
    const parts = s.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map((p) => Number(p));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const handleQuickRange = (key: RangeKey) => {
  setRangeKey(key);

  const today = startOfDay(new Date());
  let from: Date | null = null;
  let to: Date | null = today;

  switch (key) {
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
      // czyścimy filtry dat
      setFromDate("");
      setToDate("");
      return;
    }
    case "custom": {
      // nic nie narzucamy – user wpisuje ręcznie
      return;
    }
  }

  if (from) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fromStr = `${from.getFullYear()}-${pad(
      from.getMonth() + 1
    )}-${pad(from.getDate())}`;
    const toStr = `${to.getFullYear()}-${pad(
      to.getMonth() + 1
    )}-${pad(to.getDate())}`;

    setFromDate(fromStr);
    setToDate(toStr);
  }
};


  return (
    <div className="space-y-6">
      {/* szybkie zakresy czasu */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-slate-400">Zakres:</span>
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
                onClick={() => handleQuickRange(key)}
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
      </div>

      {/* Filtry po dacie */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end justify-between">
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400" htmlFor="from">
              Od daty
            </label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-100
                         focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400" htmlFor="to">
              Do daty
            </label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-100
                         focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApplyFilters}
            disabled={loading}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium
                       bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700
                       disabled:text-slate-400 transition-colors"
          >
            {loading ? "Filtruję..." : "Filtruj"}
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium
                       bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Wyczyść
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Mini dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-slate-400 mb-1">Wydatki</div>
          <div className="text-rose-400 font-semibold">
            {totals.expense.toFixed(2)} zł
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-slate-400 mb-1">Przychody</div>
          <div className="text-emerald-400 font-semibold">
            {totals.income.toFixed(2)} zł
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-slate-400 mb-1">Saldo</div>
          <div
            className={
              totals.balance >= 0
                ? "text-emerald-300 font-semibold"
                : "text-rose-300 font-semibold"
            }
          >
            {totals.balance.toFixed(2)} zł
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-slate-400 mb-1">Transakcji</div>
          <div className="text-slate-100 font-semibold">
            {totals.count}
          </div>
        </div>
      </div>

      {/* Wykres z Plotly */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="text-xs text-slate-400 mb-2">
          Saldo dzienne (netto)
        </div>
        <TransactionsChart transactions={transactions} />
      </div>

      {/* Tabela transakcji */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-slate-400 p-3 text-sm">
            Brak transakcji dla wybranego zakresu dat.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Opis</th>
                <th className="px-3 py-2 text-right">Kwota</th>
                <th className="px-3 py-2 text-left">Kategoria</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-slate-800 hover:bg-slate-900/60"
                >
                  <td className="px-3 py-2 align-top">
                    {t.operation_date}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-slate-100">
                      {t.description}
                    </div>
                    {t.is_manual && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        ręczna
                      </span>
                    )}
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
                  <td className="px-3 py-2 align-top text-slate-300">
                    {t.category ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
