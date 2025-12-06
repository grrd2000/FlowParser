"use client";

import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@/lib/serverApi";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all";
type TxExt = Transaction & { amountNum: number; date: Date };

export function FlowClient() {
  const [transactions, setTransactions] = useState<TxExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<RangeKey>("3m");
  const [kind, setKind] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");

  // 1) Ładowanie wszystkich transakcji (jak na dashboardzie)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/transactions`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const raw: Transaction[] = await res.json();
        const parsed = normalizeTransactions(raw);
        setTransactions(parsed);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Błąd podczas ładowania transakcji.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 2) Przetwarzanie wg zakresu, typu (income/expense/all) i wyszukiwarki
  const { filtered, startDate, metrics } = useMemo(() => {
    const { filtered, startDate } = filterByRange(transactions, range);

    const afterKind = filtered.filter((t) => {
      if (kind === "income") return t.amountNum >= 0;
      if (kind === "expense") return t.amountNum < 0;
      return true;
    });

    const q = search.trim().toLowerCase();
    const afterSearch =
      q.length === 0
        ? afterKind
        : afterKind.filter((t) =>
            t.description?.toLowerCase().includes(q)
          );

    const metrics = computeMetrics(afterSearch);

    return { filtered: afterSearch, startDate, metrics };
  }, [transactions, range, kind, search]);

  const rangeText = rangeLabel(range, startDate);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
          Flow
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Laboratorium Twoich przepływów. Filtruj, eksploruj, grupuj transakcje
          i baw się kategoriami. Wszystko, co dzieje się na Twoich kontach –
          w jednym workspace.
        </p>
      </section>

      {error && (
        <div className="glass-card border-rose-500/60 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      )}

      {/* GŁÓWNY LAYOUT: LEWY PANEL + PRAWY WORKSPACE */}
      <section className="grid gap-4 lg:grid-cols-[260px,minmax(0,1fr)]">
        {/* LEWY PANEL – FILTRY / PRESETY */}
        <FlowSidebar
          range={range}
          onRangeChange={setRange}
          kind={kind}
          onKindChange={setKind}
        />

        {/* PRAWY OBSZAR – KPI + PANEL „EXPERIMENTS” + TABELA */}
        <div className="space-y-4">
          {/* GÓRNE KPI + ZAKRES */}
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Liczba transakcji"
              value={
                loading ? "—" : filtered.length.toLocaleString("pl-PL")
              }
              subtitle="W wybranym zakresie i filtrach"
            />
            <KpiCard
              label="Wydatki"
              value={
                loading ? "—" : formatCurrency(-Math.min(metrics.expense, 0))
              }
              subtitle="Suma ujemnych przepływów"
            />
            <KpiCard
              label="Wpływy"
              value={
                loading ? "—" : formatCurrency(Math.max(metrics.income, 0))
              }
              subtitle="Suma dodatnich przepływów"
            />
          </section>

          {/* RANGE + SEARCH */}
          <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-1 py-1 shadow-inner shadow-black/30">
              {(["1m", "3m", "6m", "ytd", "all"] as RangeKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={[
                    "px-3 py-1 text-[11px] rounded-full font-medium transition-all border",
                    range === key
                      ? "bg-white/80 text-slate-900 border-white shadow-md shadow-white/40"
                      : "bg-white/0 text-slate-100/80 border-transparent hover:bg-white/15 hover:text-white",
                  ].join(" ")}
                >
                  {rangeLabelShort(key)}
                </button>
              ))}
            </div>
            <div className="flex-1 flex justify-end">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj w opisie..."
                className="w-full md:w-64 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400/70 focus:ring-1 focus:ring-indigo-400/50"
              />
            </div>
          </section>

          {/* „EXPERIMENTS / SUMMARY” – miejsce na wykresy w kolejnych krokach */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card glass-card-hover-soft p-4 md:p-5">
              <h2 className="text-sm font-semibold text-slate-50 mb-2">
                Podsumowanie przepływów
              </h2>
              <p className="text-[11px] text-slate-400 mb-3">
                Szybkie liczby dla aktualnych filtrów. W kolejnych krokach
                dorzucimy tu wykresy porównawcze, rozkład kategorii i
                eksperymenty analityczne.
              </p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <SummaryRow
                  label="Średnia kwota transakcji"
                  value={
                    loading
                      ? "—"
                      : filtered.length === 0
                      ? "—"
                      : formatCurrency(
                          metrics.sum / Math.max(filtered.length, 1)
                        )
                  }
                />
                <SummaryRow
                  label="Średni wydatek"
                  value={
                    loading || metrics.expense === 0
                      ? "—"
                      : formatCurrency(
                          metrics.expense / metrics.expenseCount
                        )
                  }
                />
                <SummaryRow
                  label="Średni wpływ"
                  value={
                    loading || metrics.income === 0
                      ? "—"
                      : formatCurrency(
                          metrics.income / metrics.incomeCount
                        )
                  }
                />
                <SummaryRow
                  label="Balance netto"
                  value={loading ? "—" : formatCurrency(metrics.net)}
                />
              </div>
            </div>

            <div className="glass-card glass-card-hover-soft p-4 md:p-5">
              <h2 className="text-sm font-semibold text-slate-50 mb-2">
                Przestrzeń eksperymentów
              </h2>
              <p className="text-[11px] text-slate-400 mb-3">
                Tutaj dorzucimy zaawansowane widoki: segmentację kategorii,
                porównanie okresów, rozkład według kont oraz eksperymenty
                z modelami ML. Na razie traktuj to jako miejsce na przyszłe
                klocki.
              </p>
              <ul className="text-[11px] text-slate-300 space-y-1">
                <li>• Wykrywanie subskrypcji</li>
                <li>• Grupowanie podobnych transakcji</li>
                <li>• Personalizowane presety filtrów</li>
              </ul>
            </div>
          </section>

          {/* DÓŁ – TABELA TRANSAKCJI */}
          <section className="glass-card glass-card-hover-soft p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Transakcje
                </h2>
                <p className="text-[11px] text-slate-400">
                  Wynik działania wszystkich filtrów. To tutaj będziemy
                  dodawali grupowanie, edycję kategorii i zaawansowane
                  operacje.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 text-right">
                Zakres:{" "}
                <span className="text-slate-200 font-medium">
                  {rangeText}
                </span>
                <br />
                Wyświetlane:{" "}
                <span className="text-slate-200 font-medium">
                  {filtered.length}
                </span>
              </div>
            </div>

            <TransactionsTable transactions={filtered} loading={loading} />
          </section>
        </div>
      </section>
    </div>
  );
}

