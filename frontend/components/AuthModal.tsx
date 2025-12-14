"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function AuthModal({
  open,
  mode,
  onClose,
  onSwitchMode,
}: {
  open: boolean;
  mode: "login" | "register";
  onClose: () => void;
  onSwitchMode: (m: "login" | "register") => void;
}) {
  const { login, register } = useAuth();

  const title = mode === "login" ? "Zaloguj się" : "Załóż konto";
  const subtitle =
    mode === "login"
      ? "Zaloguj się, żeby zobaczyć swoje dane i zarządzać kategoriami."
      : "Załóż konto, żeby zacząć budować swój inteligentny budżet.";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) return false;
    if (!e.includes("@")) return false;
    if (p.length < 6) return false;
    if (mode === "register" && fullName.trim().length === 0) return false; // możesz poluzować
    return true;
  }, [email, password, fullName, mode]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "login") {
        await login(email.trim(), password.trim());
      } else {
        await register(email.trim(), password.trim(), fullName.trim());
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Nie udało się. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80]">
      {/* tło */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      {/* okno */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  FlowParser
                </div>
                <h2 className="mt-1 text-xl font-semibold text-slate-50 tracking-tight">
                  {title}
                </h2>
                <p className="mt-1 text-[12px] text-slate-400">
                  {subtitle}
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
              >
                Zamknij
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => onSwitchMode("login")}
                className={[
                  "px-4 py-1.5 text-[12px] rounded-full transition-all",
                  mode === "login"
                    ? "bg-white/85 text-slate-950 shadow"
                    : "text-slate-200/80 hover:text-slate-50",
                ].join(" ")}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode("register")}
                className={[
                  "px-4 py-1.5 text-[12px] rounded-full transition-all",
                  mode === "register"
                    ? "bg-white/85 text-slate-950 shadow"
                    : "text-slate-200/80 hover:text-slate-50",
                ].join(" ")}
              >
                Register
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[13px] text-slate-100 outline-none focus:ring-1 focus:ring-indigo-400/70"
                />
              </div>

              {mode === "register" && (
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Imię / Nazwa</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="np. Gerard"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[13px] text-slate-100 outline-none focus:ring-1 focus:ring-indigo-400/70"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Hasło</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min. 6 znaków"
                  type="password"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[13px] text-slate-100 outline-none focus:ring-1 focus:ring-indigo-400/70"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                  {error}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  {mode === "login" ? "Nie masz konta?" : "Masz już konto?"}{" "}
                  <button
                    type="button"
                    onClick={() => onSwitchMode(mode === "login" ? "register" : "login")}
                    className="text-indigo-200 hover:text-indigo-100 underline underline-offset-4"
                  >
                    {mode === "login" ? "Zarejestruj się" : "Zaloguj się"}
                  </button>
                </div>

                <button
                  disabled={!canSubmit || busy}
                  className={[
                    "rounded-full px-4 py-2 text-[12px] font-medium transition-all",
                    "border border-indigo-400/60",
                    "bg-indigo-500/75 text-slate-950 shadow-md shadow-indigo-500/30",
                    "hover:bg-indigo-400 hover:border-indigo-300",
                    (!canSubmit || busy) ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {busy ? "…" : mode === "login" ? "Zaloguj" : "Utwórz konto"}
                </button>
              </div>
            </form>

            <div className="mt-4 text-[10px] text-slate-500">
              Docelowo dodamy tutaj „Continue with Google” — architektura już jest pod to gotowa.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
