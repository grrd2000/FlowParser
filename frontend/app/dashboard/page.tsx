// frontend/app/dashboard/page.tsx
import { fetchTransactions } from "@/lib/serverApi";
import { DashboardOverviewChart } from "@/components/DashboardOverviewChart";
import { KpiCard } from "@/components/KpiCard";

export default async function DashboardPage() {
  const transactions = await fetchTransactions();

  // proste agregaty
  let income = 0;
  let expense = 0;
  const datesSet = new Set<string>();
  let biggestExpense = { amount: 0, description: "", date: "" };

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (Number.isNaN(amount)) continue;

    datesSet.add(t.operation_date);

    if (amount > 0) income += amount;
    if (amount < 0) {
      expense += amount;
      if (amount < biggestExpense.amount) {
        biggestExpense = {
          amount,
          description: t.description,
          date: t.operation_date,
        };
      }
    }
  }

  const balance = income + expense;
  const txCount = transactions.length;
  const daysCount = datesSet.size || 1;
  const avgDailySpend =
    daysCount > 0 ? Math.abs(expense) / daysCount : 0;
  const avgTxn =
    txCount > 0 ? (income + expense) / txCount : 0;

  // ostatnie 10 transakcji
  const latest = [...transactions]
    .sort((a, b) => b.operation_date.localeCompare(a.operation_date))
    .slice(0, 10);

  return (
    <div className="space-y-5">
      {/* nagłówek mini */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-xs text-slate-500">
            Podsumowanie Twoich przepływów finansowych.
          </p>
        </div>
        <div className="hidden sm:flex text-[11px] text-slate-500 gap-2">
          <span>Widok ogólny</span>
        </div>
      </header>

      {/* rząd dużych KPI */}
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
          subLabel={`${daysCount} dni obserwacji`}
        />
      </section>

      {/* wykres + dodatkowe karty */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* duży wykres 2/3 szerokości */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-indigo-400/60 hover:shadow-xl hover:shadow-indigo-500/10 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-200">
              Przepływy i saldo w czasie
            </h2>
            <span className="text-[11px] text-slate-500">
              Interaktywny wykres (zoom, hover)
            </span>
          </div>
          <DashboardOverviewChart transactions={transactions} />
        </div>

        {/* prawa kolumna: ciekawostki */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-rose-400/60 hover:shadow-lg hover:shadow-rose-500/10 transition-all">
            <div className="text-xs text-slate-400 mb-1">
              Największy wydatek
            </div>
            {biggestExpense.amount === 0 ? (
              <p className="text-xs text-slate-500">
                Brak danych o wydatkach.
              </p>
            ) : (
              <>
                <div className="text-lg font-semibold text-rose-400">
                  {Math.abs(biggestExpense.amount).toFixed(2)} zł
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-3">
                  {biggestExpense.description}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {biggestExpense.date}
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
            <div className="text-xs text-slate-400 mb-1">
              Średnie wartości
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Śr. dzienny wydatek</span>
                <span className="text-rose-300">
                  {avgDailySpend.toFixed(2)} zł
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Śr. wartość transakcji</span>
                <span
                  className={
                    avgTxn >= 0 ? "text-emerald-300" : "text-rose-300"
                  }
                >
                  {avgTxn.toFixed(2)} zł
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ostatnie transakcje */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-500/70 transition-colors">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-200">
            Ostatnie transakcje
          </h2>
          <span className="text-[11px] text-slate-500">
            {latest.length} pozycji
          </span>
        </div>
        {latest.length === 0 ? (
          <p className="text-sm text-slate-400 px-4 pb-4">
            Brak transakcji. Przejdź do zakładki Flow, aby zaimportować
            wyciąg.
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
                {latest.map((t) => (
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
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
