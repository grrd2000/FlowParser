"use client";

import React from "react";
import { useEffect, useState } from "react";

import {
  Category,
  CategoryRule,
  fetchCategories,
  fetchCategoryRules,
  createCategoryRule,
  applyCategoryRules,
} from "@/lib/serverApi";

import { LabClient } from "@/components/LabClient";

export default function LabPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");
  const [patternValue, setPatternValue] = useState("");
  const [patternType, setPatternType] = useState<"contains" | "startswith">(
    "contains"
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cats, rls] = await Promise.all([
          fetchCategories(),
          fetchCategoryRules(),
        ]);
        setCategories(cats);
        setRules(rls);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Nie udało się pobrać danych do Lab.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfo(null);

    if (!selectedCategoryId || !patternValue.trim()) {
      setError("Wybierz kategorię i wpisz wzorzec.");
      return;
    }

    setSavingRule(true);
    setError(null);

    try {
      const rule = await createCategoryRule({
        category_id: Number(selectedCategoryId),
        pattern_value: patternValue.trim(),
        pattern_type: patternType,
      });
      setRules((prev) => [...prev, rule]);
      setPatternValue("");
      setInfo("Nowa reguła została zapisana.");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Nie udało się utworzyć reguły.");
    } finally {
      setSavingRule(false);
    }
  };

  const handleApplyRules = async () => {
    setApplying(true);
    setError(null);
    setInfo(null);
    try {
      const res = await applyCategoryRules();
      setInfo(`Zastosowano reguły do ${res.assigned} transakcji.`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Nie udało się zastosować reguł.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col gap-6">
      {/* Header labu */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
          Lab
        </h1>
        <p className="text-sm md:text-[13px] text-slate-400 max-w-xl">
          Inteligentna warstwa Twojej aplikacji finansowej. Tutaj uczysz system,
          a system później pomaga Tobie – reguły, automatyczne kategorie i w
          przyszłości &bdquo;AI asystent&rdquo; dla Twoich wydatków.
        </p>
      </div>

      {/* Grid: lewo (rules) + prawo (AI Assistant) */}
      <div className="grid gap-6 xl:grid-cols-[1.25fr,1fr]">
        {/* Lewa kolumna: overview + rules */}
        <div className="flex flex-col gap-6">
          {/* Smart Overview (na razie statyczne, możesz potem spiąć z /lab/insights) */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50 bg-gradient-to-br from-slate-900/60 via-slate-900/30 to-slate-900/60 shadow-[0_0_0_1px_rgba(15,23,42,0.7)] backdrop-blur-xl">
            <div className="absolute -top-16 -right-20 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-24 h-40 w-40 rounded-full bg-pink-500/10 blur-3xl" />

            <div className="relative px-5 sm:px-7 pt-5 sm:pt-6 pb-5 sm:pb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-medium text-slate-100 flex items-center gap-2">
                    Smart overview
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                      beta
                    </span>
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-md">
                    W skrócie: jak bardzo Twoje finanse są już &bdquo;ogarnięte&rdquo;
                    przez automatyczne reguły i inteligentne kategorie.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-[11px] sm:text-xs">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
                  <div className="text-slate-500 mb-1">Pokrycie kategorii</div>
                  <div className="text-lg font-semibold text-slate-50">—</div>
                  <div className="text-[10px] text-slate-500">
                    Docelowo: ile % transakcji ma sensowną kategorię
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
                  <div className="text-slate-500 mb-1">
                    Automatyczne przypisania
                  </div>
                  <div className="text-lg font-semibold text-slate-50">—</div>
                  <div className="text-[10px] text-slate-500">
                    Reguły + AI vs ręczne przypisania
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
                  <div className="text-slate-500 mb-1">Do przejrzenia</div>
                  <div className="text-lg font-semibold text-slate-50">—</div>
                  <div className="text-[10px] text-slate-500">
                    Transakcje, gdzie system nie jest pewny
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Smart Rules */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 shadow-[0_0_0_1px_rgba(15,23,42,0.7)] backdrop-blur-xl">
            <div className="absolute -top-10 left-10 h-24 w-24 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="absolute -bottom-16 right-0 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative px-5 sm:px-7 pt-5 sm:pt-6 pb-5 sm:pb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-medium text-slate-100 flex items-center gap-2">
                    Smart rules
                    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300">
                      automatyczne zasady kategoryzacji
                    </span>
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-md">
                    Definiuj reguły typu
                    &bdquo;jeśli opis zawiera BIEDRONKA → kategoria Jedzenie&rdquo;.
                    System zastosuje je do nowych i istniejących transakcji.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleApplyRules}
                  disabled={applying || loading}
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium",
                    applying || loading
                      ? "border-slate-700 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                      : "border-indigo-500/70 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25 transition-colors",
                  ].join(" ")}
                >
                  {applying ? "Zastosowywanie..." : "Zastosuj reguły"}
                </button>
              </div>

              {error && (
                <div className="mb-2 rounded-md bg-rose-500/10 border border-rose-500/40 px-3 py-1.5 text-[11px] text-rose-200">
                  {error}
                </div>
              )}

              {info && (
                <div className="mb-2 rounded-md bg-emerald-500/10 border border-emerald-500/40 px-3 py-1.5 text-[11px] text-emerald-200">
                  {info}
                </div>
              )}

              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)]">
                {/* Lista reguł */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 min-h-[120px]">
                  {loading && (
                    <div className="text-[11px] text-slate-400">
                      Ładowanie reguł...
                    </div>
                  )}

                  {!loading && rules.length === 0 && (
                    <div className="text-[11px] text-slate-500">
                      Nie masz jeszcze żadnych reguł. Dodaj pierwszą po prawej
                      stronie, a system zacznie automatycznie przypisywać
                      kategorie.
                    </div>
                  )}

                  {!loading && rules.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px]">
                        <thead>
                          <tr className="text-slate-400 text-[10px] uppercase tracking-[0.16em]">
                            <th className="py-2 pr-4 text-left">Kategoria</th>
                            <th className="py-2 pr-4 text-left">Wzorzec</th>
                            <th className="py-2 pr-4 text-left">Typ</th>
                            <th className="py-2 pr-2 text-right">Priorytet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map((rule) => {
                            const cat = categories.find(
                              (c) => c.id === rule.category_id
                            );
                            return (
                              <tr
                                key={rule.id}
                                className="border-t border-slate-800/80 hover:bg-slate-900/80 transition-colors"
                              >
                                <td className="py-2 pr-4 align-middle">
                                  <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full mr-1.5"
                                      style={{
                                        backgroundColor:
                                          cat?.color ?? "#a5b4fc",
                                      }}
                                    />
                                    <span className="text-[11px] text-slate-100">
                                      {cat?.name ?? "?"}
                                    </span>
                                  </span>
                                </td>
                                <td className="py-2 pr-4 align-middle text-slate-100">
                                  {rule.pattern_value}
                                </td>
                                <td className="py-2 pr-4 align-middle text-slate-400">
                                  {rule.pattern_type === "contains"
                                    ? "zawiera"
                                    : rule.pattern_type === "startswith"
                                    ? "zaczyna się od"
                                    : rule.pattern_type}
                                </td>
                                <td className="py-2 pr-2 align-middle text-right text-slate-500">
                                  {rule.priority}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Formularz dodania reguły */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                  <h3 className="text-[12px] font-medium text-slate-100 mb-1.5">
                    Dodaj nową regułę
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-3">
                    Reguła będzie stosowana do opisu transakcji. Im prostsze
                    zasady, tym łatwiej utrzymać porządek.
                  </p>

                  <form
                    onSubmit={handleCreateRule}
                    className="space-y-3 text-[11px]"
                  >
                    <div className="space-y-1">
                      <label className="text-slate-400">Kategoria</label>
                      <select
                        className="w-full rounded-full bg-slate-950/60 border border-slate-700/70 px-3 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/80"
                        value={selectedCategoryId}
                        onChange={(e) =>
                          setSelectedCategoryId(
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                          )
                        }
                      >
                        <option value="">— wybierz kategorię —</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">
                        Wzorzec w opisie transakcji
                      </label>
                      <input
                        className="w-full rounded-full bg-slate-950/60 border border-slate-700/70 px-3 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/80"
                        placeholder='np. "BIEDRONKA", "SPOTIFY"'
                        value={patternValue}
                        onChange={(e) => setPatternValue(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">Typ dopasowania</label>
                      <div className="inline-flex rounded-full bg-slate-900/70 border border-slate-700/70 p-1">
                        <button
                          type="button"
                          onClick={() => setPatternType("contains")}
                          className={[
                            "px-3 py-1 text-[11px] rounded-full",
                            patternType === "contains"
                              ? "bg-white text-slate-900"
                              : "text-slate-300",
                          ].join(" ")}
                        >
                          zawiera
                        </button>
                        <button
                          type="button"
                          onClick={() => setPatternType("startswith")}
                          className={[
                            "px-3 py-1 text-[11px] rounded-full",
                            patternType === "startswith"
                              ? "bg-white text-slate-900"
                              : "text-slate-300",
                          ].join(" ")}
                        >
                          zaczyna się od
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={savingRule}
                        className={[
                          "w-full inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-medium",
                          savingRule
                            ? "bg-white/10 text-slate-400 cursor-not-allowed"
                            : "bg-indigo-500/90 text-slate-950 hover:bg-indigo-400",
                        ].join(" ")}
                      >
                        {savingRule ? "Zapisywanie..." : "Zapisz regułę"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Prawa kolumna: AI Assistant (LabClient) */}
        <div className="flex flex-col gap-6">
          <LabClient />
        </div>
      </div>
    </div>
  );
}
