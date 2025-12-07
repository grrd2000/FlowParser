"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  Transaction,
  fetchTransactions,
  fetchCategories,
  updateTransactionCategory,
  Category,
} from "@/lib/serverApi";

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

  const [detailTx, setDetailTx] = useState<TxExt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);


  // 1) Ładowanie wszystkich transakcji (jak na dashboardzie)
  useEffect(() => {
    const load = async () => {
      try {
        const [txs, cats] = await Promise.all([
          fetchTransactions(),
          fetchCategories(),
        ]);
        setTransactions(normalizeTransactions(txs));
        setCategories(cats);
      } catch (e) {
        console.error(e);
      }
    };
    load();
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

const handleRowClick = (tx: TxExt) => {
  // nic jeszcze nie było otwarte
  if (!detailTx) {
    setDetailTx(tx);
    setDetailOpen(true);
    return;
  }

  // kliknięcie w ten sam rekord -> zamykamy z animacją
  if (detailTx.id === tx.id) {
    setDetailOpen(false);
    setTimeout(() => {
      setDetailTx(null);
    }, 300); // tyle samo co duration w animacji
    return;
  }

  // kliknięcie w inny rekord -> po prostu zmieniamy zawartość, panel zostaje otwarty
  setDetailTx(tx);
  setDetailOpen(true);
};

const handleChangeCategory = async (txId: number, categoryId: number | null) => {
  try {
    const updated = await updateTransactionCategory(txId, categoryId);

    // podbijamy stan tabeli
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === txId
          ? {
              ...tx,
              category: updated.category,
              category_id: updated.category_id,
              category_source: updated.category_source,
            }
          : tx
      )
    );

    // jeśli panel pokazuje tę transakcję – też go odśwież
    setDetailTx((prev) =>
      prev && prev.id === txId
        ? {
            ...prev,
            category: updated.category,
            category_id: updated.category_id,
            category_source: updated.category_source,
          }
        : prev
    );
  } catch (e) {
    console.error(e);
    // tu możesz kiedyś dorzucić toast z błędem
  }
};


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

        {/* DÓŁ – TABELA TRANSAKCJI + PANEL SZCZEGÓŁÓW */}
        <section className="glass-card glass-card-hover-soft p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
            <div>
            <h2 className="text-sm font-semibold text-slate-50">
                Transakcje
            </h2>
            <p className="text-[11px] text-slate-400">
                Wynik działania wszystkich filtrów. Po kliknięciu w wiersz po prawej
                stronie pokazują się szczegóły wybranej transakcji.
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


<div className="mt-3 flex flex-col lg:flex-row gap-4 items-stretch">
  {/* LEWO: tabela – rozsuwa się poziomo, ale dokładnie do reszty miejsca */}
  <div
    className="min-w-0 transition-[flex-basis] duration-300 ease-in-out"
    style={{
      flexBasis: detailOpen ? "calc(100% - 320px)" : "100%",
      flexGrow: 1,
      flexShrink: 1,
    }}
  >
    <TransactionsTable
      transactions={filtered}
      loading={loading}
      onRowClick={handleRowClick}
      selectedId={detailOpen && detailTx ? detailTx.id : null}
    />
  </div>

  {/* PRAWO: slot na panel – dokładnie 320px, zero „luzu” po prawej */}
  <div
    className="overflow-hidden transition-[flex-basis] duration-300 ease-in-out flex-shrink-0"
    style={{
      flexBasis: detailOpen ? "320px" : "0px",
    }}
  >
    <div className="h-full flex justify-start">
      {detailTx && (
          <TransactionSideDetails
          transaction={detailTx}
          open={detailOpen}
          categories={categories}
          onChangeCategory={handleChangeCategory}
        />
      )}
    </div>
  </div>
