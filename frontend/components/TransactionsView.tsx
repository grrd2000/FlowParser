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

export function TransactionsView({
  initialTransactions,
  initialAccountId = 1,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [accountId] = useState<number>(initialAccountId);

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

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
    setFrom("");
    setTo("");
    // przywróć dane początkowe z SSR
    setTransactions(initialTransactions);
    setError(null);
  };

  return (
    <div className="space-y-6">
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
              onChange={(e) => setFrom(e.target.value)}
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
              onChange={(e) => setTo(e.target.value)}
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
