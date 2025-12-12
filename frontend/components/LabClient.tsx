"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchLabInsights,
  enableLabRule,
  LabInsights,
  LabSuggestion,
} from "@/lib/serverApi";

const DISMISSED_KEY = "flowparser.dismissed_suggestions.v1";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

export function LabClient() {
  const [data, setData] = useState<LabInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<{ key: string; applied: number } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchLabInsights();
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleSuggestions = useMemo(() => {
    if (!data) return [];
    return data.suggestions.filter((s) => !dismissed.has(s.suggestion_key));
  }, [data, dismissed]);

  const onEnable = async (s: LabSuggestion) => {
    setBusyKey(s.suggestion_key);
    setLastApplied(null);
    try {
      const res = await enableLabRule({
        pattern_value: s.pattern_value,
        pattern_type: s.pattern_type,
        category_id: s.category_id,
      });
      setLastApplied({ key: s.suggestion_key, applied: res.applied });
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  const onDismiss = (s: LabSuggestion) => {
    const next = new Set(dismissed);
    next.add(s.suggestion_key);
    setDismissed(next);
    writeDismissed(next);
  };

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/50 backdrop-blur-xl p-6 text-[12px] text-slate-400">
        Ładowanie modułu AI…
      </section>
    );
  }

  if (!data) return null;

  const categorized = data.coverage_categorized;
  const total = data.coverage_total;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 backdrop-blur-xl overflow-hidden">
      <div className="px-6 sm:px-7 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              AI Assistant
              <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-300">
                learning
              </span>
            </h2>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xl">
              Ten moduł uczy się Twoich decyzji i podpowiada automatyzacje w tle.
              Bez technicznego gadania — po prostu „włącz” i działa.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-7 space-y-4">
        {/* Staty */}
        <div className="grid gap-3 md:grid-cols-3">
          <MiniStat label="Pokrycie kategorii" value={`${data.coverage_pct}%`} />
          <MiniStat label="Manualne decyzje" value={`${data.assignments_manual}`} />
          <MiniStat label="Automatyzacje" value={`${data.assignments_rule}`} />
        </div>

        {/* Progress */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Postęp rozumienia Twoich wydatków</span>
            <span className="text-slate-200">
              {categorized}/{total}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 via-sky-400/70 to-emerald-400/70"
              style={{ width: `${Math.min(100, Math.max(0, data.coverage_pct))}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            Tip: przypisz kilka kategorii ręcznie w Flow — wtedy pojawią się konkretne sugestie automatyzacji.
          </div>
        </div>

        {/* Sugestie */}
        {visibleSuggestions.length === 0 ? (
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
                Przejdź do Flow i przypisz kilka kategorii
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
                      <span className="font-semibold text-indigo-200">
                        {s.pattern_value}
                      </span>{" "}
                      → <span className="text-slate-100">{s.category_name}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      Ręcznie: {s.manual_occurrences} · Do automatyzacji: {s.potential_matches}
                      {appliedMsg ? (
                        <span className="ml-2 text-emerald-200/90">{appliedMsg}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <button
                      onClick={() => onEnable(s)}
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
                      onClick={() => onDismiss(s)}
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
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-slate-50">{value}</div>
    </div>
  );
}
