// frontend/app/page.tsx
import { fetchTransactions } from "@/lib/serverApi";
import { UploadForm } from "@/components/UploadForm";
import { TransactionsView } from "@/components/TransactionsView";

export default async function HomePage() {
  const initialTransactions = await fetchTransactions();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Szybki podgląd Twoich finansów: import wyciągów, wykresy i lista
          transakcji.
        </p>
      </header>

      {/* upload */}
      <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
        <h2 className="text-sm font-medium mb-3 text-slate-200">
          Importuj wyciąg PDF
        </h2>
        <UploadForm />
      </section>

      {/* filtry + mini-dashboard + wykres + tabela */}
      <section>
        <TransactionsView
          initialTransactions={initialTransactions}
          initialAccountId={1}
        />
      </section>
    </div>
  );
}
