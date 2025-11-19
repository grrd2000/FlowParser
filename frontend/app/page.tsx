// frontend/app/page.tsx
import { fetchTransactions } from "@/lib/api";

export default async function HomePage() {
  const transactions = await fetchTransactions();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-semibold mb-6">Moje transakcje</h1>

        {transactions.length === 0 ? (
          <p className="text-slate-400">
            Brak transakcji. Wgraj wyciąg PDF przez backend.
          </p>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
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
          </div>
        )}
      </div>
    </main>
  );
}
