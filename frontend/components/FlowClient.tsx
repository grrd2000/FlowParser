"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { motion } from "framer-motion";
import Link from "next/link";
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { SignedOutState } from "@/components/SignedOutState";

import {
  Transaction,
  RuleSuggestion,
  fetchTransactions,
  fetchCategories,
  createCategory,
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
type Density = "compact" | "comfortable";
type ExportPayload = { headers: string[]; rows: string[][] };
type TransactionsTableHandle = { getExportPayload: () => ExportPayload | null };
type TransactionColumnId =
  | "date"
  | "description"
  | "category"
  | "amount"
  | "value_date"
  | "is_manual"
  | "account_id";

const columnLabel = (id: TransactionColumnId) =>
  id === "date"
    ? "Data"
    : id === "description"
    ? "Opis"
    : id === "category"
    ? "Kategoria"
    : id === "amount"
    ? "Kwota"
    : id === "value_date"
    ? "Data waluty"
    : id === "is_manual"
    ? "Źródło"
    : "ID konta";

type AutomationBanner = {
  txId: number;
  categoryName?: string | null;
  token: string;
  count: number;
} | null;

export function FlowClient() {
  const { user, authLoading } = useAuth();

  const transactionsTableRef = useRef<TransactionsTableHandle | null>(null);

  const [transactions, setTransactions] = useState<TxExt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ presety dat i filtr typu
  const [range, setRange] = useState<RangeKey>("3m");
  const [kind, setKind] = useState<"all" | "income" | "expense">("all");

  // ✅ nowy panel filtrów
  const [search, setSearch] = useState("");
  const [hideEmptyDescriptions, setHideEmptyDescriptions] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [includeUncategorized, setIncludeUncategorized] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "pdf" | "manual">(
    "all"
  );
  const [amountAbs, setAmountAbs] = useState(true);
  const [amountMin, setAmountMin] = useState<number | null>(null);
  const [amountMax, setAmountMax] = useState<number | null>(null);
  const [density, setDensity] = useState<Density>("compact");

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

  // ✅ dyskretny status po “Włącz” (bez toastów)
  const [automationBanner, setAutomationBanner] = useState<AutomationBanner>(
    null
  );

  const buildExportPayload = useCallback(() => {
    return transactionsTableRef.current?.getExportPayload() ?? null;
  }, []);

  const downloadAsCsv = useCallback(() => {
    const payload = buildExportPayload();
    if (!payload || payload.headers.length === 0) return;

    const escapeCsvValue = (value: string) => {
      const needsQuotes = /[",\n]/.test(value);
      const sanitized = value.replace(/"/g, '""');
      return needsQuotes ? `"${sanitized}"` : sanitized;
    };

    const lines = [payload.headers, ...payload.rows].map((row) =>
      row.map((cell) => escapeCsvValue(cell)).join(",")
    );

    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transakcje_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [buildExportPayload]);

  const downloadAsExcel = useCallback(() => {
    const payload = buildExportPayload();
    if (!payload || payload.headers.length === 0) return;

    const lines = [payload.headers, ...payload.rows].map((row) => row.join("\t"));
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "application/vnd.ms-excel",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transakcje_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [buildExportPayload]);

  // 1) Load data
  useEffect(() => {
    // czekamy aż auth się ustali
    if (authLoading) return;

    // niezalogowany -> nie fetchujemy, tylko pokazujemy ładny empty state
    if (!user) {
      setTransactions([]);
      setCategories([]);
      setError(null);
      setLoading(false);
      return;
    }

    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [txs, cats] = await Promise.all([
          fetchTransactions(),
          fetchCategories(),
        ]);

        if (ignore) return;

        setTransactions(normalizeTransactions(txs));
        setCategories(cats);
      } catch (e: any) {
        if (ignore) return;
        console.error(e);
        setError(e?.message ?? "Nie udało się pobrać danych.");
      } finally {
        if (ignore) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [authLoading, user]);// ✅ domain suwaka kwoty (z całego zbioru; filtr działa dalej po range/kind itd.)
  const amountDomain = useMemo(() => {
    const vals = transactions
      .map((t) => Math.abs(t.amountNum ?? 0))
      .filter((n) => Number.isFinite(n));

    if (vals.length === 0) return { min: 0, max: 0 };

    // odrobina stabilności UI: clamp do “ładnych” liczb
    const min = Math.floor(Math.min(...vals));
    const max = Math.ceil(Math.max(...vals));
    return { min, max };
  }, [transactions]);

  // 2) Filter + metrics
  const { filtered, startDate, metrics } = useMemo(() => {
    // najpierw range
    const { filtered: afterRange, startDate } = filterByRange(transactions, range);

    // potem kind
    const afterKind = afterRange.filter((t) => {
      if (kind === "income") return t.amountNum >= 0;
      if (kind === "expense") return t.amountNum < 0;
      return true;
    });

    // search (normalizowany)
    const q = normalizeQuery(search);
    const afterSearch =
      q.length === 0
        ? afterKind
        : afterKind.filter((t) =>
            normalizeQuery(t.description ?? "").includes(q)
          );

    // ukryj transakcje bez opisu
    const afterDescription = hideEmptyDescriptions
      ? afterSearch.filter((t) => normalizeQuery(t.description ?? "").length > 0)
      : afterSearch;

    // kategorie (multi + brak kategorii)
    const afterCategories = afterDescription.filter((t) => {
      const hasCat = t.category_id != null;

      // brak filtrowania kategorii
      if (selectedCategoryIds.length === 0 && !includeUncategorized) return true;

      // dopasowanie do wybranych
      if (hasCat && selectedCategoryIds.includes(t.category_id!)) return true;

      // “brak kategorii”
      if (!hasCat && includeUncategorized) return true;

      return false;
    });

    // źródło
    const afterSource = afterCategories.filter((t) => {
      if (sourceFilter === "all") return true;
      if (sourceFilter === "manual") return t.is_manual === true;
      if (sourceFilter === "pdf") return t.is_manual === false;
      return true;
    });

    // kwota (range)
    const aMin = amountMin;
    const aMax = amountMax;
    const afterAmount =
      aMin == null && aMax == null
        ? afterSource
        : afterSource.filter((t) => {
            const base = amountAbs ? Math.abs(t.amountNum ?? 0) : (t.amountNum ?? 0);
            if (aMin != null && base < aMin) return false;
            if (aMax != null && base > aMax) return false;
            return true;
          });

    const metrics = computeMetrics(afterAmount);
    return { filtered: afterAmount, startDate, metrics };
  }, [
    transactions,
    range,
    kind,
    search,
    selectedCategoryIds,
    includeUncategorized,
    sourceFilter,
    amountMin,
    amountMax,
    amountAbs,
    hideEmptyDescriptions,
  ]);

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
    if (!selectedTxId) {
      setSelectedTxId(txId);
      setDetailOpen(true);
      setRuleSuggestion(null);
      setDismissedSuggestionForTx(null);
      return;
    }

    if (selectedTxId === txId) {
      setDetailOpen(false);
      window.setTimeout(() => {
        setSelectedTxId(null);
        setRuleSuggestion(null);
        setDismissedSuggestionForTx(null);
      }, 300);
      return;
    }

    setSelectedTxId(txId);
    setDetailOpen(true);
    setRuleSuggestion(null);
    setDismissedSuggestionForTx(null);
  };

  const handleChangeCategory = async (txId: number, categoryId: number | null) => {
    try {
      const { rule_suggestion, ...updated } =
        await updateTransactionCategory(txId, categoryId);

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId
            ? { ...tx, ...normalizeTransactions([updated])[0] }
            : tx
        )
      );

      setAutomationBanner((prev) => (prev?.txId === txId ? null : prev));

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

  const handleCreateCategory = async (payload: {
    name: string;
    color?: string | null;
  }) => {
    const created = await createCategory(payload);
    setCategories((prev) => [...prev, created]);
    return created;
  };

  const handleAcceptRuleSuggestion = async () => {
    if (!ruleSuggestion) return;

    const snap = ruleSuggestion;
    setEnablingSuggestion(true);
    try {
      await createCategoryRule({
        category_id: snap.category_id,
        pattern_value: snap.pattern_value,
        pattern_type: snap.pattern_type,
        field: "description",
      });

      await applyCategoryRules();

      setAutomationBanner({
        txId: snap.txId,
        categoryName: snap.category_name ?? null,
        token: snap.pattern_value,
        count: snap.similar_count,
      });

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

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (normalizeQuery(search).length > 0) n++;
    if (hideEmptyDescriptions) n++;
    if (selectedCategoryIds.length > 0) n++;
    if (includeUncategorized) n++;
    if (sourceFilter !== "all") n++;
    if (amountMin != null || amountMax != null) n++;
    return n;
  }, [
    search,
    hideEmptyDescriptions,
    selectedCategoryIds,
    includeUncategorized,
    sourceFilter,
    amountMin,
    amountMax,
  ]);

  const resetSmartFilters = () => {
    setSearch("");
    setSelectedCategoryIds([]);
    setIncludeUncategorized(false);
    setSourceFilter("all");
    setAmountAbs(true);
    setAmountMin(null);
    setAmountMax(null);
    setHideEmptyDescriptions(false);
    // density zostawiamy – to “preferencja widoku”
  };

  // Signed out state (po hookach)
  if (!authLoading && !user) {
    return (
      <SignedOutState
        title="Flow"
        desc="Zaloguj się, aby analizować transakcje, filtrować dane i przypisywać kategorie."
      />
    );
  }


  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-0 top-12 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <motion.div
          aria-hidden
          className="absolute inset-x-10 top-10 h-24 rounded-3xl bg-gradient-to-r from-white/5 via-white/0 to-white/5"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* HEADER */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/60 p-6 shadow-xl shadow-black/30"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(129,140,248,0.16),transparent_48%),radial-gradient(circle_at_40%_80%,rgba(236,72,153,0.16),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />

        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-200">
              Flow Workspace
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-80" />
                <span className="absolute inset-0 animate-[pulse-ring_5s_ease-in-out_infinite] rounded-full bg-emerald-400/60" />
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
                Minimalistyczny cockpit do sterowania przepływami.
              </h1>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                Zachowaj pełną funkcjonalność analizy, ale w bardziej uporządkowanej przestrzeni. Filtry, automatyzacje i podgląd transakcji są teraz w jednym spójnym, interaktywnym układzie.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/import"
                className="group inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 transition-transform hover:-translate-y-0.5"
              >
                Dodaj nowy wyciąg
                <span className="h-6 w-6 rounded-full bg-slate-900 text-white grid place-items-center text-[10px] transition-transform group-hover:translate-x-0.5">
                  +
                </span>
              </Link>
              <Link
                href="/lab"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-emerald-500/15"
              >
                Eksperymentuj w Labie
              </Link>
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-slate-200">
                Zakres <span className="font-semibold text-white">{rangeText}</span>
                <span className="h-1.5 w-16 rounded-full bg-gradient-to-r from-emerald-400 via-indigo-400 to-pink-400" />
              </div>
            </div>
          </div>

          <div className="glass-card glass-card-hover-soft relative overflow-hidden border-white/5 bg-white/5 p-4">
            <div className="absolute -left-8 top-6 h-28 w-28 rounded-full bg-emerald-500/25 blur-3xl" />
            <div className="absolute -right-10 -bottom-8 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative grid gap-4 text-sm text-slate-100">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Live preview</div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                  {filtered.length.toLocaleString("pl-PL")} rekordów
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Transakcje"
                  value={loading ? "—" : filtered.length.toLocaleString("pl-PL")}
                  subtitle="Widoczne po filtrach"
                  compact
                />
                <KpiCard
                  label="Saldo"
                  value={loading ? "—" : formatCurrency(metrics.net)}
                  subtitle={rangeText}
                  compact
                />
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Puls aktywności
                  <span className="inline-flex items-center gap-1 text-emerald-200">
                    {activeFiltersCount > 0 ? `${activeFiltersCount} filtry` : "Bez filtrów"}
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-slate-200">
                  <div className="h-10 flex-1 rounded-full bg-gradient-to-r from-emerald-400/25 via-indigo-400/20 to-pink-400/20">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-indigo-400 to-pink-400"
                      initial={{ width: "15%" }}
                      animate={{ width: `${Math.min(95, Math.max(12, filtered.length / Math.max(transactions.length || 1, 1) * 100))}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
                    {Math.max(transactions.length, filtered.length).toLocaleString("pl-PL")}
                    <span className="text-slate-400"> obserwowane</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {error && (
        <div className="glass-card border-rose-500/60 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      )}

      {/* GŁÓWNY LAYOUT */}
      <section className="space-y-5">
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

        {/* JEDEN SPÓJNY CARD Z FILTRAMI */}
        <FlowFiltersBar
          range={range}
          setRange={setRange}
          kind={kind}
          setKind={setKind}
          search={search}
          setSearch={setSearch}
          hideEmptyDescriptions={hideEmptyDescriptions}
          setHideEmptyDescriptions={setHideEmptyDescriptions}
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
          setSelectedCategoryIds={setSelectedCategoryIds}
          includeUncategorized={includeUncategorized}
          setIncludeUncategorized={setIncludeUncategorized}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          amountDomain={amountDomain}
          amountAbs={amountAbs}
          setAmountAbs={setAmountAbs}
          amountMin={amountMin}
          amountMax={amountMax}
          setAmountMin={setAmountMin}
          setAmountMax={setAmountMax}
          density={density}
          setDensity={setDensity}
          activeFiltersCount={activeFiltersCount}
          onReset={resetSmartFilters}
        />

        {/* TABELA + SZCZEGÓŁY */}
        <section className="glass-card glass-card-hover-soft overflow-hidden border-white/5 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                Transakcje
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[12px] text-slate-400">
                Hover na opisie pokazuje pełną treść. Kliknij wiersz, aby rozsunąć szczegóły i akceptować automatyzacje.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Zakres: <span className="text-white font-semibold">{rangeText}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Wyświetlane: <span className="text-white font-semibold">{filtered.length}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadAsCsv}
                  className="group relative overflow-hidden rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-500/25 px-4 py-1.5 text-[11px] font-semibold text-emerald-50 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-emerald-400/25"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  Eksport CSV
                </button>
                <button
                  type="button"
                  onClick={downloadAsExcel}
                  className="group relative overflow-hidden rounded-full border border-indigo-400/50 bg-gradient-to-r from-indigo-500/25 via-indigo-400/15 to-indigo-500/25 px-4 py-1.5 text-[11px] font-semibold text-indigo-50 shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:shadow-indigo-400/25"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  Eksport Excel
                </button>
              </div>
            </div>
          </div>

          <Tooltip.Provider delayDuration={180}>
            <div className="mt-2 flex flex-col lg:flex-row gap-4 items-stretch">
              <div
                className="min-w-0 transition-[flex-basis] duration-300 ease-in-out"
                style={{
                  flexBasis: detailOpen ? "calc(100% - 360px)" : "100%",
                  flexGrow: 1,
                  flexShrink: 1,
                }}
              >
                <TransactionsTable
                  transactions={filtered}
                  loading={loading}
                  onRowClick={(tx) => handleRowClick(tx.id)}
                  selectedId={detailOpen && selectedTxId ? selectedTxId : null}
                  density={density}
                  ref={transactionsTableRef}
                />
              </div>

              <div
                className="h-full overflow-hidden transition-[flex-basis] duration-300 ease-in-out flex-shrink-0"
                style={{ flexBasis: detailOpen ? "360px" : "0px" }}
              >
                <div className="flex justify-start h-full">
                  {selectedTx && (
                    <TransactionSideDetails
                      open={detailOpen}
                      transaction={selectedTx}
                      categories={categories}
                      onChangeCategory={handleChangeCategory}
                      onCreateCategory={handleCreateCategory}
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
                      automationBanner={
                        automationBanner && automationBanner.txId === selectedTx.id
                          ? automationBanner
                          : null
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </Tooltip.Provider>
        </section>
      </section>
    </div>
  );
}

/* ---------- FILTER BAR ---------- */

function FlowFiltersBar({
  range,
  setRange,
  kind,
  setKind,

  search,
  setSearch,
  hideEmptyDescriptions,
  setHideEmptyDescriptions,
  categories,
  selectedCategoryIds,
  setSelectedCategoryIds,
  includeUncategorized,
  setIncludeUncategorized,
  sourceFilter,
  setSourceFilter,
  amountDomain,
  amountAbs,
  setAmountAbs,
  amountMin,
  amountMax,
  setAmountMin,
  setAmountMax,
  density,
  setDensity,
  activeFiltersCount,
  onReset,
}: {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  kind: "all" | "income" | "expense";
  setKind: (k: "all" | "income" | "expense") => void;

  search: string;
  setSearch: (v: string) => void;
  hideEmptyDescriptions: boolean;
  setHideEmptyDescriptions: (v: boolean) => void;
  categories: Category[];
  selectedCategoryIds: number[];
  setSelectedCategoryIds: (v: number[]) => void;
  includeUncategorized: boolean;
  setIncludeUncategorized: (v: boolean) => void;
  sourceFilter: "all" | "pdf" | "manual";
  setSourceFilter: (v: "all" | "pdf" | "manual") => void;
  amountDomain: { min: number; max: number };
  amountAbs: boolean;
  setAmountAbs: (v: boolean) => void;
  amountMin: number | null;
  amountMax: number | null;
  setAmountMin: (v: number | null) => void;
  setAmountMax: (v: number | null) => void;
  density: Density;
  setDensity: (v: Density) => void;
  activeFiltersCount: number;
  onReset: () => void;
}) {
  const [localQ, setLocalQ] = useState(search);

  useEffect(() => setLocalQ(search), [search]);
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(localQ), 180);
    return () => window.clearTimeout(t);
  }, [localQ, setSearch]);

  const selectedLabel =
    selectedCategoryIds.length > 0 || includeUncategorized
      ? `Wybrane: ${selectedCategoryIds.length}${includeUncategorized ? " + brak" : ""}`
      : "Wszystkie";

  const step = useMemo(() => {
    const max = amountDomain.max ?? 0;
    if (max <= 2000) return 1;
    if (max <= 20000) return 5;
    return 10;
  }, [amountDomain.max]);

  const sliderMin = amountMin ?? amountDomain.min;
  const sliderMax = amountMax ?? amountDomain.max;

  return (
    <div className="glass-card glass-card-hover-soft px-4 py-4 space-y-4">
      {/* GÓRA: typ + presety (zastępuje stary “pierwszy card”) */}
      <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Typ przepływu
          </div>
          <div className="flex flex-wrap gap-1">
            <ChipButton active={kind === "all"} onClick={() => setKind("all")}>
              Wszystkie
            </ChipButton>
            <ChipButton active={kind === "income"} onClick={() => setKind("income")}>
              Wpływy
            </ChipButton>
            <ChipButton active={kind === "expense"} onClick={() => setKind("expense")}>
              Wydatki
            </ChipButton>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Presety zakresów
          </div>

          <div className="grid grid-cols-5 gap-2">
            {(["1m", "3m", "6m", "ytd", "all"] as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={[
                  "rounded-full px-3 py-1.5 border text-[11px] transition-all",
                  range === key
                    ? "bg-white/80 text-slate-900 border-white shadow-sm"
                    : "bg-white/0 text-slate-300 border-white/10 hover:bg-white/10",
                ].join(" ")}
              >
                {rangeLabelShort(key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DÓŁ: wszystkie “fancy” filtry (jak masz teraz) */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Szukaj w opisie
            </div>
            <label className="text-[10px] text-slate-500 flex items-center gap-1">
              <input
                type="checkbox"
                checked={hideEmptyDescriptions}
                onChange={(e) => setHideEmptyDescriptions(e.target.checked)}
              />
              Ukryj bez opisu
            </label>
          </div>
          <input
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder='np. "zabka", "spotify", "uber"'
            className="mt-1 w-full rounded-full bg-slate-950/60 border border-white/10 px-3 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/80"
          />
        </div>

        {/* Kategorie */}
        <div className="min-w-[200px]">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Kategorie
          </div>

          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="mt-1 w-full rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-white/10 transition-colors text-left"
              >
                {selectedLabel}
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                align="start"
                className="z-50 w-[340px] rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-3 shadow-xl"
              >
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">
                  Filtr kategorii
                </div>

                <label className="flex items-center gap-2 text-[12px] text-slate-200 mb-2">
                  <input
                    type="checkbox"
                    checked={includeUncategorized}
                    onChange={(e) => setIncludeUncategorized(e.target.checked)}
                  />
                  Brak kategorii
                </label>

                <div className="max-h-56 overflow-auto pr-1 space-y-1">
                  {categories.map((c) => {
                    const checked = selectedCategoryIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: c.color ?? "#a5b4fc" }}
                          />
                          <span className="text-[12px] text-slate-200 truncate">
                            {c.name}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selectedCategoryIds);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            setSelectedCategoryIds([...next]);
                          }}
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryIds([]);
                      setIncludeUncategorized(false);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
                  >
                    Wyczyść
                  </button>
                  <Popover.Close asChild>
                    <button
                      type="button"
                      className="rounded-full bg-indigo-400 text-slate-950 px-3 py-1.5 text-[11px] font-medium hover:bg-indigo-300 transition-colors"
                    >
                      Gotowe
                    </button>
                  </Popover.Close>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Kwota */}
        <div className="min-w-[270px]">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Kwota (range)
            </div>
            <label className="text-[10px] text-slate-500 flex items-center gap-1">
              <input
                type="checkbox"
                checked={amountAbs}
                onChange={(e) => setAmountAbs(e.target.checked)}
              />
              abs
            </label>
          </div>

          <div className="mt-2">
            <Slider.Root
              min={amountDomain.min}
              max={amountDomain.max}
              step={step}
              value={[sliderMin, sliderMax]}
              onValueChange={(v) => {
                setAmountMin(v[0] === amountDomain.min ? null : v[0]);
                setAmountMax(v[1] === amountDomain.max ? null : v[1]);
              }}
              className="relative flex items-center select-none touch-none h-6"
            >
              <Slider.Track className="bg-white/10 relative grow rounded-full h-[6px]">
                <Slider.Range className="absolute bg-indigo-400/70 rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow border border-white/30" />
              <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow border border-white/30" />
            </Slider.Root>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{formatCurrency(sliderMin)}</span>
              <span>{formatCurrency(sliderMax)}</span>
            </div>
          </div>
        </div>

        {/* Źródło */}
        <div className="min-w-[160px]">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Źródło
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="mt-1 w-full rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-white/10 transition-colors"
          >
            <option value="all">Wszystkie</option>
            <option value="pdf">Import PDF</option>
            <option value="manual">Ręczne</option>
          </select>
        </div>

        {/* Gęstość */}
        <div className="min-w-[180px]">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Widok
          </div>
          <div className="mt-1 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {(["compact", "comfortable"] as Density[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDensity(k)}
                className={[
                  "px-3 py-1 text-[11px] rounded-full",
                  density === k
                    ? "bg-white/80 text-slate-900"
                    : "text-slate-300 hover:bg-white/10",
                ].join(" ")}
              >
                {k === "compact" ? "Compact" : "Comfort"}
              </button>
            ))}
          </div>
        </div>

        {/* Reset + licznik */}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
          >
            Reset
          </button>
          <div className="text-[11px] text-slate-500 whitespace-nowrap">
            Filtry: <span className="text-slate-200">{activeFiltersCount}</span>
          </div>
        </div>
      </div>
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
    <aside className="h-fit rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_12px_50px_-30px_rgba(0,0,0,0.8)] backdrop-blur">
      <div className="relative pb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Filtry</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Typ + zakres czasu. Pozostałe filtry są w panelu nad tabelą.
        </p>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
      </div>

      <div className="space-y-3 py-4">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="font-medium text-slate-200">Typ przepływu</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">3 opcje</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChipButton active={kind === "all"} onClick={() => onKindChange("all")}>
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

      <div className="space-y-3 py-4">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="font-medium text-slate-200">Presety zakresów</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Szybki wybór</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          {(["1m", "3m", "6m", "ytd", "all"] as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onRangeChange(key)}
              className={[
                "rounded-xl border px-3 py-2 text-center transition-colors",
                range === key
                  ? "border-white/60 bg-white/90 text-slate-900 shadow-inner shadow-white/60"
                  : "border-white/10 bg-white/0 text-slate-300 hover:border-white/30 hover:bg-white/5",
              ].join(" ")}
            >
              {rangeLabelShort(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-3 text-[11px] text-slate-400">
        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
        <p className="leading-relaxed">
          Tip: hover na “Opis” pokazuje pełny tekst bez rozwalania wierszy.
        </p>
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
        "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "border-white/60 bg-white/90 text-slate-900 shadow-inner shadow-white/60"
          : "border-white/10 bg-white/0 text-slate-200 hover:border-white/30 hover:bg-white/5",
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
  compact = false,
}: {
  label: string;
  value: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-emerald-500/20 ${
        compact ? "p-3" : "md:p-5"
      }`}
    >
      <div className="absolute inset-0 opacity-70 blur-3xl bg-gradient-to-br from-emerald-400/10 via-indigo-400/10 to-pink-400/10" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-indigo-400 to-pink-400" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-50">{value}</div>
        </div>
        <div className="mt-1 h-8 w-8 rounded-full bg-white/10 ring-1 ring-white/10" />
      </div>
      <div className="relative mt-3 text-[11px] text-slate-400">{subtitle}</div>
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
    cell: ({ row, table }) => {
      const desc = (row.original.description || "").trim();
      const has = desc.length > 0;

      const density = (table.options.meta as any)?.density as Density | undefined;

      const baseTextClass = has ? "text-slate-100" : "text-slate-600";
      const compact = density !== "comfortable";

      return (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div
              className={[
                "block max-w-[420px]",
                compact ? "truncate" : "line-clamp-2",
                baseTextClass,
              ].join(" ")}
              title={has ? desc : "—"}
            >
              {has ? desc : "—"}
            </div>
          </Tooltip.Trigger>

          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="start"
              className="
                z-50 max-w-[680px]
                rounded-2xl border border-white/10 bg-slate-950/80
                backdrop-blur-xl px-4 py-3
                text-[12px] text-slate-200
                shadow-xl
              "
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-1">
                Pełny opis
              </div>
              <div className="leading-snug whitespace-pre-wrap">
                {has ? desc : "—"}
              </div>
              <Tooltip.Arrow className="fill-white/10" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
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
      const src = row.original.category_source;
      const isAuto = src === "rule";

      return (
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={
              has
                ? "text-slate-400 whitespace-nowrap"
                : "text-slate-600 whitespace-nowrap"
            }
          >
            {has ? cat : "—"}
          </span>

          {has && isAuto && (
            <span className="text-[9px] uppercase tracking-[0.16em] text-indigo-300/90 whitespace-nowrap">
              AUTO
            </span>
          )}
        </div>
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

const TransactionsTable = React.forwardRef<TransactionsTableHandle, {
  transactions: TxExt[];
  loading: boolean;
  onRowClick: (tx: TxExt) => void;
  selectedId: number | null;
  density: Density;
}>(
  ({ transactions, loading, onRowClick, selectedId, density }, ref) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
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
    meta: { density },
  });

  useEffect(() => {
    // zachowaj aktualną stronę – nie teleportuj usera
    const pageIndex = table.getState().pagination.pageIndex;

    // comfort: mniej, compact: więcej
    table.setPageSize(density === "compact" ? 18 : 12);

    // zostaw ten sam indeks strony (tanstack to ogarnia)
    table.setPageIndex(pageIndex);
  }, [density, table]);

  const formatExportValue = useCallback(
    (tx: TxExt, columnId: TransactionColumnId) => {
      switch (columnId) {
        case "date":
          return formatDateDisplay(tx.date);
        case "description": {
          const desc = (tx.description || "").trim();
          return desc.length > 0 ? desc : "—";
        }
        case "category": {
          const cat = (tx.category || "").trim();
          const isAuto = tx.category_source === "rule";
          if (!cat) return "—";
          return isAuto ? `${cat} (AUTO)` : cat;
        }
        case "amount":
          return formatCurrency(tx.amountNum);
        case "value_date": {
          const raw = tx.value_date as any;
          if (!raw) return "—";
          const d = new Date(raw);
          return Number.isNaN(d.getTime()) ? "—" : formatDateDisplay(d);
        }
        case "is_manual":
          return tx.is_manual ? "MANUAL" : "PDF";
        case "account_id":
          return tx.account_id?.toString() ?? "—";
        default:
          return "";
      }
    },
    []
  );

  useImperativeHandle(
    ref,
    (): TransactionsTableHandle => ({
      getExportPayload: () => {
        const visibleColumns = table
          .getVisibleLeafColumns()
          .map((col) => col.id as TransactionColumnId);

        if (visibleColumns.length === 0) return null;

        const headerLabels = visibleColumns.map((id) => columnLabel(id));

        const rows = table.getPrePaginationRowModel().rows.map((row) =>
          visibleColumns.map((id) => formatExportValue(row.original, id))
        );

        return { headers: headerLabels, rows };
      },
    }),
    [formatExportValue, table]
  );

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

  const rowPad = density === "comfortable" ? "py-2.5" : "py-1.5";

  return (
    <div className="space-y-3">
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
              {columnLabel(column.id as TransactionColumnId)}
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

      <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
        <div className="h-full overflow-auto">
          <table className="min-w-full table-fixed text-[11px] text-left">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
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
                          "px-3 align-middle",
                          rowPad,
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
    </div>
  );
});

TransactionsTable.displayName = "TransactionsTable";

/* ---------- DETAILS PANEL ---------- */

function TransactionSideDetails({
  open,
  transaction,
  categories,
  onChangeCategory,
  onCreateCategory,
  ruleSuggestion,
  enablingSuggestion,
  onAcceptRuleSuggestion,
  onDismissRuleSuggestion,
  automationBanner,
}: {
  open: boolean;
  transaction: TxExt;
  categories: Category[];
  onChangeCategory: (txId: number, categoryId: number | null) => void;
  onCreateCategory: (payload: { name: string; color?: string | null }) => Promise<Category>;
  ruleSuggestion: (RuleSuggestion & { txId: number }) | null;
  enablingSuggestion: boolean;
  onAcceptRuleSuggestion: () => void;
  onDismissRuleSuggestion: () => void;
  automationBanner: AutomationBanner;
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
        "min-w-[360px] max-w-[360px] w-[360px] h-full",
        "flex flex-col rounded-xl border border-slate-800/80",
        "bg-slate-950/70 backdrop-blur-md text-slate-200",
        "px-4 py-4 text-[11px]",
        "shadow-[0_20px_60px_-25px_rgba(0,0,0,0.55)]",
        "max-h-[calc(100vh-180px)] overflow-y-auto",
        "transition-all duration-300 ease-in-out",
        open
          ? "opacity-100 translate-x-0"
          : "opacity-0 pointer-events-none translate-x-3",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
            Szczegóły transakcji
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          {/* <div className="mt-1 min-w-0 truncate text-[12px] font-semibold text-white">
            {transaction.name || "Transakcja"}
          </div> */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">ID {transaction.id}</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">{operationDate}</span>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-100/90 uppercase tracking-[0.12em]">
              {transaction.is_manual ? "MANUAL" : "PDF"}
            </span>
          </div>
        </div>

        <div
          className={[
            "shrink-0 rounded-lg border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap",
            transaction.amountNum >= 0
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
              : "border-rose-400/30 bg-rose-500/10 text-rose-50",
          ].join(" ")}
        >
          {formatCurrency(transaction.amountNum)}
        </div>
      </div>

      <div className="mt-3 space-y-4 divide-y divide-white/5">
        {/* Category */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-400">
            <span>Kategoria</span>
            <span className="text-slate-500">{transaction.category_source ?? "—"}</span>
          </div>

          <CategoryDropdown
            value={transaction.category_id}
            categories={categories}
            onChange={(categoryId) => onChangeCategory(transaction.id, categoryId)}
            onCreateCategory={onCreateCategory}
          />
        </div>

        {/* Rule suggestion */}
        {ruleSuggestion && (
          <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/5 px-3 py-2 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.6)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-indigo-200/90">
                  Automatyzacja podobnych
                </div>
                <div className="text-[11px] text-slate-200 leading-relaxed">
                  Wykryto powtarzający się token{" "}
                  <span className="font-semibold text-white">
                    {ruleSuggestion.pattern_value}
                  </span>
                  . Włączyć regułę dla podobnych ({ruleSuggestion.similar_count})?
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={onAcceptRuleSuggestion}
                  disabled={enablingSuggestion}
                  className="rounded-md border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white shadow-inner hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {enablingSuggestion ? "Włączanie…" : "Włącz"}
                </button>
                <button
                  type="button"
                  onClick={onDismissRuleSuggestion}
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Nie teraz
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Automation banner */}
        {automationBanner && (
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/5 px-3 py-2 space-y-1 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.6)]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/90">
              Automatyzacja włączona
            </div>
            <div className="text-[11px] text-slate-200">
              Zastosowano do{" "}
              <span className="font-semibold text-white">
                {automationBanner.count}
              </span>{" "}
              podobnych.
            </div>
            <div className="text-[10px] text-slate-400">
              Wzorzec: <span className="text-slate-200">{automationBanner.token}</span>
              {automationBanner.categoryName ? (
                <>
                  {" "}
                  → <span className="text-slate-200">{automationBanner.categoryName}</span>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-2">
            Dane
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <DetailCell label="Data operacji" value={operationDate} />
            <DetailCell label="Data waluty" value={valueDate} />
            <DetailCell
              label="Źródło"
              value={transaction.is_manual ? "Ręczna" : "Import PDF"}
            />
            <DetailCell label="Konto (ID)" value={String(transaction.account_id)} />
          </div>
        </div>

        {/* Description */}
        <div className="pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-2">
            Opis
          </div>
          <div
            className={[
              "rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap",
              hasDesc ? "text-slate-200" : "text-slate-600 italic",
            ].join(" ")}
          >
            {hasDesc ? desc : "—"}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3 text-[10px] text-slate-500">
        Kliknij ponownie wiersz, aby zamknąć panel.
      </div>
    </aside>
  );
}

function CategoryDropdown({
  value,
  categories,
  onChange,
  onCreateCategory,
}: {
  value: number | null;
  categories: Category[];
  onChange: (categoryId: number | null) => void;
  onCreateCategory: (payload: { name: string; color?: string | null }) => Promise<Category>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#a5b4fc");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const options = useMemo(
    () => [
      {
        value: "",
        label: "Brak kategorii",
        helper: "Pozostaw bez przypisania",
        color: "#475569",
      },
      ...categories.map((cat) => ({
        value: cat.id.toString(),
        label: cat.name,
        helper: "Przypisz kategorię",
        color: cat.color ?? "#a5b4fc",
      })),
    ],
    [categories]
  );

  const active =
    options.find((opt) => opt.value === (value?.toString() ?? "")) ?? options[0];

  const filtered = useMemo(() => {
    const nq = normalizeQuery(q);
    if (!nq) return options;
    return options.filter((o) => normalizeQuery(o.label).includes(nq));
  }, [options, q]);

  const pick = (nextValue: string) => {
    onChange(nextValue === "" ? null : Number(nextValue));
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = newCatName.trim();
    if (!name) {
      setCreateError("Podaj nazwę kategorii.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await onCreateCategory({ name, color: newCatColor });
      setNewCatName("");
      setQ("");
      pick(created.id.toString());
    } catch (e: any) {
      setCreateError(e?.message ?? "Nie udało się dodać kategorii.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/70"
          aria-label="Zmień kategorię transakcji"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 border border-white/10"
                  style={{ backgroundColor: active.color }}
                />
                <span className="truncate text-[12px] font-medium text-slate-100">
                  {active.label}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-slate-500">
                {active.helper}
              </div>
            </div>

            <ChevronDownIcon className="h-4 w-4 text-slate-400" />
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50 w-[320px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-xl shadow-black/50"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Wybierz kategorię
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj…"
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400/60"
            />
          </div>

          <div className="max-h-[280px] overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-slate-500">
                Brak wyników.
              </div>
            ) : (
              filtered.map((option) => {
                const isActive = option.value === (value?.toString() ?? "");
                return (
                  <button
                    key={option.value === "" ? "none" : option.value}
                    type="button"
                    onClick={() => pick(option.value)}
                    className={[
                      "w-full px-3 py-2 text-left border-b border-white/5 hover:bg-white/5 transition-colors",
                      isActive ? "bg-white/5" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 border border-white/10"
                        style={{ backgroundColor: option.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] text-slate-200">
                          {option.label}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">
                          {option.helper}
                        </div>
                      </div>
                      {isActive ? (
                        <CheckIcon className="h-4 w-4 text-indigo-200" />
                      ) : (
                        <span className="text-[10px] text-slate-600"> </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-white/10 bg-slate-950/70 px-3 py-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Dodaj nową kategorię</div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-500">Nazwa</label>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="np. Ubrania"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400/60"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-200">
                  <span
                    className="h-6 w-6 rounded border border-white/10"
                    style={{ backgroundColor: newCatColor }}
                  />
                  <label className="text-[10px] text-slate-500">Kolor</label>
                </div>
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="h-8 w-16 rounded border border-white/10 bg-slate-900"
                />
              </div>
              {createError ? (
                <div className="text-[10px] text-rose-300">{createError}</div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewCatName("");
                    setCreateError(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                  disabled={creating}
                >
                  Wyczyść
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="rounded-lg border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-100 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? "Dodawanie…" : "Dodaj i przypisz"}
                </button>
              </div>
            </div>
          </div>

          <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setQ("");
                pick("");
              }}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Wyczyść
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-slate-100 hover:bg-white/20"
            >
              Zamknij
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}


function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.59 13.41 12 4.82 4.41 12.41a2 2 0 0 0 0 2.83l4.35 4.35a2 2 0 0 0 2.83 0l8.59-8.59Z" />
      <path d="M8 8h.01" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
  return (transactions ?? []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];

    const opDate = (raw as Transaction | Record<string, unknown>).operation_date;
    let d = parseDate(opDate);

    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      try {
        d = new Date(opDate as any);
      } catch {
        d = new Date();
      }
    }

    const amount = (raw as Transaction | Record<string, unknown>).amount ?? "0";

    return [
      {
        ...(raw as Transaction),
        operation_date: opDate ?? "",
        amount,
        amountNum: parseAmount(amount as any),
        date: d,
      },
    ];
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
