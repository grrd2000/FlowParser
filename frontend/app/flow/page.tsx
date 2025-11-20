// frontend/app/flow/page.tsx

export default function FlowPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Flow</h1>
        <p className="text-sm text-slate-400">
          Przepływy pieniędzy w czasie – docelowo zaawansowane wykresy i
          analityka cashflow.
        </p>
      </header>

      <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 text-sm text-slate-300">
        <p>
          Na razie to placeholder. Później przeniesiemy tutaj dodatkowe
          wykresy (np. przychody vs wydatki, trendy, rolling averages,
          scenariusze itp.).
        </p>
      </div>
    </div>
  );
}