/* ---------- LEWY PANEL: SIDEBAR FLOW ---------- */

function FlowSidebar({
  range,
  onRangeChange,
  kind,
  onKindChange,
}: {
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  kind: "all" | "income" | "expense";
  onKindChange: (k: "all" | "income" | "expense") => void;
}) {
  return (
    <aside className="glass-card p-4 space-y-4 h-fit">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Filtry
        </div>
        <p className="text-[11px] text-slate-500">
          To jest panel filtrów – będziemy go rozbudowywać o konta, kategorie
          i presety.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium text-slate-300">
          Typ przepływu
        </div>
        <div className="flex flex-wrap gap-1">
          <ChipButton
            active={kind === "all"}
            onClick={() => onKindChange("all")}
          >
            Wszystkie
          </ChipButton>
          <ChipButton
            active={kind === "income"}
            onClick={() => onKindChange("income")}
          >
            Wpływy
          </ChipButton>
          <ChipButton
            active={kind === "expense"}
            onClick={() => onKindChange("expense")}
          >
            Wydatki
          </ChipButton>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium text-slate-300">
          Presety zakresów
        </div>
        <div className="grid grid-cols-3 gap-1 text-[11px]">
          {(["1m", "3m", "6m", "ytd", "all"] as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onRangeChange(key)}
              className={[
                "rounded-full px-2 py-1 border transition-all",
                range === key
                  ? "bg-white/80 text-slate-900 border-white"
                  : "bg-white/0 text-slate-300 border-white/10 hover:bg-white/10",
              ].join(" ")}
            >
              {rangeLabelShort(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3 text-[11px] text-slate-500">
        W kolejnych etapach:
        <ul className="mt-1 space-y-0.5 list-disc list-inside">
          <li>Filtry po koncie</li>
          <li>Filtry po kategorii</li>
          <li>Zapisywanie presetów</li>
        </ul>
      </div>
    </aside>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-[11px] border transition-all",
        active
          ? "bg-white/80 text-slate-900 border-white shadow-md shadow-white/40"
          : "bg-white/0 text-slate-300 border-white/10 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ---------- KPI / SUMMARY / TABLE ---------- */

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="glass-card glass-card-hover-strong p-4 flex flex-col justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="mt-2 text-xl font-semibold text-slate-50">
          {value}
        </div>
      </div>
      <div className="mt-3 text-[11px] text-slate-500">{subtitle}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}

/* ---------- TRANSAKCYJNA TABELA – TANSTACK ---------- */

const transactionColumns: ColumnDef<TxExt>[] = [
  {
    id: "date",
    accessorKey: "date",
    header: () => "Data",
    cell: ({ row }) => {
      const d = row.original.date;
      return (
        <span className="whitespace-nowrap text-slate-300">
          {formatDateDisplay(d)}
        </span>
      );
    },
    sortingFn: (a, b) =>
      a.original.date.getTime() - b.original.date.getTime(),
  },
  {
    id: "description",
    accessorKey: "description",
    header: () => "Opis",
    cell: ({ row }) => (
      <span className="text-slate-100 truncate max-w-[260px] block">
        {row.original.description}
      </span>
    ),
  },
  {
    id: "category",
    accessorKey: "category",
    header: () => "Kategoria",
    cell: ({ row }) => (
      <span className="text-slate-400 whitespace-nowrap">
        {row.original.category ?? "—"}
      </span>
    ),
  },
  {
    id: "amount",
    accessorKey: "amountNum",
    header: () => "Kwota",
    cell: ({ row }) => {
      const val = row.original.amountNum;
      const positive = val >= 0;
      return (
        <span
          className={[
            "font-medium whitespace-nowrap",
            positive ? "text-emerald-300" : "text-rose-300",
          ].join(" ")}
        >
          {formatCurrency(val)}
        </span>
      );
    },
    sortingFn: (a, b) =>
      a.original.amountNum - b.original.amountNum,
  },
  {
    id: "value_date",
    header: () => "Data waluty",
    cell: ({ row }) => {
      const raw = row.original.value_date as any;
      if (!raw) return <span className="text-slate-500">—</span>;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime()))
        return <span className="text-slate-500">—</span>;
      return (
        <span className="whitespace-nowrap text-slate-400">
          {formatDateDisplay(d)}
        </span>
      );
    },
  },
  {
    id: "is_manual",
    header: () => "Źródło",
    cell: ({ row }) => (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/70 border border-slate-700 text-slate-300">
        {row.original.is_manual ? "Ręczna" : "Import PDF"}
      </span>
    ),
  },
  {
    id: "account_id",
    header: () => "ID konta",
    cell: ({ row }) => (
      <span className="text-slate-500">
        {row.original.account_id}
      </span>
    ),
  },
];

function TransactionsTable({
  transactions,
  loading,
}: {
  transactions: TxExt[];
  loading: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>({
      date: true,
      description: true,
      category: true,
      amount: true,
      value_date: false,
      is_manual: true,
      account_id: false,
    });

  const table = useReactTable({
    data: transactions,
    columns: transactionColumns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center text-[11px] text-slate-500">
        Ładowanie transakcji...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-[11px] text-slate-500">
        Brak transakcji dla aktualnych filtrów.
      </div>
    );
  }

  const allColumns = table
    .getAllLeafColumns()
    .filter((col) => col.id !== "_selector");

  const pageRows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      {/* PANEL KOLUMN + PAGINACJA GÓRA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-[11px]">
        <div className="flex flex-wrap gap-1">
          <span className="text-slate-400 mr-1">
            Widoczne kolumny:
          </span>
          {allColumns.map((column) => (
            <button
              key={column.id}
              type="button"
              onClick={column.getToggleVisibilityHandler()}
              className={[
                "px-2 py-0.5 rounded-full border transition-all",
                column.getIsVisible()
                  ? "bg-white/80 text-slate-900 border-white shadow-sm"
                  : "bg-slate-900/60 text-slate-300 border-slate-600 hover:bg-slate-800",
              ].join(" ")}
            >
              {column.id === "date"
                ? "Data"
                : column.id === "description"
                ? "Opis"
                : column.id === "category"
                ? "Kategoria"
                : column.id === "amount"
                ? "Kwota"
                : column.id === "value_date"
                ? "Data waluty"
                : column.id === "is_manual"
                ? "Źródło"
                : column.id === "account_id"
                ? "ID konta"
                : column.id}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span>
            Strona{" "}
            <span className="text-slate-100">
              {table.getState().pagination.pageIndex + 1}
            </span>{" "}
            z{" "}
            <span className="text-slate-100">
              {table.getPageCount() || 1}
            </span>
          </span>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 rounded-full border border-white/10 bg-slate-900/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 rounded-full border border-white/10 bg-slate-900/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            →
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/40">
        <table className="min-w-full text-[11px] text-left">
          <thead className="bg-slate-900/80 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  if (header.isPlaceholder) return null;
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      className={[
                        "px-3 py-2 font-medium text-slate-300",
                        canSort
                          ? "cursor-pointer select-none hover:text-slate-100"
                          : "",
                        header.column.id === "amount" ||
                        header.column.id === "is_manual"
                          ? "text-right"
                          : "text-left",
                      ].join(" ")}
                    >
                      <div className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sortDir === "asc" && (
                          <span className="text-[9px] text-slate-400">
                            ▲
                          </span>
                        )}
                        {sortDir === "desc" && (
                          <span className="text-[9px] text-slate-400">
                            ▼
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-800/60 hover:bg-slate-900/60 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={[
                      "px-3 py-1.5 align-middle",
                      cell.column.id === "amount" ||
                      cell.column.id === "is_manual"
                        ? "text-right"
                        : "text-left",
                    ].join(" ")}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ---------- HELPERS ---------- */

function normalizeTransactions(transactions: Transaction[]): TxExt[] {
  return transactions
    .map((t) => ({
      ...t,
      amountNum: parseAmount(t.amount as any),
      date: parseDate(t.operation_date),
    }))
    .filter((t) => !Number.isNaN(t.date.getTime()));
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/\s/g, "")
    .replace("PLN", "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string | null | undefined): Date {
  if (!raw) return new Date(NaN);
  const d = new Date(raw);
  return d;
}

function filterByRange(data: TxExt[], range: RangeKey) {
  if (data.length === 0) {
    return { filtered: [] as TxExt[], startDate: null as Date | null };
  }
  const sorted = [...data].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const lastDate = sorted[sorted.length - 1].date;
  const start = computeStartDate(lastDate, range);
  if (!start) {
    return { filtered: sorted, startDate: null as Date | null };
  }
  const filtered = sorted.filter((t) => t.date >= start);
  return { filtered, startDate: start };
}

function computeStartDate(last: Date, range: RangeKey): Date | null {
  const d = new Date(last);
  switch (range) {
    case "1m":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "3m":
      d.setMonth(d.getMonth() - 3);
      return d;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "ytd":
      return new Date(d.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

function computeMetrics(data: TxExt[]) {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const t of data) {
    if (t.amountNum >= 0) {
      income += t.amountNum;
      incomeCount++;
    } else {
      expense += t.amountNum;
      expenseCount++;
    }
  }

  return {
    income,
    expense,
    net: income + expense,
    sum: income + expense,
    incomeCount,
    expenseCount,
  };
}

function rangeLabel(range: RangeKey, startDate: Date | null) {
  if (!startDate) return "całej historii";
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  return `okres od ${startDate.toLocaleDateString("pl-PL", opts)}`;
}

function rangeLabelShort(range: RangeKey) {
  switch (range) {
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    case "6m":
      return "6M";
    case "ytd":
      return "YTD";
    case "all":
      return "ALL";
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateDisplay(d: Date) {
  return d.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
