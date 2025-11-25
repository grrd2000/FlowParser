"use client";

import { AccountSummary } from "@/lib/serverApi";
import { useMemo } from "react";

type Props = {
  accounts: AccountSummary[];
};

export function AccountsClient({ accounts }: Props) {
  const { totalTx, primaryCurrency } = useMemo(() => {
    const totalTx = accounts.reduce(
      (sum, a) => sum + (a.transaction_count || 0),
      0
    );
    const cur =
      accounts.length > 0 ? accounts[0].currency ?? "PLN" : "PLN";
    return { totalTx, primaryCurrency: cur };
  }, [accounts]);

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-slate-400">
          Twoje konta bankowe używane w analizie przepływów.
        </p>
      </header>

      {/* Podsumowanie */}
      <section className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400 mb-1">Liczba kont</div>
          <div className="text-xl font-semibold text-slate-50">
            {accounts.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Każde konto może mieć inne wyciągi i waluty.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400 mb-1">
            Łączna liczba transakcji
          </div>
          <div className="text-xl font-semibold text-indigo-300">
            {totalTx}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Zliczone po wszystkich kontach.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400 mb-1">
            Główna waluta środowiska
          </div>
          <div className="text-xl font-semibold text-emerald-300">
            {primaryCurrency}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Ustalona na bazie pierwszego konta. Wyciągi mogą mieć inne
            waluty.
          </p>
        </div>
      </section>

      {/* Lista kont */}
      {accounts.length === 0 ? (
        <p className="text-sm text-slate-400">
          Brak zdefiniowanych kont. Po zaimportowaniu pierwszego wyciągu
          konto zostanie utworzone automatycznie.
        </p>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </section>
      )}
    </div>
  );
}

function AccountCard({ account }: { account: AccountSummary }) {
  const maskedNumber = maskAccountNumber(account.account_number);
  const created =
    account.created_at &&
    new Date(account.created_at).toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-default flex flex-col gap-3">
      {/* top: nazwa + instytucja */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-100">
            {account.name || "Konto"}
          </div>
          <div className="text-[11px] text-slate-500">
            {account.institution || "Instytucja nieznana"}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{account.currency}</span>
        </div>
      </div>

      {/* numer konta + właściciel */}
      <div className="text-xs space-y-1">
        {account.account_number && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Numer konta</span>
            <span className="font-mono text-slate-200">
              {maskedNumber}
            </span>
          </div>
        )}
        {account.owner && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Właściciel</span>
            <span className="text-slate-200">{account.owner}</span>
          </div>
        )}
      </div>

      {/* dół: transakcje + data + placeholder dla statements */}
      <div className="mt-1 flex items-end justify-between gap-2 text-[11px]">
        <div className="space-y-0.5">
          <div className="text-slate-500">Transakcje</div>
          <div className="text-sm font-semibold text-indigo-300">
            {account.transaction_count}
          </div>
        </div>
        <div className="text-right space-y-0.5">
          {created && (
            <div className="text-slate-500">
              Założone:{" "}
              <span className="text-slate-300">{created}</span>
            </div>
          )}
          <div className="text-slate-500">
            <span className="italic">
              Statements (wyciągi) w przygotowaniu →
            </span>
          </div>
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
