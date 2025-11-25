// frontend/app/flow/page.tsx
import { fetchTransactions, fetchUserProfile } from "@/lib/serverApi";
import { UploadForm } from "@/components/UploadForm";
import { TransactionsView } from "@/components/TransactionsView";

export default async function FlowPage() {
  const [initialTransactions, profile] = await Promise.all([
    fetchTransactions(),
    fetchUserProfile(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Flow</h1>
        <p className="text-sm text-slate-400">
          Szczegółowy widok przepływów: import wyciągów, filtry, wykresy i
          pełna lista transakcji.
        </p>
      </header>

      {/* Import PDF przeniesiony z Dashboardu */}
      <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
        <h2 className="text-sm font-medium mb-3 text-slate-200">
          Importuj wyciąg PDF
        </h2>
        <UploadForm />
      </section>

      {/* Zaawansowany widok: filtry + mini-dash + wykres + tabela */}
      <section>
        <TransactionsView
          initialTransactions={initialTransactions}
          initialAccountId={1}
          initialRange={profile.default_range as any}
          initialGranularity={profile.default_granularity as any}
        />
      </section>
    </div>
  );
}
