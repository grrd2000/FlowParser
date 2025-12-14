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

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-3xl border border-white/10",
        "bg-slate-950/45 backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.20)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function CardHeader({
  kicker,
  title,
  desc,
  right,
}: {
  kicker: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-6 sm:px-7 pt-6 pb-5 border-b border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {kicker}
          </div>
          <h2 className="mt-1 text-sm font-semibold text-slate-50">
            {title}
          </h2>
          {desc && (
            <p className="mt-1 text-[11px] text-slate-400 max-w-xl">
              {desc}
            </p>
          )}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

function PillButton({
  children,
  onClick,
  disabled,
  tone = "neutral",
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "success" | "danger";
  title?: string;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors border";
  const styles =
    tone === "primary"
      ? "border-indigo-400/60 bg-indigo-500/65 text-slate-950 hover:bg-indigo-400"
      : tone === "success"
        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
        : tone === "danger"
          ? "border-rose-400/50 bg-rose-500/15 text-rose-100 hover:bg-rose-500/20"
          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        base,
        styles,
        disabled ? "opacity-50 cursor-not-allowed hover:bg-inherit" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  // ✅ naprawiony toggle: gdy checked=false, kółko wraca w LEWO
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={[
        "relative h-6 w-10 rounded-full border transition-colors",
        checked
          ? "border-emerald-400/40 bg-emerald-500/15"
          : "border-white/10 bg-black/20",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10",
      ].join(" ")}
      aria-label={label ?? "toggle"}
    >
      <span
        className={[
          "absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full",
          "transition-transform duration-200",
          checked ? "translate-x-5 bg-emerald-200" : "translate-x-1 bg-slate-400",
        ].join(" ")}
      />
    </button>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold text-slate-50">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function LabClient() {
  const [data, setData] = useState<LabInsights | null>(null);
  const [loading, setLoading] = useState(true);

  // AI suggestions
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<{ key: string; applied: number } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Categories
  const [cats, setCats] = useState<Category[]>([]);
  const [catStats, setCatStats] = useState<Record<number, number>>({});
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState<string>("#7c3aed");
  const [catError, setCatError] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState<number | "create" | null>(null);

  // Inline edit categories
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("#7c3aed");

  // Smart rules
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesBusyId, setRulesBusyId] = useState<number | "create" | "apply" | "reorder" | "delete" | null>(null);

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

  // Delete category modal (409 details)
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

  const { user, authLoading } = useAuth();

  if (!authLoading && !user) {
    return (
      <SignedOutState
        title="Lab"
        desc="Zaloguj się, aby tworzyć kategorie, reguły i budować inteligentne automatyzacje."
      />
    );
  }


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

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }, [rules]);

  const visibleSuggestions = useMemo(() => {
    if (!data) return [];
    return data.suggestions.filter((s) => !dismissed.has(s.suggestion_key));
  }, [data, dismissed]);

  const categorized = data?.coverage_categorized ?? 0;
  const total = data?.coverage_total ?? 0;
  const coveragePct = clampPct(data?.coverage_pct ?? 0);
  const uncategorized = Math.max(0, total - categorized);

  const loadAll = async () => {
    setLoading(true);
    setRulesLoading(true);
    setCatError(null);
    setRulesError(null);

    try {
      const [lab, categories, stats, ruleList] = await Promise.all([
        fetchLabInsights(),
        fetchCategories(),
        fetchCategoryStats(),
        fetchCategoryRules(),
      ]);

      setData(lab);
      setCats(categories);
      setCatStats(stats);
      setRules(ruleList);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Nie udało się pobrać danych.";
      setCatError(msg);
      setRulesError(msg);
    } finally {
      setLoading(false);
      setRulesLoading(false);
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
      setData(lab);
      setCats(categories);
      setCatStats(stats);
      setRules(ruleList);
    } catch (e) {
      console.warn("refreshAll failed:", e);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- AI suggestions ----------
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
        setCatError(`${detail.message} (tx: ${detail.tx_count ?? 0}, rules: ${detail.rule_count ?? 0})`);
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

  return (
    <div className="relative flex h-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
          Lab
        </h1>
        <p className="text-sm md:text-[13px] text-slate-400 max-w-2xl">
          Tu „uczysz” system: kategorie, automatyzacje i sugestie. Zero technicznego gadania —
          po prostu ustawiasz raz, a reszta działa w tle w Flow i przy kolejnych importach.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        {/* LEFT column */}
        <div className="flex flex-col gap-6">
          {/* Overview */}
          <GlassCard>
            <div className="pointer-events-none absolute -top-16 -right-24 h-44 w-44 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-24 h-44 w-44 rounded-full bg-pink-500/10 blur-3xl" />

            <CardHeader
              kicker="Smart overview"
              title="Jak dobrze system rozumie Twoje transakcje"
              desc="Szybkie KPI: pokrycie kategorii, automatyzacje i rzeczy do przejrzenia."
              right={
                <div className="hidden sm:flex items-center gap-2">
                  <PillButton
                    tone="neutral"
                    onClick={refreshAll}
                    disabled={loading}
                    title="Odśwież"
                  >
                    {loading ? "…" : "Odśwież"}
                  </PillButton>
                  <Link
                    href="/flow"
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    Otwórz Flow →
                  </Link>
                </div>
              }
            />

            <div className="px-6 sm:px-7 py-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat
                  label="Pokrycie kategorii"
                  value={data ? `${coveragePct.toFixed(2)}%` : "—"}
                  hint={data ? `${categorized}/${total}` : "—"}
                />
                <MiniStat
                  label="Automatyzacje"
                  value={data ? `${data.assignments_rule}` : "—"}
                  hint="reguły / AI"
                />
                <MiniStat
                  label="Do przejrzenia"
                  value={data ? `${uncategorized}` : "—"}
                  hint="bez kategorii"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
                  Najszybciej “uczysz” system, gdy przypisujesz kategorie w Flow dla powtarzalnych sklepów/usług.
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Rules */}
          <GlassCard>
            <div className="pointer-events-none absolute -top-10 left-10 h-24 w-24 rounded-full bg-indigo-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 right-0 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />

            <CardHeader
              kicker="Smart rules"
              title="Automatyczne reguły kategoryzacji"
              desc="Proste reguły typu „jeśli opis zawiera X → przypisz Y”. Działają automatycznie przy nowych importach."
              right={
                <div className="hidden sm:flex items-center gap-2">
                  <PillButton
                    tone="success"
                    onClick={applyRulesNow}
                    disabled={rulesBusyId === "apply"}
                    title="Zastosuj reguły do zaległych transakcji"
                  >
                    {rulesBusyId === "apply" ? "Stosowanie…" : "Zastosuj teraz"}
                  </PillButton>
                  <a
                    href="#ai"
                    className="inline-flex items-center rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-[11px] text-indigo-100 hover:bg-indigo-500/15 transition-colors"
                  >
                    Sugestie →
                  </a>
                </div>
              }
            />

            <div className="px-6 sm:px-7 py-6 space-y-4">
              {rulesError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {rulesError}
                </div>
              )}

              {/* Create */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

                  <PillButton
                    tone="primary"
                    onClick={createRule}
                    disabled={rulesBusyId === "create"}
                    className="h-9 px-4"
                  >
                    {rulesBusyId === "create" ? "Dodawanie…" : "Dodaj"}
                  </PillButton>
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
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500 flex items-center justify-between">
                  <span>Aktywne reguły</span>
                  <span className="text-[10px] text-slate-600">Kolejność = priorytet</span>
                </div>

                {rulesLoading ? (
                  <div className="px-4 py-4 text-[11px] text-slate-400">Ładowanie reguł…</div>
                ) : sortedRules.length === 0 ? (
                  <div className="px-4 py-4 text-[11px] text-slate-400">
                    Brak reguł. Dodaj własną automatyzację albo skorzystaj z sugestii AI.
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {sortedRules.map((r, idx) => {
                      const isEditing = editingRuleId === r.id;
                      const cat = catById.get(r.category_id);
                      const isBusy = rulesBusyId === r.id || rulesBusyId === "reorder" || rulesBusyId === "delete";

                      const humanLine = `Jeśli ${labelField(r.field)} ${labelPatternType(r.pattern_type)} „${r.pattern_value}” → ${cat?.name ?? "Kategoria"}`;

                      return (
                        <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Toggle
                                checked={!!r.enabled}
                                disabled={isBusy}
                                onChange={() => toggleRule(r)}
                                label="włącz/wyłącz regułę"
                              />

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

              <div className="text-[10px] text-slate-500">
                Reguły stosują się automatycznie dla nowych importów. „Zastosuj teraz” ogarnia zaległości.
              </div>
            </div>
          </GlassCard>

          {/* Categories */}
          <GlassCard>
            <CardHeader
              kicker="Categories"
              title="Kategorie (widoczne w Flow)"
              desc="Dodawaj i porządkuj kategorie. To one napędzają dashboard, filtrację i automatyzacje."
            />

            <div className="px-6 sm:px-7 py-6 space-y-4">
              {catError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {catError}
                </div>
              )}

              {/* Create category */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

                  <PillButton
                    tone="primary"
                    onClick={createNewCategory}
                    disabled={catBusy === "create"}
                    className="h-9 px-4"
                  >
                    {catBusy === "create" ? "Dodawanie…" : "Dodaj"}
                  </PillButton>
                </div>

                <div className="mt-2 text-[10px] text-slate-500">
                  Tip: krótkie, stabilne nazwy = mniej chaosu w automatyzacji.
                </div>
              </div>

              {/* List */}
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500 flex justify-between">
                  <span>Nazwa</span>
                  <span className="hidden sm:inline">Transakcje</span>
                </div>

                <div className="divide-y divide-white/10">
                  {sortedCats.map((c) => {
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

                  {sortedCats.length === 0 && (
                    <div className="px-4 py-4 text-[11px] text-slate-400">
                      Brak kategorii. Dodaj pierwszą powyżej.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT column: AI */}
        <GlassCard className="h-fit" >
          <CardHeader
            kicker="AI assistant"
            title="Sugestie automatyzacji"
            desc="To jest „cukierkowa” warstwa: Lab podpowiada, Ty klikasz „Włącz” i gotowe."
            right={
              <div className="hidden sm:flex items-center gap-2">
                <PillButton
                  tone="neutral"
                  onClick={refreshAll}
                  disabled={loading}
                >
                  {loading ? "…" : "Odśwież"}
                </PillButton>
              </div>
            }
          />

          <div id="ai" className="px-6 sm:px-7 py-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <MiniStat label="Pokrycie" value={data ? `${coveragePct.toFixed(2)}%` : "—"} />
              <MiniStat label="Manualne decyzje" value={data ? `${data.assignments_manual}` : "—"} />
              <MiniStat label="Automatyzacje" value={data ? `${data.assignments_rule}` : "—"} />
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[11px] text-slate-400">
                Ładowanie…
              </div>
            ) : !data || visibleSuggestions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[11px] text-slate-400 space-y-2">
                <div className="text-slate-200 font-medium">Tryb uczenia</div>
                <div>
                  Na razie nie mam pewnych sugestii. Ustaw kilka kategorii ręcznie w Flow
                  (np. Żabka, Biedronka, Uber), a sugestie zaczną się pojawiać.
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
            ) : (
              <div className="space-y-2">
                {visibleSuggestions.map((s) => {
                  const isBusy = busyKey === s.suggestion_key;
                  const appliedMsg =
                    lastApplied && lastApplied.key === s.suggestion_key
                      ? `Gotowe · przypisano ${lastApplied.applied}`
                      : null;

                  return (
                    <div
                      key={s.suggestion_key}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-200">
                          Wzorzec{" "}
                          <span className="font-semibold text-indigo-200">{s.pattern_value}</span>{" "}
                          → <span className="text-slate-100">{s.category_name}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Ręcznie: {s.manual_occurrences} · Do automatyzacji: {s.potential_matches}
                          {appliedMsg ? <span className="ml-2 text-emerald-200/90">{appliedMsg}</span> : null}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <PillButton
                          tone="primary"
                          onClick={() => onEnableSuggestion(s)}
                          disabled={isBusy}
                          className="px-4"
                        >
                          {isBusy ? "Włączanie…" : "Włącz"}
                        </PillButton>

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
        </GlassCard>
      </div>

      {/* MODAL: Delete Category */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setDeleteModal(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-5 shadow-2xl">
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
                Jeśli usuniesz kategorię, transakcje wrócą do „—”.
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {deleteModal.tx_count > 0 && (
                <PillButton
                  tone="primary"
                  onClick={() => confirmDeleteCategory(deleteModal.id, false)}
                  disabled={catBusy === deleteModal.id}
                  className="py-2"
                >
                  Usuń i odłącz transakcje
                </PillButton>
              )}

              <PillButton
                tone="danger"
                onClick={() => confirmDeleteCategory(deleteModal.id, true)}
                disabled={catBusy === deleteModal.id}
                className="py-2"
              >
                Usuń + odłącz + usuń automatyzacje
              </PillButton>

              <PillButton tone="neutral" onClick={() => setDeleteModal(null)} className="py-2">
                Anuluj
              </PillButton>

              <div className="pt-2 text-[10px] text-slate-500">
                Tip: zamiast usuwać — często lepiej zmienić nazwę/kolor.
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
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-5 shadow-2xl">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Usuwanie reguły
            </div>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-slate-100">
              {deleteRuleModal.humanLine}
            </div>

            <div className="mt-3 text-[11px] text-slate-400">
              Po usunięciu reguły system cofnie przypisania kategorii wynikające z tej reguły (wróci do „—”).
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <PillButton
                tone="danger"
                onClick={() => confirmRemoveRule(deleteRuleModal.id)}
                disabled={rulesBusyId === "delete"}
                className="py-2"
              >
                {rulesBusyId === "delete" ? "Usuwanie…" : "Usuń regułę"}
              </PillButton>

              <PillButton
                tone="neutral"
                onClick={() => setDeleteRuleModal(null)}
                disabled={rulesBusyId === "delete"}
                className="py-2"
              >
                Anuluj
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
