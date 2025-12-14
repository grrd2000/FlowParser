"use client";

import { useAuth } from "@/components/AuthProvider";

export function SignedOutState({
  title = "Zaloguj się, aby zobaczyć swoje dane",
  desc = "Twoje wyciągi, kategorie i reguły są prywatne. Zaloguj się lub załóż konto, żeby kontynuować.",
}: {
  title?: string;
  desc?: string;
}) {
  const { openAuth } = useAuth();

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 backdrop-blur-xl p-6 sm:p-8">
      <div className="max-w-xl space-y-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          FlowParser
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50 tracking-tight">
          {title}
        </h1>
        <p className="text-[13px] text-slate-400">{desc}</p>

        <div className="pt-3 flex items-center gap-2">
          <button
            onClick={() => openAuth("login")}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-slate-200 hover:bg-white/10 transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => openAuth("register")}
            className="rounded-full border border-indigo-400/70 bg-indigo-500/75 px-4 py-2 text-[12px] font-medium text-slate-950 shadow-md shadow-indigo-500/40 hover:bg-indigo-400 hover:border-indigo-300 transition-colors"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
