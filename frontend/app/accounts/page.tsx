// frontend/app/accounts/page.tsx
export default function AccountsPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-slate-400">
          Przegląd kont, wyciągów i importów. Na razie jedno konto, ale
          struktura przygotowana na więcej.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
          <h2 className="text-sm font-medium mb-2 text-slate-200">
            Moje konta
          </h2>
          <p className="text-sm text-slate-400">
            Tutaj pokażemy listę kont z backendu (np. Główne konto PKO,
            oszczędnościowe itd.).
          </p>
        </section>

        <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
          <h2 className="text-sm font-medium mb-2 text-slate-200">
            Importy / wyciągi
          </h2>
          <p className="text-sm text-slate-400">
            Tutaj trafi log importów: które pliki PDF zostały wczytane, ile
            wierszy, ile błędnych, statusy.
          </p>
        </section>
      </div>
    </div>
  );
}
