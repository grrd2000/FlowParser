"use client";

import Link from "next/link";
import { AccountSummary } from "@/lib/serverApi";
import { ReactNode, useMemo } from "react";

type Props = {
  accounts: AccountSummary[];
};

export function AccountsClient({ accounts }: Props) {
  const { totalTx, primaryCurrency, maxTx } = useMemo(() => {
    const totalTx = accounts.reduce(
      (sum, a) => sum + (a.transaction_count || 0),
      0
    );
    const cur =
      accounts.length > 0 ? accounts[0].currency ?? "PLN" : "PLN";
    const maxTx = Math.max(
      1,
      ...accounts.map((a) => a.transaction_count || 0)
    );

    return { totalTx, primaryCurrency: cur, maxTx };
  }, [accounts]);

  return (
    <div className="space-y-8">
      {/* Nagłówek */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-lg shadow-black/30">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-800/40 via-transparent to-emerald-700/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Podłączone konta finansowe
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-50">Accounts</h1>
              <p className="mt-1 text-sm text-slate-400">
                Lekki widok łączący wszystkie Twoje rachunki w jednym miejscu.
                Widzisz podsumowanie, transakcje i waluty bez nadmiaru danych.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Środowisko {primaryCurrency}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1">
                Minimalistyczny układ z mikrointerakcjami
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/import"
              className="group inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-100 shadow-[0_10px_40px_-22px_rgba(99,102,241,1)] transition hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-indigo-500/25"
            >
              Importuj wyciągi
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="/flow"
              className="inline-flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:-translate-y-0.5 hover:border-slate-700"
            >
              Przejdź do analizy
            </Link>
          </div>
        </div>
        <div className="relative mt-6 grid gap-4 sm:grid-cols-3 text-sm">
          <SummaryCard
            label="Liczba kont"
            value={accounts.length}
            helper="Każde konto może mieć inne wyciągi i waluty."
            accent="from-indigo-500/60 via-indigo-400/40 to-indigo-300/30"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-100">
                <path
                  fill="currentColor"
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a.5.5 0 0 1-.79.407L16 16.5l-3.21 2.407a.5.5 0 0 1-.58 0L9 16.5l-3.21 2.407A.5.5 0 0 1 5 18.5zm2.5-.5a.5.5 0 0 0-.5.5v10.382l2.71-2.033a.5.5 0 0 1 .58 0L12 16.75l2.71-2.033a.5.5 0 0 1 .58 0L18 16.382V5.5a.5.5 0 0 0-.5-.5z"
                />
              </svg>
            }
          />
          <SummaryCard
            label="Łączna liczba transakcji"
            value={totalTx}
            helper="Zliczone po wszystkich kontach."
            accent="from-emerald-500/60 via-emerald-400/40 to-emerald-300/30"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-100">
                <path
                  fill="currentColor"
                  d="M4 5a2 2 0 0 1 2-2h2.5a2 2 0 0 1 1.6.8l.9 1.2H18a2 2 0 0 1 2 2v1h-7.2l-.6-1.2a1 1 0 0 0-.9-.6H6v10.5a.5.5 0 0 0 .5.5H11v2H6.5A2.5 2.5 0 0 1 4 17.5zm10 9h6v3.5a1.5 1.5 0 0 1-1.5 1.5H14zm0-2.5a2.5 2.5 0 1 1 5 0V12h-5z"
                />
              </svg>
            }
          />
          <SummaryCard
            label="Główna waluta środowiska"
            value={primaryCurrency}
            helper="Ustalona na bazie pierwszego konta. Wyciągi mogą mieć inne waluty."
            accent="from-sky-500/60 via-blue-400/40 to-cyan-300/30"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-sky-100">
                <path
                  fill="currentColor"
                  d="M12 4a5 5 0 0 1 5 5v1h1a2 2 0 0 1 2 2v5.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5V12a2 2 0 0 1 2-2h1V9a5 5 0 0 1 5-5m3 6V9a3 3 0 1 0-6 0v1zm-7 2H6v5.5a.5.5 0 0 0 .5.5H8zm8 6v-7h-6v7z"
                />
              </svg>
            }
          />
        </div>
      </section>

      {/* Lista kont */}
      {accounts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
          <p className="font-medium text-slate-200">Brak zdefiniowanych kont.</p>
          <p className="mt-2">
            Po zaimportowaniu pierwszego wyciągu konto zostanie utworzone automatycznie.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/import"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-indigo-500/25"
            >
              Importuj wyciąg
              <span>→</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:-translate-y-0.5 hover:border-slate-700"
            >
              Wróć do dashboardu
            </Link>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} maxTx={maxTx} />
          ))}
        </section>
      )}
    </div>
  );
}

function AccountCard({
  account,
  maxTx,
}: {
  account: AccountSummary;
  maxTx: number;
}) {
  const maskedNumber = maskAccountNumber(account.account_number);
  const created =
    account.created_at &&
    new Date(account.created_at).toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  const transactionCount = account.transaction_count || 0;
  const ratio = Math.min(1, Math.max(0.06, transactionCount / maxTx));
  const createdTimestamp = account.created_at
    ? new Date(account.created_at).getTime()
    : null;
  const now = useMemo(() => Date.now(), []);
  const isFresh = createdTimestamp
    ? now - createdTimestamp < 14 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-md transition duration-200 hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-xl hover:shadow-indigo-500/10">
      <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-400/10" />
      </div>
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-50">
              {account.name || "Konto"}
            </div>
            {isFresh && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                Nowe
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {account.institution || "Instytucja nieznana"}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-slate-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono">{account.currency}</span>
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>Numer konta</span>
          <span className="font-mono text-sm text-slate-100">{maskedNumber}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>Właściciel</span>
          <span className="text-slate-200">{account.owner || "—"}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Transakcje</span>
          <span className="text-sm font-semibold text-indigo-200">
            {transactionCount}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-[width] duration-300"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          {created ? (
            <span>
              Dodane <span className="text-slate-200">{created}</span>
            </span>
          ) : (
            <span>Dodano automatycznie</span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 px-2 py-1 text-[10px] font-medium text-slate-200">
            Wyciągi w przygotowaniu
            <span className="text-xs">→</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-md transition duration-200 hover:border-slate-700">
      <div className={`absolute inset-px rounded-[14px] bg-gradient-to-br ${accent} opacity-0 blur-xl transition group-hover:opacity-100`} />
      <div className="relative flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-950/80 text-indigo-50 shadow-inner">
          {icon}
        </div>
        <div className="space-y-1 text-xs">
          <div className="text-slate-400">{label}</div>
          <div className="text-xl font-semibold text-slate-50">{value}</div>
          <p className="text-[11px] leading-relaxed text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function maskAccountNumber(num: string | null): string {
  if (!num) return "—";
  const compact = num.replace(/\s+/g, "");
  if (compact.length <= 10) return compact;
  const visibleStart = compact.slice(0, 4);
  const visibleEnd = compact.slice(-4);
  const hidden = "•".repeat(Math.max(0, compact.length - 8));
  // ładne grupowanie po 4
  const masked = `${visibleStart}${hidden}${visibleEnd}`;
  return masked.match(/.{1,4}/g)?.join(" ") ?? masked;
}
