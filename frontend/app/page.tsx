// frontend/app/page.tsx
import { fetchTransactions } from "@/lib/serverApi";
import { UploadForm } from "@/components/UploadForm";
import { TransactionsView } from "@/components/TransactionsView";

export default async function HomePage() {
  const initialTransactions = await fetchTransactions();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Moje transakcje</h1>
          <p className="text-sm text-slate-400">
            Wgraj wyciąg PDF z PKO i przeglądaj swoje operacje z
            możliwością filtrowania.
          </p>
        </header>

        {/* Sekcja uploadu PDF */}
        <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
          <h2 className="text-sm font-medium mb-3 text-slate-200">
            Importuj wyciąg PDF
          </h2>
          <UploadForm />
        </section>

        {/* Filtry + dashboard + tabela */}
        <section>
          <TransactionsView
            initialTransactions={initialTransactions}
            initialAccountId={1} // na razie konto 1, później dropdown
          />
        </section>
      </div>
    </main>
  );
}
