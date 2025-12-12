"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  Transaction,
  RuleSuggestion,
  fetchTransactions,
  fetchCategories,
  updateTransactionCategory,
  Category,
  createCategoryRule,
  applyCategoryRules,
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

type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all";
type TxExt = Transaction & { amountNum: number; date: Date };

export function FlowClient() {
  const [transactions, setTransactions] = useState<TxExt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<RangeKey>("3m");
  const [kind, setKind] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");

  // ✅ trzymamy ID, a nie cały obiekt (żeby panel zawsze brał świeże dane ze stanu)
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ✅ sugestia automatyzacji (wiązana do konkretnej transakcji)
  const [ruleSuggestion, setRuleSuggestion] = useState<
    (RuleSuggestion & { txId: number }) | null
  >(null);

  // ✅ “Nie teraz” – chowamy sugestię tylko dla aktualnie klikniętej transakcji
  const [dismissedSuggestionForTx, setDismissedSuggestionForTx] = useState<
    number | null
  >(null);

  const [enablingSuggestion, setEnablingSuggestion] = useState(false);

  // 1) Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [txs, cats] = await Promise.all([
          fetchTransactions(),
          fetchCategories(),
        ]);
        setTransactions(normalizeTransactions(txs));
        setCategories(cats);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Nie udało się pobrać danych.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 2) Filter + metrics
  const { filtered, startDate, metrics } = useMemo(() => {
    const { filtered, startDate } = filterByRange(transactions, range);

    const afterKind = filtered.filter((t) => {
      if (kind === "income") return t.amountNum >= 0;
      if (kind === "expense") return t.amountNum < 0;
      return true;
    });

    const q = normalizeQuery(search);
    const afterSearch =
      q.length === 0
        ? afterKind
        : afterKind.filter((t) => normalizeQuery(t.description ?? "").includes(q));

    const metrics = computeMetrics(afterSearch);

    return { filtered: afterSearch, startDate, metrics };
  }, [transactions, range, kind, search]);

  // ✅ zaznaczona transakcja zawsze z aktualnego stanu
  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null;
    return transactions.find((t) => t.id === selectedTxId) ?? null;
  }, [transactions, selectedTxId]);

  // ✅ jeśli przez filtry zaznaczony rekord wypadnie z widoku – zamykamy panel
  useEffect(() => {
    if (!selectedTxId) return;
    const stillVisible = filtered.some((t) => t.id === selectedTxId);
    if (!stillVisible) {
      setDetailOpen(false);
      window.setTimeout(() => {
        setSelectedTxId(null);
        setRuleSuggestion(null);
        setDismissedSuggestionForTx(null);
      }, 300);
    }
  }, [filtered, selectedTxId]);

  const handleRowClick = (txId: number) => {
    // nic nie otwarte
    if (!selectedTxId) {
      setSelectedTxId(txId);
      setDetailOpen(true);
      setRuleSuggestion(null);
      setDismissedSuggestionForTx(null);
      return;
    }

    // klik w ten sam → zamknij z animacją
    if (selectedTxId === txId) {
      setDetailOpen(false);
      window.setTimeout(() => {
        setSelectedTxId(null);
        setRuleSuggestion(null);
        setDismissedSuggestionForTx(null);
      }, 300);
      return;
    }

    // klik w inny → przełącz rekord, panel zostaje otwarty
    setSelectedTxId(txId);
    setDetailOpen(true);
    setRuleSuggestion(null);
    setDismissedSuggestionForTx(null);
  };

  const handleChangeCategory = async (txId: number, categoryId: number | null) => {
    try {
      const { transaction: updated, rule_suggestion } =
        await updateTransactionCategory(txId, categoryId);

      // ✅ aktualizacja “in place” (nie resetuje tabeli)
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? { ...tx, ...updated } : tx))
      );

      // ✅ sugestia automatyzacji po ręcznej decyzji usera
      if (rule_suggestion) {
        setRuleSuggestion({ txId, ...rule_suggestion });
        setDismissedSuggestionForTx(null);
      } else {
        setRuleSuggestion(null);
        setDismissedSuggestionForTx(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptRuleSuggestion = async () => {
    if (!ruleSuggestion) return;

    setEnablingSuggestion(true);
    try {
      // tworzymy regułę w tle (user widzi tylko “automatyzację”)
      await createCategoryRule({
        category_id: ruleSuggestion.category_id,
        pattern_value: ruleSuggestion.pattern_value,
        pattern_type: ruleSuggestion.pattern_type,
        field: "description",
      });

      // stosujemy reguły do istniejących danych
      await applyCategoryRules();

      // refresh danych (tabela nie powinna resetować paginacji bo autoResetPageIndex=false)
      const [txs, cats] = await Promise.all([
        fetchTransactions(),
        fetchCategories(),
      ]);
      setTransactions(normalizeTransactions(txs));
      setCategories(cats);

      setRuleSuggestion(null);
      setDismissedSuggestionForTx(null);
    } catch (e) {
      console.error(e);
    } finally {
      setEnablingSuggestion(false);
    }
  };

  const handleDismissRuleSuggestion = () => {
    if (ruleSuggestion?.txId) setDismissedSuggestionForTx(ruleSuggestion.txId);
    setRuleSuggestion(null);
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

        {/* PRAWY OBSZAR – KPI + TABELA */}
        <div className="space-y-4">
          {/* KPI */}
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Liczba transakcji"
              value={loading ? "—" : filtered.length.toLocaleString("pl-PL")}
              subtitle="W wybranym zakresie i filtrach"
            />
            <KpiCard
              label="Wydatki"
              value={loading ? "—" : formatCurrency(-Math.min(metrics.expense, 0))}
              subtitle="Suma ujemnych przepływów"
            />
            <KpiCard
              label="Wpływy"
              value={loading ? "—" : formatCurrency(Math.max(metrics.income, 0))}
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

          {/* DÓŁ – TABELA + SZCZEGÓŁY */}
          <section className="glass-card glass-card-hover-soft p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">Transakcje</h2>
                <p className="text-[11px] text-slate-400">
                  Po kliknięciu w wiersz po prawej stronie pokazują się szczegóły.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 text-right">
                Zakres:{" "}
                <span className="text-slate-200 font-medium">{rangeText}</span>
                <br />
                Wyświetlane:{" "}
                <span className="text-slate-200 font-medium">{filtered.length}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-col lg:flex-row gap-4 items-stretch">
              {/* LEWO: tabela */}
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
                  onRowClick={(tx) => handleRowClick(tx.id)}
                  selectedId={detailOpen && selectedTxId ? selectedTxId : null}
                />
              </div>

              {/* PRAWO: panel */}
              <div
                className="overflow-hidden transition-[flex-basis] duration-300 ease-in-out flex-shrink-0"
                style={{ flexBasis: detailOpen ? "320px" : "0px" }}
              >
                <div className="h-full flex justify-start">
                  {selectedTx && (
                    <TransactionSideDetails
                      open={detailOpen}
                      transaction={selectedTx}
                      categories={categories}
                      onChangeCategory={handleChangeCategory}
                      enablingSuggestion={enablingSuggestion}
                      ruleSuggestion={
                        ruleSuggestion &&
                        ruleSuggestion.txId === selectedTx.id &&
                        dismissedSuggestionForTx !== selectedTx.id
                          ? ruleSuggestion
                          : null
                      }
                      onAcceptRuleSuggestion={handleAcceptRuleSuggestion}
                      onDismissRuleSuggestion={handleDismissRuleSuggestion}
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

/* ---------- LEWY PANEL ---------- */

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
          Panel filtrów – będziemy go rozbudowywać o konta, kategorie i presety.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium text-slate-300">Typ przepływu</div>
        <div className="flex flex-wrap gap-1">
          <ChipButton active={kind === "all"} onClick={() => onKindChange("all")}>
            Wszystkie
          </ChipButton>
          <ChipButton active={kind === "income"} onClick={() => onKindChange("income")}>
            Wpływy
          </ChipButton>
          <ChipButton active={kind === "expense"} onClick={() => onKindChange("expense")}>
            Wydatki
          </ChipButton>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium text-slate-300">Presety zakresów</div>
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

/* ---------- KPI ---------- */

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
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-2 text-xl font-semibold text-slate-50">{value}</div>
      </div>
      <div className="mt-3 text-[11px] text-slate-500">{subtitle}</div>
    </div>
  );
}

/* ---------- TABLE ---------- */

const transactionColumns: ColumnDef<TxExt>[] = [
  {
    id: "date",
    accessorKey: "date",
    header: () => "Data",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-slate-300">
        {formatDateDisplay(row.original.date)}
      </span>
    ),
    sortingFn: (a, b) => a.original.date.getTime() - b.original.date.getTime(),
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
        <span className={has ? "text-slate-400 whitespace-nowrap" : "text-slate-600 whitespace-nowrap"}>
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
      return (
        <span
          className={[
            "font-medium whitespace-nowrap",
            val >= 0 ? "text-emerald-300" : "text-rose-300",
          ].join(" ")}
        >
          {formatCurrency(val)}
        </span>
      );
    },
    sortingFn: (a, b) => a.original.amountNum - b.original.amountNum,
  },
  {
    id: "value_date",
    header: () => "Data waluty",
    cell: ({ row }) => {
      const raw = row.original.value_date as any;
      if (!raw) return <span className="text-slate-500">—</span>;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return <span className="text-slate-500">—</span>;
      return (
        <span className="whitespace-nowrap text-slate-400">{formatDateDisplay(d)}</span>
      );
    },
  },
  {
    id: "is_manual",
    header: () => "Źródło",
    cell: ({ row }) => (
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap text-indigo-300/90">
        {row.original.is_manual ? "MANUAL" : "PDF"}
      </span>
    ),
  },
  {
    id: "account_id",
    header: () => "ID konta",
    cell: ({ row }) => (
      <span className="text-slate-500 whitespace-nowrap">{row.original.account_id}</span>
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
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
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
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    autoResetSorting: false,
    autoResetFilters: false,
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

  const allColumns = table.getAllLeafColumns().filter((col) => col.id !== "_selector");
  const pageRows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-[11px]">
        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
          <span className="text-slate-400 mr-1 whitespace-nowrap">Widoczne kolumny:</span>
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
            <span className="text-slate-100">{table.getState().pagination.pageIndex + 1}</span>{" "}
            z{" "}
            <span className="text-slate-100">{table.getPageCount() || 1}</span>
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
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={[
                        "px-3 py-2 font-medium text-slate-300 whitespace-nowrap",
                        canSort ? "cursor-pointer select-none hover:text-slate-100" : "",
                        header.column.id === "amount" || header.column.id === "is_manual"
                          ? "text-right"
                          : "text-left",
                      ].join(" ")}
                    >
                      <div className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDir === "asc" && <span className="text-[9px] text-slate-400">▲</span>}
                        {sortDir === "desc" && <span className="text-[9px] text-slate-400">▼</span>}
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
                        cell.column.id === "amount" || cell.column.id === "is_manual"
                          ? "text-right"
                          : "text-left",
                      ].join(" ")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

/* ---------- DETAILS PANEL ---------- */

function TransactionSideDetails({
  open,
  transaction,
  categories,
  onChangeCategory,
  ruleSuggestion,
  enablingSuggestion,
  onAcceptRuleSuggestion,
  onDismissRuleSuggestion,
}: {
  open: boolean;
  transaction: TxExt;
  categories: Category[];
  onChangeCategory: (txId: number, categoryId: number | null) => void;
  ruleSuggestion: (RuleSuggestion & { txId: number }) | null;
  enablingSuggestion: boolean;
  onAcceptRuleSuggestion: () => void;
  onDismissRuleSuggestion: () => void;
}) {
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
        "min-w-[320px] max-w-[320px]",
        "h-full flex flex-col rounded-2xl border border-white/10 bg-slate-950/70",
        "px-3 py-3 md:px-4 md:py-4",
        "text-[11px]",
        "transition-opacity duration-300 ease-in-out",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
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

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-[0.14em]">
              Kategoria
            </div>

            <select
              className="
                mt-1 w-full rounded-full bg-slate-900/70 border border-slate-700/60
                px-3 py-1 text-[11px] text-slate-100 focus:outline-none
                focus:ring-1 focus:ring-indigo-400/80
              "
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
                transaction.amountNum >= 0
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-400/60 bg-rose-500/10 text-rose-200",
              ].join(" ")}
            >
              {formatCurrency(transaction.amountNum)}
            </span>

            {transaction.category_source ? (
              <span className="text-[9px] uppercase tracking-[0.16em] text-slate-500 whitespace-nowrap">
                źródło:
                <span className="ml-1 text-indigo-300/90">
                  {transaction.category_source}
                </span>
              </span>
            ) : (
              <span className="text-[9px] text-slate-600 whitespace-nowrap">
                źródło: —
              </span>
            )}
          </div>
        </div>

        {/* ✅ Dyskretna “automatyzacja podobnych” (bez słowa "reguła" w UX) */}
        {ruleSuggestion && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-100 font-medium flex items-center gap-1.5">
                <span className="text-[12px]">✨</span>
                Automatyzacja podobnych
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                Często pojawia się{" "}
                <span className="text-indigo-200 font-semibold">
                  {ruleSuggestion.pattern_value}
                </span>
                . Chcesz automatycznie przypisać tę kategorię do podobnych transakcji
                ({ruleSuggestion.similar_count})?
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              <button
                onClick={onAcceptRuleSuggestion}
                disabled={enablingSuggestion}
                className="
                  rounded-full border border-indigo-400/60 bg-indigo-500/20
                  px-3 py-1 text-[11px] font-medium text-indigo-100
                  hover:bg-indigo-500/30 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {enablingSuggestion ? "Włączanie…" : "Włącz"}
              </button>
              <button
                onClick={onDismissRuleSuggestion}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                type="button"
              >
                Nie teraz
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <DetailCell label="Data operacji" value={operationDate} />
          <DetailCell label="Data waluty" value={valueDate} />
          <DetailCell label="Źródło" value={transaction.is_manual ? "Ręczna" : "Import PDF"} />
          <DetailCell label="Konto (ID)" value={String(transaction.account_id)} />
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
            {hasDesc ? desc : "—"}
          </div>
        </div>
      </div>

      <div className="pt-2 mt-2 border-t border-white/5 text-[10px] text-slate-500">
        Ten panel będzie się dalej “inteligentnie” rozbudowywał w Lab (podpowiedzi, podobne transakcje, subskrypcje).
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
    let d = parseDate(t.operation_date);

    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      try {
        d = new Date(t.operation_date as any);
      } catch {
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
  const cleaned = raw.replace(/\s/g, "").replace("PLN", "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string | null | undefined): Date {
  if (!raw) return new Date(NaN);
  return new Date(raw);
}

function filterByRange(data: TxExt[], range: RangeKey) {
  if (data.length === 0) {
    return { filtered: [] as TxExt[], startDate: null as Date | null };
  }
  const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
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

// 🧠 human-friendly normalize: lower + remove Polish diacritics + trim spaces
function normalizeQuery(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
