"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";
import { SignedOutState } from "@/components/SignedOutState";

import {
  fetchLabInsights,
  enableLabRule,
  type LabInsights,
  type LabSuggestion,
  fetchCategories,
  fetchCategoryStats,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,

  // Smart Rules
  fetchCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  reorderCategoryRules,
  applyCategoryRules,
  type CategoryRule,
} from "@/lib/serverApi";

const DISMISSED_KEY = "flowparser.dismissed_suggestions.v1";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function writeDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}

function labelField(field: string) {
  if (field === "description") return "opis";
  if (field === "raw_description") return "opis (surowy)";
  return "opis";
}
function labelPatternType(pt: string) {
  if (pt === "contains") return "zawiera";
  if (pt === "startswith") return "zaczyna się od";
  if (pt === "equals") return "jest równe";
  return "zawiera";
}

function tryParseJson(maybe: string | undefined) {
  if (!maybe) return null;
  try {
    return JSON.parse(maybe);
  } catch {
    return null;
  }
}

const SELECT_CLASS =
  "h-9 w-full rounded-full bg-slate-900/70 border border-white/10 px-3 text-[12px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/70";
const SELECT_STYLE = { colorScheme: "dark" as const };

type LabInitialData = {
  insights: LabInsights;
  categories: Category[];
  stats: Record<number, number>;
  rules: CategoryRule[];
};

