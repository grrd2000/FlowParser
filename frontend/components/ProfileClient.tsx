"use client";

import { useState } from "react";
import Link from "next/link";
import { updateUserProfile, type UserProfile } from "@/lib/serverApi";

type RangeKey = "1m" | "3m" | "6m" | "ytd" | "all";
type Granularity = "day" | "week" | "month" | "quarter";
type Currency = "PLN" | "EUR" | "USD";

type ProfileClientProps = {
  initialProfile: UserProfile | null;
};

export function ProfileClient({ initialProfile }: ProfileClientProps) {
  const hasProfile = Boolean(initialProfile);
  const safeProfile =
    initialProfile ??
    ({
      id: 0,
      name: "",
      email: "",
      currency: "PLN",
      default_range: "3m",
      default_granularity: "month",
      theme: "dark",
    } satisfies UserProfile);

  // dane użytkownika
  const [name, setName] = useState(safeProfile.name);
  const [email, setEmail] = useState(safeProfile.email);

  // walutę trzymamy tylko na potrzeby payloadu – UI już jej nie edytuje
  const [currency] = useState<Currency>(
    (safeProfile.currency as Currency) ?? "PLN"
  );

  // preferencje
  const [defaultRange, setDefaultRange] = useState<RangeKey>(
    (safeProfile.default_range as RangeKey) ?? "3m"
  );
  const [defaultGranularity, setDefaultGranularity] =
    useState<Granularity>(
      (safeProfile.default_granularity as Granularity) ?? "month"
    );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const avatarInitials =
    name && name.trim().length > 0
      ? name
          .trim()
          .split(" ")
          .map((p) => p[0]?.toUpperCase())
          .slice(0, 2)
          .join("")
      : "U";

  const handleSave = async () => {
    if (!hasProfile) {
      console.warn("Brak aktywnej sesji – nie można zapisać profilu.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name,
        email,
        currency, // nadal wysyłamy, ale nie edytujemy w UI
        default_range: defaultRange,
        default_granularity: defaultGranularity,
        theme: "dark",
      };

      await updateUserProfile(payload);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-lg shadow-black/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-indigo-900/30">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/40 via-transparent to-emerald-800/30 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-60 pointer-events-none">
          <div className="absolute -left-10 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.5),transparent_60%)] blur-3xl animate-[glow-wave_14s_ease-in-out_infinite]" />
          <div className="absolute -right-8 bottom-0 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.5),transparent_60%)] blur-3xl animate-[glow-wave_14s_ease-in-out_infinite]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-indigo-500/50 bg-gradient-to-br from-indigo-500/30 via-slate-900 to-emerald-500/30 shadow-[0_10px_40px_-20px_rgba(99,102,241,1)]">
              <div className="absolute inset-px rounded-xl bg-slate-950/70" />
              <div className="absolute inset-0 rounded-2xl border border-indigo-400/40 opacity-60 blur-xl" />
              <div className="absolute inset-0 rounded-2xl border border-indigo-500/20 animate-[pulse-ring_5s_ease-in-out_infinite]" />
              <div className="relative flex h-full w-full items-center justify-center text-lg font-semibold text-indigo-100">
                {avatarInitials}
              </div>
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Profil lokalny
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-slate-50">Profile</h1>
                <p className="text-sm text-slate-400">
                  Lekki, minimalistyczny widok spójny z Accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="grid w-full max-w-xl grid-cols-2 gap-3 text-xs text-slate-300 sm:text-sm">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-inner shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-indigo-900/20">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-slate-900/30" />
              <div className="relative flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-200/80">Imię / nick</p>
                  <p className="text-sm font-semibold text-slate-50">{name || "Nie ustawiono"}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  Edytowalne
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-inner shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-emerald-900/15">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/40 via-transparent to-emerald-500/20" />
              <div className="relative flex flex-col gap-1">
                <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-200/80">Status profilu</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {hasProfile ? "Połączony" : "Offline"}
                  </span>
                  {savedAt && (
                    <span className="text-[11px] text-slate-400">
                      Zapisano {savedAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!hasProfile && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-900/30">
          Brak danych profilu. Zaloguj się, aby zobaczyć i edytować swoje ustawienia.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.65fr)]">
        <div className="space-y-4">
          <section className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/50 p-5 shadow-md shadow-black/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-indigo-900/20">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/10" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-200">
                  Dane użytkownika
                </div>
                <p className="text-xs text-slate-400">
                  Uzupełnij swój podpis w aplikacji i dane kontaktowe.
                </p>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-400">
                Lokalnie przechowywane
              </span>
            </div>

            <div className="relative mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <label className="text-xs text-slate-400">Imię / nick</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:bg-slate-900/70 focus:shadow-[0_10px_30px_-18px_rgba(99,102,241,0.7)] hover:border-indigo-400/40 hover:bg-slate-900/70"
                  placeholder="Twoje imię"
                />
              </div>
              <div className="space-y-2 text-sm">
                <label className="text-xs text-slate-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:bg-slate-900/70 focus:shadow-[0_10px_30px_-18px_rgba(99,102,241,0.7)] hover:border-indigo-400/40 hover:bg-slate-900/70"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="relative mt-4 grid gap-3 sm:grid-cols-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Dane nie opuszczają Twojej sesji aplikacyjnej.
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                Podgląd synchronizuje się z preferencjami widoków.
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <Link
              href="/profile/accounts"
              className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-indigo-500/20 via-slate-950/80 to-slate-900/70 p-4 transition duration-200 hover:-translate-y-1 hover:border-indigo-400/60 hover:shadow-xl hover:shadow-indigo-500/20"
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-emerald-400/10" />
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-200">Accounts</p>
                  <p className="text-sm text-slate-300">
                    Zarządzaj podłączonymi rachunkami i historią importów.
                  </p>
                </div>
                <span className="text-lg text-indigo-200 transition-transform group-hover:translate-x-1">→</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-100">
                Minimalistyczny widok kart kont
              </div>
            </Link>

            <Link
              href="/profile/statements"
              className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-emerald-500/20 via-slate-950/80 to-slate-900/70 p-4 transition duration-200 hover:-translate-y-1 hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-500/15"
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-indigo-400/10" />
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-emerald-200">Statements</p>
                  <p className="text-sm text-slate-300">
                    Przeglądaj wyciągi, statusy importu i zakresy dat.
                  </p>
                </div>
                <span className="text-lg text-emerald-200 transition-transform group-hover:translate-x-1">→</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-100">
                Mikrointerakcje i timeline statusów
              </div>
            </Link>
          </section>
        </div>

        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-md shadow-black/30">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-transparent to-indigo-500/10" />
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-50">Preferencje widoku</h2>
                <p className="text-sm text-slate-400">
                  Dashboard i Flow startują zgodnie z tymi ustawieniami.
                </p>
              </div>
              {savedAt ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Zapisano {savedAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  Niezapisane zmiany
                </div>
              )}
            </div>

            <div className="relative mt-6 space-y-6 text-sm">
              <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Domyślny zakres czasowy</span>
                  <span className="text-[11px] text-slate-500">Używany w Dashboard i Flow</span>
                </div>
                <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/80 p-0.5 text-[11px] shadow-inner shadow-black/30">
                  {(
                    [
                      ["1m", "1 mies."],
                      ["3m", "3 mies."],
                      ["6m", "6 mies."],
                      ["ytd", "YTD"],
                      ["all", "Wszystko"],
                    ] as [RangeKey, string][]
                  ).map(([value, label]) => {
                    const active = defaultRange === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDefaultRange(value)}
                        className={[
                          "px-3 py-1 rounded-full transition-all duration-150",
                          active
                            ? "bg-indigo-500 text-slate-50 shadow-[0_10px_30px_-18px_rgba(99,102,241,1)]"
                            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 hover:-translate-y-0.5",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Domyślna granulacja wykresów</span>
                  <span className="text-[11px] text-slate-500">Wpływa na oś czasu</span>
                </div>
                <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/80 p-0.5 text-[11px] shadow-inner shadow-black/30">
                  {(
                    [
                      ["day", "Dzień"],
                      ["week", "Tydzień"],
                      ["month", "Miesiąc"],
                      ["quarter", "Kwartał"],
                    ] as [Granularity, string][]
                  ).map(([value, label]) => {
                    const active = defaultGranularity === value;
                    return (
                      <button
                      key={value}
                      type="button"
                      onClick={() => setDefaultGranularity(value)}
                      className={[
                        "px-3 py-1 rounded-full transition-all duration-150",
                        active
                          ? "bg-indigo-500 text-slate-50 shadow-[0_10px_30px_-18px_rgba(99,102,241,1)]"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 hover:-translate-y-0.5",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Tryb interfejsu</span>
                  <span className="text-[11px] text-slate-500">Spójny z całą aplikacją</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                  <button
                    type="button"
                    className="group relative flex items-center justify-between gap-3 rounded-xl border border-indigo-400/60 bg-indigo-500/20 px-4 py-3 text-indigo-100 shadow-inner shadow-indigo-900/40 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-indigo-800/40"
                  >
                    <div className="space-y-0.5 text-left">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-200">Dark</p>
                      <p className="text-sm text-indigo-50">Aktywny, dopasowany do Accounts</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                      On
                    </span>
                  </button>
                  <button
                    type="button"
                    className="relative flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-500 transition-transform duration-200 hover:-translate-y-0.5 hover:border-slate-700"
                    disabled
                  >
                    <div className="space-y-0.5 text-left">
                      <p className="text-[11px] uppercase tracking-[0.08em]">Light</p>
                      <p className="text-sm">W przygotowaniu</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold">Soon</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-4 py-3 text-[11px] text-slate-400">
              <p>Preferencje zapisywane są w bazie i używane przy starcie widoków.</p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition",
                  saving
                    ? "cursor-not-allowed bg-slate-800 text-slate-400"
                    : "bg-emerald-500 text-slate-950 shadow-[0_10px_30px_-15px_rgba(16,185,129,0.8)] transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-[0_18px_35px_-18px_rgba(16,185,129,0.9)]",
                ].join(" ")}
              >
                {saving ? "Zapisywanie..." : "Zapisz zmiany"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