</div>







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
    cell: ({ row }) => {
      const desc = (row.original.description || "").trim();
      const has = desc.length > 0;
      return (
        <span
          className={[
            "truncate max-w-[260px] block",
            has ? "text-slate-100" : "text-slate-600",
          ].join(" ")}
        >
          {has ? desc : "—"}
        </span>
      );
    },
  },

  {
    id: "category",
    accessorKey: "category",
    header: () => "Kategoria",
    cell: ({ row }) => {
      const cat = (row.original.category || "").trim();
      const has = cat.length > 0;
      return (
        <span
          className={[
            "whitespace-nowrap",
            has ? "text-slate-400" : "text-slate-600",
          ].join(" ")}
        >
          {has ? cat : "—"}
        </span>
      );
    },
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
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap text-indigo-300/90"
      >
        {row.original.is_manual ? "MANUAL" : "PDF"}
      </span>
    ),
  },


  {
    id: "account_id",
    header: () => "ID konta",
    cell: ({ row }) => (
      <span className="text-slate-500 whitespace-nowrap">
        {row.original.account_id}
      </span>
    ),
  },
];

function TransactionsTable({
  transactions,
  loading,
  onRowClick,
  selectedId,
}: {
  transactions: TxExt[];
  loading: boolean;
  onRowClick: (tx: TxExt) => void;
  selectedId: number | null;
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

  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

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
        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
        <span className="text-slate-400 mr-1 whitespace-nowrap">
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
        <table className="min-w-full table-fixed text-[11px] text-left">
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
                        "px-3 py-2 font-medium text-slate-300 whitespace-nowrap",
                        canSort ? "cursor-pointer select-none hover:text-slate-100" : "",
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
  {pageRows.map((row) => {
    const tx = row.original;
    const isSelected = selectedId === tx.id;
    const visibleCells = row.getVisibleCells();

    return (
      <tr
        key={row.id}
        onClick={() => onRowClick(tx)}
        className={[
          "border-t border-slate-800/60 transition-colors cursor-pointer",
          isSelected ? "bg-slate-900/80" : "hover:bg-slate-900/60",
        ].join(" ")}
      >
        {visibleCells.map((cell) => (
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
    );
  })}
</tbody>


        </table>
      </div>
    </div>
  );
}





function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function ExpandedTransactionDetails({ tx }: { tx: TxExt }) {
  const positive = tx.amountNum >= 0;

  const operationDate = formatDateDisplay(tx.date);
  const valueDate =
    tx.value_date &&
    !Number.isNaN(new Date(tx.value_date as any).getTime())
      ? formatDateDisplay(new Date(tx.value_date as any))
      : "—";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 md:px-4 md:py-3 space-y-3">
      {/* top: description + amount */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400">
            {tx.category ?? "Bez kategorii"}
          </div>
          <div className="text-[12px] md:text-[13px] font-medium text-slate-50 leading-snug">
            {tx.description}
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          <span
            className={[
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              positive
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-rose-400/60 bg-rose-500/10 text-rose-200",
            ].join(" ")}
          >
            {formatCurrency(tx.amountNum)}
          </span>
          <span className="text-[11px] text-slate-500">
            {positive ? "Wpływ" : "Wydatek"} · ID: {tx.id}
          </span>
        </div>
      </div>

      {/* meta grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] md:text-[11px]">
        <MetaCell label="Data operacji" value={operationDate} />
        <MetaCell label="Data waluty" value={valueDate} />
        <MetaCell
          label="Źródło"
          value={tx.is_manual ? "Ręczna" : "Import PDF"}
        />
        <MetaCell
          label="ID konta"
          value={String(tx.account_id)}
        />
      </div>

      {/* pełny opis (na razie ten sam, ale w przyszłości raw / AI-notes) */}
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500">
          Pełny opis
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-200 whitespace-pre-wrap">
          {tx.description}
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}

/* ---------- BOCZNA KARTA SZCZEGÓŁÓW ---------- */

function TransactionSideDetails({
  transaction,
  open,
  categories,
  onChangeCategory,
}: {
  transaction: TxExt;
  open: boolean;
  categories: Category[];
  onChangeCategory: (txId: number, categoryId: number | null) => void;
}) {
  const positive = transaction.amountNum >= 0;
  const operationDate = formatDateDisplay(transaction.date);
  const valueDate =
    transaction.value_date &&
    !Number.isNaN(new Date(transaction.value_date as any).getTime())
      ? formatDateDisplay(new Date(transaction.value_date as any))
      : "—";

  const desc = (transaction.description || "").trim();
  const hasDesc = desc.length > 0;

  return (
    <aside
      className={[
        // stała szerokość, żeby treść się nie wrappowała przy animacji
        "min-w-[320px] max-w-[320px]",
        "h-full flex flex-col rounded-2xl border border-white/10 bg-slate-950/70",
        "px-3 py-3 md:px-4 md:py-4",
        "text-[11px]",
        // mirror animacji: fade-in / fade-out spójny z rozsuwaniem
        "transition-opacity duration-300 ease-in-out",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {/* nagłówek */}
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
          Szczegóły transakcji
        </div>
        <div
          className={[
            "mt-1 text-sm font-semibold leading-snug line-clamp-3",
            hasDesc ? "text-slate-50" : "text-slate-600",
          ].join(" ")}
        >
          {hasDesc ? desc : "—"}
        </div>
      </div>

      {/* treść – przewijana wewnątrz, bez zmiany wysokości kontenera przy zwężaniu */}
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
          {/* Kategoria + kwota + źródło kategorii */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-[0.14em]">
              Kategoria
            </div>
            <select
              className="mt-1 w-full rounded-full bg-slate-900/70 border border-slate-700/60 px-3 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/80"
              value={transaction.category_id ?? ""}
              onChange={(e) =>
                onChangeCategory(
                  transaction.id,
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            >
              <option value="">— brak kategorii —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                positive
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-400/60 bg-rose-500/10 text-rose-200",
              ].join(" ")}
            >
              {formatCurrency(transaction.amountNum)}
            </span>

            {transaction.category_source && (
              <span className="text-[9px] uppercase tracking-[0.16em] text-slate-500 whitespace-nowrap">
                źródło:
                <span className="ml-1 text-indigo-300/90">
                  {transaction.category_source}
                </span>
              </span>
            )}

            {!transaction.category_source && (
              <span className="text-[9px] text-slate-600 whitespace-nowrap">
                źródło: — unknown —
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DetailCell label="Data operacji" value={operationDate} />
          <DetailCell label="Data waluty" value={valueDate} />
          <DetailCell
            label="Źródło"
            value={transaction.is_manual ? "Ręczna" : "Import PDF"}
          />
          <DetailCell
            label="Konto (ID)"
            value={String(transaction.account_id)}
          />
        </div>

        <div className="space-y-1">
          <div className="text-slate-500">Pełny opis</div>
          <div
            className={[
              "rounded-2xl border border-white/5 bg-slate-950/80 px-3 py-2 text-[11px]",
              "max-h-32 overflow-auto",
              hasDesc ? "text-slate-200" : "text-slate-600 italic",
            ].join(" ")}
          >
            {hasDesc ? desc : "— brak opisu —"}
          </div>
        </div>
      </div>

      <div className="pt-2 mt-2 border-t border-white/5 text-[10px] text-slate-500">
        W „Lab” rozbudujemy ten panel o sugestie kategorii, podobne transakcje
        i wykryte subskrypcje.
      </div>
    </aside>
  );
}





function DetailCell({ label, value }: { label: string; value: string }) {
  const has = value !== "—";
  return (
    <div className="flex flex-col">
      <span className="text-slate-500 text-[10px]">{label}</span>
      <span className={has ? "text-slate-100" : "text-slate-600"}>{value}</span>
    </div>
  );
}


/* ---------- HELPERS ---------- */

function normalizeTransactions(transactions: Transaction[]): TxExt[] {
  return transactions.map((t) => {
    // 1) próba przez parseDate (Twoja logika)
    let d = parseDate(t.operation_date);

    // 2) fallback – jeśli parseDate zwróci coś dziwnego
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      try {
        // spróbuj natywnego Date – może backend już podaje w ISO (YYYY-MM-DD)
        d = new Date(t.operation_date as any);
      } catch {
        // ostatnia deska ratunku – dzisiaj, żeby nic się nie wywaliło
        d = new Date();
      }
    }

    return {
      ...t,
      amountNum: parseAmount(t.amount as any),
      date: d,
    };
  });
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