export function LabClient({ initialData }: { initialData?: LabInitialData | null }) {
  const { user, authLoading } = useAuth();

  const [data, setData] = useState<LabInsights | null>(
    initialData?.insights ?? null
  );
  const [loading, setLoading] = useState(!initialData);

  // AI suggestions
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<{ key: string; applied: number } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [suggestionSort, setSuggestionSort] = useState<"potential" | "manual">("potential");
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");

  // Categories
  const [cats, setCats] = useState<Category[]>(initialData?.categories ?? []);
  const [catStats, setCatStats] = useState<Record<number, number>>(initialData?.stats ?? {});
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState<string>("#7c3aed");
  const [catError, setCatError] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState<number | "create" | null>(null);
  const [categorySearch, setCategorySearch] = useState("");

  // Inline edit categories
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("#7c3aed");

  // Smart rules
  const [rules, setRules] = useState<CategoryRule[]>(initialData?.rules ?? []);
  const [rulesLoading, setRulesLoading] = useState(!initialData);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesBusyId, setRulesBusyId] = useState<number | "create" | "apply" | "reorder" | "delete" | null>(null);
  const [ruleFilter, setRuleFilter] = useState<"all" | "enabled" | "disabled">("all");

  // create rule form
  const [newRuleCategoryId, setNewRuleCategoryId] = useState<number | "">("");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newRuleField, setNewRuleField] = useState<"description" | "raw_description">("description");
  const [newRulePatternType, setNewRulePatternType] = useState<"contains" | "startswith" | "equals">("contains");

  // edit rule inline
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editRuleCategoryId, setEditRuleCategoryId] = useState<number | "">("");
  const [editRuleValue, setEditRuleValue] = useState("");
  const [editRuleField, setEditRuleField] = useState<"description" | "raw_description">("description");
  const [editRulePatternType, setEditRulePatternType] = useState<"contains" | "startswith" | "equals">("contains");

  // Delete category modal (403 details)
  const [deleteModal, setDeleteModal] = useState<null | {
    id: number;
    name: string;
    tx_count: number;
    rule_count: number;
  }>(null);

  // Delete rule modal
  const [deleteRuleModal, setDeleteRuleModal] = useState<null | {
    id: number;
    humanLine: string;
  }>(null);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const catById = useMemo(() => {
    const m = new Map<number, Category>();
    for (const c of cats) m.set(c.id, c);
    return m;
  }, [cats]);

  const sortedCats = useMemo(() => {
    return [...cats].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [cats]);

  const filteredCats = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return sortedCats;
    return sortedCats.filter((c) => c.name.toLowerCase().includes(term));
  }, [categorySearch, sortedCats]);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }, [rules]);

  const filteredRules = useMemo(() => {
    if (ruleFilter === "enabled") return sortedRules.filter((r) => r.enabled);
    if (ruleFilter === "disabled") return sortedRules.filter((r) => !r.enabled);
    return sortedRules;
  }, [ruleFilter, sortedRules]);

  const visibleSuggestions = useMemo(() => {
    if (!data) return [];
    return data.suggestions.filter((s) => !dismissed.has(s.suggestion_key));
  }, [data, dismissed]);

  const filteredSuggestions = useMemo(() => {
    const term = suggestionQuery.trim().toLowerCase();
    if (!term) return visibleSuggestions;

    return visibleSuggestions.filter((s) => {
      const cat = catById.get(s.category_id);
      return (
        s.pattern_value.toLowerCase().includes(term) ||
        (cat?.name?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [catById, suggestionQuery, visibleSuggestions]);

  const sortedSuggestions = useMemo(() => {
    const arr = [...filteredSuggestions];
    if (suggestionSort === "potential") {
      return arr.sort(
        (a, b) => (b.potential_matches ?? 0) - (a.potential_matches ?? 0)
      );
    }

    return arr.sort(
      (a, b) => (b.manual_occurrences ?? 0) - (a.manual_occurrences ?? 0)
    );
  }, [filteredSuggestions, suggestionSort]);

  const categorized = data?.coverage_categorized ?? 0;
  const total = data?.coverage_total ?? 0;
  const uncategorized = Math.max(0, total - categorized);
  const coveragePct = clampPct(data?.coverage_pct ?? 0);
  const suggestionCount = visibleSuggestions.length;
  const hasSuggestions = suggestionCount > 0;
  const hasFilteredSuggestions = sortedSuggestions.length > 0;
  const ruleCount = rules.length;
  const categoryCount = cats.length;

  const applyLoadedData = (
    lab: LabInsights,
    categories: Category[],
    stats: Record<number, number>,
    ruleList: CategoryRule[]
  ) => {
    setData(lab);
    setCats(categories);
    setCatStats(stats);
    setRules(ruleList);
  };

  const loadAll = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setRulesLoading(true);
    }
    setCatError(null);
    setRulesError(null);

    try {
      const [lab, categories, stats, ruleList] = await Promise.all([
        fetchLabInsights(),
        fetchCategories(),
        fetchCategoryStats(),
        fetchCategoryRules(),
      ]);

      applyLoadedData(lab, categories, stats, ruleList);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Nie udało się pobrać danych.";
      setCatError(msg);
      setRulesError(msg);
    } finally {
      if (showLoading) {
        setLoading(false);
        setRulesLoading(false);
      }
    }
  };

  const refreshAll = async () => {
    try {
      const [lab, categories, stats, ruleList] = await Promise.all([
        fetchLabInsights(),
        fetchCategories(),
        fetchCategoryStats(),
        fetchCategoryRules(),
      ]);
      applyLoadedData(lab, categories, stats, ruleList);
    } catch (e) {
      console.warn("refreshAll failed:", e);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // niezalogowany -> czyścimy dane i nie fetchujemy
      setData(null);
      // setSuggestions([]);
      // setCategories([]);
      // setStats(null);
      setRules([]);
      setCats([]);
      setCatStats({});
      // setError(null);
      setCatError(null);
      setRulesError(null);
      setLoading(false);
      setRulesLoading(false);
      return;
    }

    if (initialData) {
      applyLoadedData(
        initialData.insights,
        initialData.categories,
        initialData.stats,
        initialData.rules
      );
      setLoading(false);
      setRulesLoading(false);
      loadAll(false);
    } else {
      loadAll(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, initialData]);// ---------- AI suggestions ----------
  const onEnableSuggestion = async (s: LabSuggestion) => {
    setBusyKey(s.suggestion_key);
    setLastApplied(null);
    try {
      const res = await enableLabRule({
        pattern_value: s.pattern_value,
        pattern_type: s.pattern_type,
        category_id: s.category_id,
      });
      setLastApplied({ key: s.suggestion_key, applied: res.applied });
      await refreshAll();
    } finally {
      setBusyKey(null);
    }
  };

  const onDismissSuggestion = (s: LabSuggestion) => {
    const next = new Set(dismissed);
    next.add(s.suggestion_key);
    setDismissed(next);
    writeDismissed(next);
  };

  // ---------- Categories ----------
  const startEditCategory = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor((c.color ?? "#7c3aed") as string);
  };

  const cancelEditCategory = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("#7c3aed");
  };

  const saveEditCategory = async (id: number) => {
    setCatBusy(id);
    setCatError(null);
    try {
      await updateCategory(id, {
        name: editName.trim(),
        color: editColor,
      });
      cancelEditCategory();
      await refreshAll();
    } catch (e: any) {
      setCatError(e?.message ?? "Nie udało się zapisać zmian.");
    } finally {
      setCatBusy(null);
    }
  };

  const requestRemoveCategory = async (c: Category) => {
    setCatBusy(c.id);
    setCatError(null);
    try {
      await deleteCategory(c.id, false, false);
      await refreshAll();
    } catch (e: any) {
      const detail = tryParseJson(e?.message);
      if (detail?.tx_count != null || detail?.rule_count != null) {
        setDeleteModal({
          id: c.id,
          name: c.name,
          tx_count: Number(detail.tx_count ?? 0),
          rule_count: Number(detail.rule_count ?? 0),
        });
      } else {
        setCatError(e?.message ?? "Nie udało się usunąć kategorii.");
      }
    } finally {
      setCatBusy(null);
    }
  };

  const confirmDeleteCategory = async (id: number, deleteRules: boolean) => {
    setCatBusy(id);
    setCatError(null);
    try {
      await deleteCategory(id, true, deleteRules);
      setDeleteModal(null);
      await refreshAll();
    } catch (e: any) {
      const detail = tryParseJson(e?.message);
      if (detail?.message) {
        setCatError(
          `${detail.message} (tx: ${detail.tx_count ?? 0}, rules: ${detail.rule_count ?? 0})`
        );
      } else {
        setCatError(e?.message ?? "Nie udało się usunąć kategorii.");
      }
    } finally {
      setCatBusy(null);
    }
  };

  const createNewCategory = async () => {
    const name = catName.trim();
    if (!name) return;

    setCatBusy("create");
    setCatError(null);
    try {
      await createCategory({ name, color: catColor });
      setCatName("");
      await refreshAll();
    } catch (e: any) {
      setCatError(e?.message ?? "Nie udało się dodać kategorii.");
    } finally {
      setCatBusy(null);
    }
  };

  // ---------- Smart Rules ----------
  const beginEditRule = (r: CategoryRule) => {
    setEditingRuleId(r.id);
    setEditRuleCategoryId(r.category_id);
    setEditRuleValue(r.pattern_value);
    setEditRuleField((r.field as any) === "raw_description" ? "raw_description" : "description");
    setEditRulePatternType(
      (r.pattern_type as any) === "startswith"
        ? "startswith"
        : (r.pattern_type as any) === "equals"
          ? "equals"
          : "contains"
    );
  };

  const cancelEditRule = () => {
    setEditingRuleId(null);
    setEditRuleCategoryId("");
    setEditRuleValue("");
    setEditRuleField("description");
    setEditRulePatternType("contains");
  };

  const saveRule = async (id: number) => {
    if (editRuleCategoryId === "" || !editRuleValue.trim()) return;

    setRulesBusyId(id);
    setRulesError(null);
    try {
      await updateCategoryRule(id, {
        category_id: Number(editRuleCategoryId),
        pattern_value: editRuleValue.trim(),
        field: editRuleField,
        pattern_type: editRulePatternType,
      });
      cancelEditRule();
      await refreshAll();
    } catch (e: any) {
      setRulesError(e?.message ?? "Nie udało się zapisać reguły.");
    } finally {
      setRulesBusyId(null);
    }
  };

  const toggleRule = async (r: CategoryRule) => {
    setRulesBusyId(r.id);
    setRulesError(null);
    try {
      await updateCategoryRule(r.id, { enabled: !r.enabled });
      await refreshAll();
    } catch (e: any) {
      setRulesError(e?.message ?? "Nie udało się zmienić stanu reguły.");
    } finally {
      setRulesBusyId(null);
    }
  };

  const createRule = async () => {
    if (newRuleCategoryId === "" || !newRuleValue.trim()) return;

    setRulesBusyId("create");
    setRulesError(null);
    try {
      await createCategoryRule({
        category_id: Number(newRuleCategoryId),
        pattern_value: newRuleValue.trim(),
        field: newRuleField,
        pattern_type: newRulePatternType,
      });
      setNewRuleValue("");
      await refreshAll();
    } catch (e: any) {
      setRulesError(e?.message ?? "Nie udało się utworzyć reguły.");
    } finally {
      setRulesBusyId(null);
    }
  };

  const moveRule = async (id: number, dir: -1 | 1) => {
    const arr = sortedRules.map((r) => r.id);
    const idx = arr.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= arr.length) return;

    const next = [...arr];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;

    setRulesBusyId("reorder");
    setRulesError(null);
    try {
      await reorderCategoryRules(next);
      await refreshAll();
    } catch (e: any) {
      setRulesError(e?.message ?? "Nie udało się zmienić kolejności.");
    } finally {
      setRulesBusyId(null);
    }
  };

  const applyRulesNow = async () => {
    setRulesBusyId("apply");
    setRulesError(null);
    try {
      await applyCategoryRules();
      await refreshAll();
    } catch (e: any) {
      setRulesError(e?.message ?? "Nie udało się zastosować reguł.");
    } finally {
      setRulesBusyId(null);
    }
  };

  const requestRemoveRule = (r: CategoryRule) => {
    const cat = catById.get(r.category_id);
    const humanLine = `Jeśli ${labelField(r.field)} ${labelPatternType(r.pattern_type)} „${r.pattern_value}” → ${cat?.name ?? "Kategoria"}`;
    setDeleteRuleModal({ id: r.id, humanLine });
  };

  const confirmRemoveRule = async (ruleId: number) => {
    setRulesBusyId("delete");
    setRulesError(null);
    try {
      // backend: usuwa regułę + odłącza przypisania tej reguły (wg ustaleń)
      await deleteCategoryRule(ruleId);
      if (editingRuleId === ruleId) cancelEditRule();
      setDeleteRuleModal(null);
      await refreshAll();
    } catch (e: any) {
      setRulesError(e?.message ?? "Nie udało się usunąć reguły.");
    } finally {
      setRulesBusyId(null);
    }
  };

  if (!authLoading && !user) {
    return (
      <SignedOutState
        title="Lab"
        desc="Zaloguj się, aby zarządzać kategoriami i automatyzacjami oraz budować inteligentne reguły."
      />
    );
  }

  return (
    <div className="relative mx-auto flex h-full max-w-6xl flex-col gap-8 px-4 pb-12 pt-6 md:px-8">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_32%),linear-gradient(120deg,rgba(9,12,20,0.96),rgba(12,19,33,0.92))]" />
        <div className="absolute inset-0 -z-10 opacity-50 bg-[linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="pointer-events-none absolute inset-x-6 top-8 -z-10 h-32 rounded-[28px] bg-gradient-to-r from-indigo-500/20 via-sky-500/12 to-emerald-400/18 blur-3xl" />

        {/* Hero */}
        <section className="glass-card glass-card-hover-strong relative overflow-hidden border border-white/10 px-6 py-8 shadow-[0_15px_80px_rgba(0,0,0,0.45)] md:px-9">
          <div className="absolute -top-16 left-6 h-32 w-32 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="absolute -bottom-20 right-10 h-36 w-36 rounded-full bg-emerald-500/25 blur-3xl" />
          <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <div className="relative grid items-start gap-8 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="max-w-3xl space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-indigo-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  Laboratorium automatyzacji
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                  Spójny z Flow i Dashboard
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl md:text-[32px] font-semibold text-slate-50 tracking-tight">Lab</h1>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">nowa makieta</span>
                </div>
                <p className="text-sm md:text-[13px] leading-relaxed text-slate-300">
                  Sekcja Lab została przeprojektowana, by lepiej pasować do reszty projektu: szklane karty, gradienty i
                  klarowna hierarchia elementów pomagają szybciej ocenić stan automatyzacji.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={refreshAll}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Odśwież dane
                </button>
                <button
                  type="button"
                  onClick={applyRulesNow}
                  disabled={rulesBusyId === "apply"}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[11px] text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {rulesBusyId === "apply" ? "Zastosuj…" : "Zastosuj reguły"}
                </button>
                <Link
                  href="/flow"
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-400/50 bg-indigo-500/25 px-3 py-1.5 text-[11px] text-indigo-100 transition-all hover:-translate-y-0.5 hover:bg-indigo-500/35"
                >
                  Otwórz Flow →
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroStat
                  title="Pokrycie kategorii"
                  value={data ? `${coveragePct.toFixed(2)}%` : "—"}
                  detail={data ? `${categorized}/${total}` : "włącz import"}
                />
                <HeroStat
                  title="Automatyzacje"
                  value={data ? `${data.assignments_rule}` : "—"}
                  detail="reguły + AI"
                />
                <HeroStat
                  title="Ręczne decyzje"
                  value={data ? `${data.assignments_manual}` : "—"}
                  detail="uczą model"
                />
              </div>
            </div>

            <div className="relative space-y-4">
              <CoverageGauge
                value={coveragePct}
                total={total}
                categorized={categorized}
                uncategorized={uncategorized}
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[11px] text-slate-200 shadow-[0_10px_50px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <span>Spójność UI</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <BadgePill label="Glassmorphism" desc="wspólny motyw" />
                  <BadgePill label="Gradienty" desc="DNA projektu" />
                  <BadgePill label="Focus" desc="priorytetyzacja akcji" />
                  <BadgePill label="Ruch" desc="subtelne animacje" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
          {/* LEFT */}
          <div className="flex flex-col gap-6">
          {/* Smart overview */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all hover:-translate-y-1 hover:border-indigo-300/50">
            <div className="absolute -top-16 -right-24 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-24 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative px-6 sm:px-7 pt-6 pb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Smart overview</div>
                  <h2 className="mt-1 text-sm font-semibold text-slate-50 flex items-center gap-2">
                    Jak bardzo „ogarnięte” są Twoje finanse
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                      beta
                    </span>
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-md">
                    To jest szybki pulpit Labu: pokrycie kategorii, automatyzacje i rzeczy do przejrzenia.
                  </p>
                </div>

                <Link
                  href="/flow"
                  className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  Otwórz Flow →
                </Link>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-[11px]">
                <MiniKpi
                  label="Widoczne sugestie"
                  value={loading ? "—" : `${suggestionCount}`}
                  hint="czeka na decyzję"
                />
                <MiniKpi
                  label="Reguły"
                  value={rulesLoading ? "—" : `${ruleCount}`}
                  hint="kolejność = priorytet"
                />
                <MiniKpi
                  label="Kategorie"
                  value={loading ? "—" : `${categoryCount}`}
                  hint="mapa w Flow"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Postęp rozumienia</span>
                  <span className="text-slate-200">
                    {categorized}/{total}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 via-sky-400/70 to-emerald-400/70"
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>
                <div className="mt-2 text-[10px] text-slate-500">
                  Najszybsza droga do „inteligencji”: przypisuj kategorie w Flow, a Lab będzie proponował automatyzacje.
                </div>
              </div>
            </div>
          </section>

          {/* SMART RULES */}
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-950/60 to-slate-900/60 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all hover:-translate-y-1 hover:border-indigo-200/50">
              <div className="absolute -top-10 left-10 h-24 w-24 rounded-full bg-indigo-500/12 blur-3xl" />
              <div className="absolute -bottom-14 right-0 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="absolute inset-0 opacity-60 bg-[linear-gradient(115deg,rgba(99,102,241,0.12),transparent_35%),linear-gradient(250deg,rgba(16,185,129,0.12),transparent_38%)]" />

            <div className="relative px-6 sm:px-7 pt-6 pb-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Smart rules
                  </div>
                  <h2 className="mt-1 text-sm font-semibold text-slate-50 flex items-center gap-2">
                    Automatyczne reguły kategoryzacji
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                      w tle
                    </span>
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-md">
                    Reguły są proste i czytelne: „jeśli opis zawiera X → przypisz kategorię Y”.
                    Działają automatycznie przy nowych importach.
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyRulesNow}
                    disabled={rulesBusyId === "apply"}
                    className={[
                      "inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium",
                      rulesBusyId === "apply"
                        ? "border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed"
                        : "border border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20 transition-colors",
                    ].join(" ")}
                    title="Zastosuj reguły do nieopisanych transakcji"
                  >
                    {rulesBusyId === "apply" ? "Stosowanie…" : "Zastosuj teraz"}
                  </button>

                  <Link
                    href="#ai"
                    className="inline-flex items-center rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-[11px] text-indigo-100 hover:bg-indigo-500/15 transition-colors"
                  >
                    Sugestie →
                  </Link>
                </div>
              </div>

              {rulesError && (
                <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {rulesError}
                </div>
              )}

              {/* Create */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-colors">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Dodaj automatyzację
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,1fr,auto] items-center">
                  <select
                    style={SELECT_STYLE}
                    className={SELECT_CLASS}
                    value={newRuleCategoryId}
                    onChange={(e) => setNewRuleCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                  >
                    <option value="">Wybierz kategorię…</option>
                    {sortedCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <input
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    placeholder="np. zabka, uber, spotify…"
                    className="h-9 w-full rounded-full border border-white/10 bg-slate-900/70 px-3 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/70"
                  />

                  <button
                    type="button"
                    onClick={createRule}
                    disabled={rulesBusyId === "create"}
                    className={[
                      "h-9 rounded-full px-3 text-[12px] font-medium whitespace-nowrap shrink-0",
                      rulesBusyId === "create"
                        ? "border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed"
                        : "border border-indigo-400/60 bg-indigo-500/70 text-slate-950 hover:bg-indigo-400 transition-colors",
                    ].join(" ")}
                  >
                    {rulesBusyId === "create" ? "Dodawanie…" : "Dodaj"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>Dopasowanie:</span>

                  <select
                    style={SELECT_STYLE}
                    className="h-8 rounded-full bg-slate-900/70 border border-white/10 px-3 text-[11px] text-slate-200 focus:outline-none"
                    value={newRulePatternType}
                    onChange={(e) => setNewRulePatternType(e.target.value as any)}
                  >
                    <option value="contains">zawiera</option>
                    <option value="startswith">zaczyna się od</option>
                    <option value="equals">jest równe</option>
                  </select>

                  <span>w polu:</span>
                  <select
                    style={SELECT_STYLE}
                    className="h-8 rounded-full bg-slate-900/70 border border-white/10 px-3 text-[11px] text-slate-200 focus:outline-none"
                    value={newRuleField}
                    onChange={(e) => setNewRuleField(e.target.value as any)}
                  >
                    <option value="description">opis</option>
                    <option value="raw_description">opis (surowy)</option>
                  </select>
                </div>
              </div>

              {/* Rules list */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500 flex flex-wrap items-center justify-between gap-3">
                  <span>Aktywne reguły</span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <div className="inline-flex rounded-full border border-white/10 bg-slate-900/60 p-1">
                      {["all", "enabled", "disabled"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRuleFilter(mode as any)}
                          className={[
                            "px-3 py-1 rounded-full capitalize",
                            ruleFilter === mode
                              ? "bg-indigo-500/80 text-slate-950 shadow"
                              : "text-slate-200 hover:bg-white/5",
                          ].join(" ")}
                        >
                          {mode === "all" ? "wszystkie" : mode === "enabled" ? "aktywne" : "wstrzymane"}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={applyRulesNow}
                      disabled={rulesBusyId === "apply"}
                      className="sm:hidden rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
                    >
                      {rulesBusyId === "apply" ? "…" : "Zastosuj"}
                    </button>
                    <span className="text-[10px] text-slate-600">Kolejność = priorytet</span>
                  </div>
                </div>

                {rulesLoading ? (
                  <div className="px-4 py-4 text-[11px] text-slate-400">Ładowanie reguł…</div>
                ) : filteredRules.length === 0 ? (
                  <div className="px-4 py-4 text-[11px] text-slate-400">
                    {sortedRules.length === 0
                      ? "Brak reguł. Skorzystaj z sugestii AI albo dodaj własną automatyzację powyżej."
                      : "Brak wyników dla tego filtra. Zmień widok lub dodaj nową regułę."}
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {filteredRules.map((r, idx) => {
                      const isEditing = editingRuleId === r.id;
                      const cat = catById.get(r.category_id);
                      const isBusy = rulesBusyId === r.id || rulesBusyId === "reorder" || rulesBusyId === "delete";

                      const humanLine = `Jeśli ${labelField(r.field)} ${labelPatternType(r.pattern_type)} „${r.pattern_value}” → ${cat?.name ?? "Kategoria"}`;

                      return (
                        <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleRule(r)}
                                disabled={isBusy}
                                className={[
                                  "h-6 w-10 rounded-full border transition-colors relative",
                                  r.enabled
                                    ? "border-emerald-400/40 bg-emerald-500/15"
                                    : "border-white/10 bg-black/20",
                                  isBusy ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10",
                                ].join(" ")}
                                title={r.enabled ? "Wyłącz regułę" : "Włącz regułę"}
                              >
                                <span
                                  className={[
                                    "absolute top-1/2 left-1 -translate-y-1/2 h-4 w-4 rounded-full",
                                    "transition-transform duration-200",
                                    r.enabled ? "translate-x-5 bg-emerald-200" : "translate-x-0 bg-slate-400",
                                  ].join(" ")}
                                />
                              </button>

                              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
                                #{idx + 1}
                              </span>

                              {cat && (
                                <span className="inline-flex items-center gap-2 text-[11px] text-slate-200">
                                  <span
                                    className="h-2 w-2 rounded-full border border-white/20"
                                    style={{ background: cat.color ?? "rgba(255,255,255,0.18)" }}
                                  />
                                  {cat.name}
                                </span>
                              )}
                            </div>

                            {!isEditing ? (
                              <div className="mt-1 text-[12px] text-slate-100 truncate">{humanLine}</div>
                            ) : (
                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr,1fr]">
                                <select
                                  style={SELECT_STYLE}
                                  className={SELECT_CLASS}
                                  value={editRuleCategoryId}
                                  onChange={(e) => setEditRuleCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                                >
                                  <option value="">Kategoria…</option>
                                  {sortedCats.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  value={editRuleValue}
                                  onChange={(e) => setEditRuleValue(e.target.value)}
                                  className="h-9 w-full rounded-full border border-white/10 bg-slate-900/70 px-3 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/70"
                                  placeholder="fraza…"
                                />

                                <div className="flex flex-wrap items-center gap-2 sm:col-span-2 text-[11px] text-slate-500">
                                  <span>Dopasowanie:</span>
                                  <select
                                    style={SELECT_STYLE}
                                    className="h-8 rounded-full bg-slate-900/70 border border-white/10 px-3 text-[11px] text-slate-200 focus:outline-none"
                                    value={editRulePatternType}
                                    onChange={(e) => setEditRulePatternType(e.target.value as any)}
                                  >
                                    <option value="contains">zawiera</option>
                                    <option value="startswith">zaczyna się od</option>
                                    <option value="equals">jest równe</option>
                                  </select>

                                  <span>w polu:</span>
                                  <select
                                    style={SELECT_STYLE}
                                    className="h-8 rounded-full bg-slate-900/70 border border-white/10 px-3 text-[11px] text-slate-200 focus:outline-none"
                                    value={editRuleField}
                                    onChange={(e) => setEditRuleField(e.target.value as any)}
                                  >
                                    <option value="description">opis</option>
                                    <option value="raw_description">opis (surowy)</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-start gap-2">
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => moveRule(r.id, -1)}
                                disabled={isBusy || idx === 0}
                                className="rounded-full border border-white/10 bg-white/0 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-40"
                                title="Wyżej (większy priorytet)"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRule(r.id, 1)}
                                disabled={isBusy || idx === sortedRules.length - 1}
                                className="rounded-full border border-white/10 bg-white/0 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-40"
                                title="Niżej (mniejszy priorytet)"
                              >
                                ↓
                              </button>
                            </div>

                            {!isEditing ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => beginEditRule(r)}
                                  className="rounded-full border border-white/10 bg-white/0 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
                                >
                                  Edytuj
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => requestRemoveRule(r)}
                                  className="rounded-full border border-white/10 bg-white/0 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-rose-500/10 hover:text-rose-200 transition-colors disabled:opacity-50"
                                >
                                  Usuń
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => saveRule(r.id)}
                                  className="rounded-full border border-indigo-400/60 bg-indigo-500/30 px-2.5 py-1 text-[11px] text-indigo-100 hover:bg-indigo-500/40 transition-colors disabled:opacity-50"
                                >
                                  Zapisz
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditRule}
                                  className="rounded-full border border-white/10 bg-white/0 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/10 transition-colors"
                                >
                                  Anuluj
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 text-[10px] text-slate-500">
                Reguły działają automatycznie dla nowych importów. „Zastosuj teraz” ogarnia zaległości.
              </div>
            </div>
          </section>

          {/* Kategorie */}
          <section className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-1 hover:border-indigo-300/50 overflow-hidden">
            <div className="px-6 sm:px-7 pt-6 pb-5 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Kategorie</div>
              <h2 className="mt-1 text-sm font-semibold text-slate-50">Twoja mapa wydatków</h2>
              <p className="mt-1 text-[11px] text-slate-400 max-w-lg">
                Te kategorie są używane w Flow. Im lepsze kategorie, tym lepsze automatyzacje.
              </p>
            </div>

            <div className="p-6 sm:p-7 space-y-4">
              {catError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {catError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-indigo-300 animate-[pulse_6s_ease-in-out_infinite]" />
                  Szybkie filtrowanie
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">🔍</div>
                    <input
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Szukaj kategorii…"
                      className="h-9 w-48 rounded-full border border-white/10 bg-slate-900/70 pl-9 pr-3 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/70"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategorySearch("")}
                    className="rounded-full border border-white/10 bg-white/0 px-3 py-1 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
                  >
                    Wyczyść
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-colors">
                {/* naprawiony layout: button nie rozciąga się */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="np. Jedzenie, Transport…"
                      className="h-9 w-64 max-w-full rounded-full border border-white/10 bg-slate-900/70 px-3 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/70"
                    />
                    <input
                      type="color"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      className="h-9 w-12 rounded-full border border-white/10 bg-slate-900/70 p-1"
                      title="Kolor"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={createNewCategory}
                    disabled={catBusy === "create"}
                    className={[
                      "h-9 rounded-full px-3 text-[12px] font-medium whitespace-nowrap shrink-0",
                      catBusy === "create"
                        ? "border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed"
                        : "border border-indigo-400/60 bg-indigo-500/70 text-slate-950 hover:bg-indigo-400 transition-colors",
                    ].join(" ")}
                  >
                    {catBusy === "create" ? "Dodawanie…" : "Dodaj"}
                  </button>
                </div>

                <div className="mt-2 text-[10px] text-slate-500">
                  Tip: krótkie, stabilne nazwy = mniej chaosu w automatyzacji.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500 flex justify-between">
                  <span>Nazwa</span>
                  <span className="hidden sm:inline">Transakcje</span>
                </div>

                <div className="divide-y divide-white/10">
                  {filteredCats.map((c) => {
                    const count = catStats[c.id] ?? 0;
                    const isEditing = editingId === c.id;

                    return (
                      <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-white/20"
                            style={{ background: c.color ?? "rgba(255,255,255,0.18)" }}
                          />
                          {!isEditing ? (
                            <div className="min-w-0">
                              <div className="truncate text-[12px] text-slate-100">{c.name}</div>
                              <div className="text-[10px] text-slate-500 sm:hidden">
                                {count.toLocaleString("pl-PL")} transakcji
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 w-52 max-w-full rounded-full border border-white/10 bg-slate-900/70 px-3 text-[12px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/70"
                              />
                              <input
                                type="color"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="h-8 w-10 rounded-full border border-white/10 bg-slate-900/70 p-1"
                                title="Kolor"
                              />
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <div className="hidden sm:inline text-[11px] text-slate-400 w-24 text-right">
                            {count.toLocaleString("pl-PL")}
                          </div>

                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditCategory(c)}
                                className="rounded-full border border-white/10 bg-white/0 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
                              >
                                Edytuj
                              </button>
                              <button
                                type="button"
                                disabled={catBusy === c.id}
                                onClick={() => requestRemoveCategory(c)}
                                className="rounded-full border border-white/10 bg-white/0 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-rose-500/10 hover:text-rose-200 transition-colors disabled:opacity-50"
                              >
                                Usuń
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={catBusy === c.id}
                                onClick={() => saveEditCategory(c.id)}
                                className="rounded-full border border-indigo-400/60 bg-indigo-500/30 px-2.5 py-1 text-[11px] text-indigo-100 hover:bg-indigo-500/40 transition-colors disabled:opacity-50"
                              >
                                Zapisz
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditCategory}
                                className="rounded-full border border-white/10 bg-white/0 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/10 transition-colors"
                              >
                                Anuluj
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredCats.length === 0 && (
                    <div className="px-4 py-4 text-[11px] text-slate-400">
                      {sortedCats.length === 0
                        ? "Brak kategorii. Dodaj pierwszą powyżej."
                        : "Nic nie znaleziono — spróbuj innego hasła lub wyczyść filtr."}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-500">
                Zmiany widzisz od razu w Flow. Sugestie automatyzacji pojawiają się, gdy przypisujesz kategorie ręcznie.
              </div>
            </div>
          </section>
        </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-6">
            <section
              id="ai"
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/75 via-slate-950/65 to-slate-900/60 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-1 hover:border-indigo-300/50 overflow-hidden"
            >
            <div className="absolute -top-12 left-16 h-28 w-28 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-emerald-500/12 blur-3xl" />
            <div className="absolute inset-0 opacity-50 bg-[linear-gradient(135deg,rgba(79,70,229,0.08),transparent_40%),linear-gradient(225deg,rgba(16,185,129,0.08),transparent_42%)]" />
            <div className="px-6 sm:px-7 pt-6 pb-5 border-b border-white/10">
            <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              AI Assistant
              <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-300">
                learning
              </span>
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Ten moduł uczy się Twoich decyzji i podpowiada automatyzacje w tle.
              Bez technicznego gadania — po prostu „Włącz” i działa.
            </p>
          </div>

          <div className="p-6 sm:p-7 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <MiniStat label="Pokrycie kategorii" value={data ? `${coveragePct.toFixed(2)}%` : "—"} />
              <MiniStat label="Manualne decyzje" value={data ? `${data.assignments_manual}` : "—"} />
              <MiniStat label="Automatyzacje" value={data ? `${data.assignments_rule}` : "—"} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-slate-300">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-300 animate-[pulse-ring_5s_ease-in-out_infinite]" />
                Sugestie AI: priorytetyzuj według
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-white/10 bg-slate-900/60 p-1 text-[11px] text-slate-200">
                  <button
                    type="button"
                    onClick={() => setSuggestionSort("potential")}
                    className={[
                      "px-3 py-1 rounded-full",
                      suggestionSort === "potential"
                        ? "bg-indigo-500/80 text-slate-950 shadow"
                        : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    Do automatyzacji
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestionSort("manual")}
                    className={[
                      "px-3 py-1 rounded-full",
                      suggestionSort === "manual"
                        ? "bg-indigo-500/80 text-slate-950 shadow"
                        : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    Ręcznych decyzji
                  </button>
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">🔎</div>
                  <input
                    value={suggestionQuery}
                    onChange={(e) => setSuggestionQuery(e.target.value)}
                    placeholder="Filtruj sugestie…"
                    className="h-9 w-44 rounded-full border border-white/10 bg-slate-900/70 pl-9 pr-3 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/70"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSuggestionsCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {suggestionsCollapsed ? "Pokaż listę" : "Tryb skupienia"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[11px] text-slate-400">
                Ładowanie modułu AI…
              </div>
            ) : !data || !hasSuggestions ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[11px] text-slate-400 space-y-2">
                <div className="text-slate-200 font-medium">Tryb uczenia</div>
                <div>
                  Na razie nie mam pewnych sugestii. Najszybciej „nauczysz” system,
                  ustawiając kategorie ręcznie dla kilku powtarzalnych sklepów/usług.
                </div>
                <div className="pt-1">
                  <Link
                    href="/flow"
                    className="inline-flex items-center rounded-full border border-indigo-400/50 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-medium text-indigo-100 hover:bg-indigo-500/25 transition-colors"
                  >
                    Przejdź do Flow
                  </Link>
                </div>
              </div>
            ) : suggestionsCollapsed ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[11px] text-slate-300 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-slate-100 font-medium">Tryb skupienia</div>
                  <div className="text-slate-400">
                    Lista sugestii została zwinięta. Otwórz ją, gdy chcesz przejrzeć rekomendacje.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSuggestionsCollapsed(false)}
                  className="rounded-full border border-indigo-400/60 bg-indigo-500/20 px-3 py-1 text-[11px] text-indigo-100 hover:bg-indigo-500/30"
                >
                  Otwórz
                </button>
              </div>
            ) : !hasFilteredSuggestions ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[11px] text-slate-300 space-y-1">
                <div className="text-slate-100 font-medium">Nic nie pasuje do filtra</div>
                <div className="text-slate-400">
                  Spróbuj innego hasła lub wyczyść filtr, aby zobaczyć wszystkie podpowiedzi AI.
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setSuggestionQuery("")}
                    className="rounded-full border border-white/10 bg-white/0 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    Wyczyść filtr
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedSuggestions.map((s) => {
                  const isBusy = busyKey === s.suggestion_key;
                  const appliedMsg =
                    lastApplied && lastApplied.key === s.suggestion_key
                      ? `Gotowe · przypisano ${lastApplied.applied}`
                      : null;

                  return (
                    <div
                      key={s.suggestion_key}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10" />
                      <div className="min-w-0">
                        <div className="relative text-[11px] text-slate-200">
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 mr-2">
                            {suggestionSort === "manual" ? "Manualne" : "Największy potencjał"}
                          </span>
                          Wzorzec <span className="font-semibold text-indigo-200">{s.pattern_value}</span> →{" "}
                          <span className="text-slate-100">{s.category_name}</span>
                        </div>
                        <div className="relative mt-2 flex flex-col gap-1 text-[10px] text-slate-400">
                          <div className="flex items-center justify-between">
                            <span>Ręcznie: {s.manual_occurrences}</span>
                            <span>Do automatyzacji: {s.potential_matches}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
                              style={{
                                width: `${clampPct(
                                  ((s.potential_matches ?? 0) / Math.max(1, (s.potential_matches ?? 0) + (s.manual_occurrences ?? 0))) * 100
                                ).toFixed(0)}%`,
                              }}
                            />
                          </div>
                          {appliedMsg ? <span className="text-emerald-200/90">{appliedMsg}</span> : null}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <button
                          onClick={() => onEnableSuggestion(s)}
                          disabled={isBusy}
                          className="
                            rounded-full border border-indigo-400/60
                            bg-indigo-500/20 px-3 py-1 text-[11px] font-medium text-indigo-100
                            hover:bg-indigo-500/30 transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed
                          "
                        >
                          {isBusy ? "Włączanie…" : "Włącz"}
                        </button>

                        <button
                          onClick={() => onDismissSuggestion(s)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                          type="button"
                        >
                          Nie teraz
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
          </div>
        </div>

      {/* MODAL: Delete Category */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setDeleteModal(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/20 transition-colors p-5 shadow-2xl">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Usuwanie kategorii
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-50">
              {deleteModal.name}
            </div>

            <div className="mt-3 text-[12px] text-slate-300">
              Ta kategoria jest używana:
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-slate-500">Transakcje</div>
                  <div className="text-slate-50 font-semibold">{deleteModal.tx_count}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-slate-500">Automatyzacje</div>
                  <div className="text-slate-50 font-semibold">{deleteModal.rule_count}</div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-400">
                Jeśli usuniesz kategorię, system przywróci te transakcje do stanu „—”.
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {deleteModal.tx_count > 0 && (
                <button
                  className="rounded-full border border-indigo-400/60 bg-indigo-500/25 px-4 py-2 text-[12px] font-medium text-indigo-100 hover:bg-indigo-500/35 transition-colors"
                  onClick={() => confirmDeleteCategory(deleteModal.id, false)}
                  disabled={catBusy === deleteModal.id}
                >
                  Usuń i odłącz transakcje
                </button>
              )}

              {(deleteModal.tx_count > 0 || deleteModal.rule_count > 0) && (
                <button
                  className="rounded-full border border-rose-400/50 bg-rose-500/15 px-4 py-2 text-[12px] font-medium text-rose-100 hover:bg-rose-500/20 transition-colors"
                  onClick={() => confirmDeleteCategory(deleteModal.id, true)}
                  disabled={catBusy === deleteModal.id}
                >
                  Usuń + odłącz + usuń automatyzacje
                </button>
              )}

              <button
                className="rounded-full border border-white/10 bg-white/0 px-4 py-2 text-[12px] text-slate-300 hover:bg-white/10 transition-colors"
                onClick={() => setDeleteModal(null)}
              >
                Anuluj
              </button>

              <div className="pt-2 text-[10px] text-slate-500">
                Tip: jeśli chcesz zachować dane, zamiast usuwać — rozważ zmianę nazwy/koloru kategorii.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Rule */}
      {deleteRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setDeleteRuleModal(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/20 transition-colors p-5 shadow-2xl">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Usuwanie reguły
            </div>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-colors text-[12px] text-slate-100">
              {deleteRuleModal.humanLine}
            </div>

            <div className="mt-3 text-[11px] text-slate-400">
              Po usunięciu reguły system cofnie przypisania kategorii, które wynikały z tej reguły
              (transakcje wrócą do „—”).
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                className="rounded-full border border-rose-400/50 bg-rose-500/15 px-4 py-2 text-[12px] font-medium text-rose-100 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                onClick={() => confirmRemoveRule(deleteRuleModal.id)}
                disabled={rulesBusyId === "delete"}
              >
                {rulesBusyId === "delete" ? "Usuwanie…" : "Usuń regułę"}
              </button>

              <button
                className="rounded-full border border-white/10 bg-white/0 px-4 py-2 text-[12px] text-slate-300 hover:bg-white/10 transition-colors"
                onClick={() => setDeleteRuleModal(null)}
                disabled={rulesBusyId === "delete"}
              >
                Anuluj
              </button>

              <div className="pt-2 text-[10px] text-slate-500">
                Tip: jeśli reguła była dobra, ale zbyt szeroka — edytuj ją zamiast usuwać.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 hover:border-indigo-300/40 transition-all">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-indigo-500/10 via-slate-900/0 to-emerald-500/10" />
      <div className="relative text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="relative mt-1 text-[14px] font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function MiniKpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/60 hover:shadow-xl hover:shadow-indigo-500/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(129,140,248,0.16),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.16),transparent_45%)]" />
      <div className="absolute -bottom-6 -right-6 h-16 w-16 rounded-full border border-indigo-300/30" />
      <div className="relative text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="relative mt-1 text-[16px] font-semibold text-slate-50">{value}</div>
      <div className="relative mt-0.5 text-[10px] text-slate-500">{hint}</div>
    </div>
  );
}

function HeroStat({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/50">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-indigo-500/15 to-emerald-500/15 transition-opacity" />
      <div className="relative text-[10px] uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="relative mt-1 text-[15px] font-semibold text-slate-50">{value}</div>
      <div className="relative mt-0.5 text-[10px] text-slate-400">{detail}</div>
    </div>
  );
}

function BadgePill({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-2 text-left text-[11px] text-slate-200 transition-all hover:border-indigo-300/50 hover:bg-indigo-500/10">
      <span className="h-2 w-2 rounded-full bg-gradient-to-br from-indigo-300 to-emerald-300 shadow-[0_0_0_4px_rgba(99,102,241,0.15)]" />
      <div className="leading-tight">
        <div className="font-medium text-slate-50">{label}</div>
        <div className="text-[10px] text-slate-400">{desc}</div>
      </div>
    </div>
  );
}

function CoverageGauge({
  value,
  total,
  categorized,
  uncategorized,
}: {
  value: number;
  total: number;
  categorized: number;
  uncategorized: number;
}) {
  const pct = clampPct(value ?? 0);
  const uncategorizedPct = clampPct((uncategorized / Math.max(1, total)) * 100);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/85 via-slate-950/70 to-slate-900/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="absolute -top-10 -left-6 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute -bottom-16 right-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-center gap-5 sm:gap-6">
        <div className="relative h-36 w-36 shrink-0">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.06),transparent_60%)]" />
          <div
            className="relative h-full w-full rounded-full border border-white/10 bg-slate-950/70 shadow-inner"
            style={{
              background: `conic-gradient(from 180deg, rgba(129,140,248,0.75) ${pct}%, rgba(255,255,255,0.08) ${pct}% 100%)`,
            }}
          >
            <div className="absolute inset-3 rounded-full border border-white/5 bg-slate-950/80 flex flex-col items-center justify-center text-center">
              <div className="text-[12px] text-slate-400">Pokrycie</div>
              <div className="text-lg font-semibold text-slate-50">{Number.isFinite(pct) ? pct.toFixed(1) : "—"}%</div>
              <div className="text-[10px] text-slate-500">{categorized}/{total}</div>
            </div>
          </div>
          <div className="absolute -inset-1 rounded-full border border-indigo-400/20 opacity-60 animate-[spin_16s_linear_infinite]" />
        </div>

        <div className="flex-1 space-y-3 text-[11px] text-slate-300">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <span>Status danych</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
              {total === 0 ? "czeka" : "aktywny"}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Pokryte kategorie</span>
              <span className="text-slate-100">{categorized.toLocaleString("pl-PL")}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all"
                style={{ width: `${pct.toFixed(0)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Do przejrzenia</span>
              <span className="text-amber-200">{uncategorized.toLocaleString("pl-PL")}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-200 to-transparent transition-all"
                style={{ width: `${uncategorizedPct.toFixed(0)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-slate-400">
            <div className="flex items-center justify-between text-slate-300">
              <span>Łącznie rekordów</span>
              <span className="text-slate-100">{total.toLocaleString("pl-PL")}</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">Sugestie AI priorytetyzują brakujące kategorie.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
