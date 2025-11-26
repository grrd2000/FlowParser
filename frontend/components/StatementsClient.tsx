"use client";

import { StatementSummary } from "@/lib/serverApi";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  statements: StatementSummary[];
};

type StatusFilter = "all" | "success" | "partial" | "failed";

export function StatementsClient({ statements }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { filtered, total, byStatus } = useMemo(() => {
    const normStatus = (s: string | null) => {
      const v = s?.toLowerCase() ?? "";
      if (v.includes("partial")) return "partial";
      if (v.includes("success")) return "success";
      if (v.includes("fail")) return "failed";
      return "other";
    };

    const byStatus: Record<string, number> = {
      success: 0,
      partial: 0,
      failed: 0,
      other: 0,
    };

    for (const st of statements) {
      const k = normStatus(st.import_status);
      if (byStatus[k] !== undefined) byStatus[k] += 1;
      else byStatus["other"] += 1;
    }

    let filtered = statements;
    if (statusFilter !== "all") {
      filtered = statements.filter(
        (s) => normStatus(s.import_status) === statusFilter
      );
    }

    return {
      filtered,
      total: statements.length,
      byStatus,
    };
  }, [statements, statusFilter]);

  return (
    <div className="space-y-6">
      {/* nagłówek */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Statements</h1>
        <p className="text-sm text-slate-400">
          Lista zaimportowanych wyciągów z informacją o okresie, koncie i
          statusie przetwarzania.
        </p>
      </header>

      {/* podsumowanie + filtry statusu */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs text-slate-400">Liczba wyciągów</div>
            <div className="text-lg font-semibold text-slate-50">
              {total}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Statusy importu</div>
            <div className="flex gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                success: {byStatus["success"]}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                partial: {byStatus["partial"]}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                failed: {byStatus["failed"]}
              </span>
            </div>
          </div>
        </div>

        <div className="inline-flex rounded-full bg-slate-950/80 border border-slate-700 p-0.5 text-[11px] self-start">
          {(
            [
              ["all", "Wszystkie"],
              ["success", "Success"],
              ["partial", "Partial"],
              ["failed", "Failed"],
            ] as [StatusFilter, string][]
          ).map(([value, label]) => {
            const active = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={[
                  "px-3 py-1 rounded-full transition-colors",
                  active
                    ? "bg-indigo-500 text-slate-50"
                    : "text-slate-400 hover:text-slate-100",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* lista wyciągów */}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">
          Brak wyciągów w wybranym filtrze. Zaimportuj plik PDF w zakładce
          Flow.
        </p>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filtered.map((s, idx) => (
            <StatementCard key={s.id} statement={s} index={idx} />
          ))}
        </section>
      )}
    </div>
  );
}

function StatementCard({
  statement,
  index,
}: {
  statement: StatementSummary;
  index: number;
}) {
  const period =
    statement.period_start && statement.period_end
      ? `${formatDate(statement.period_start)} – ${formatDate(
          statement.period_end
        )}`
      : "Okres nieznany";

  const issue = statement.issue_date
    ? formatDate(statement.issue_date)
    : "brak daty";

  const status = normalizeStatus(statement.import_status);
  const statusBadge = getStatusBadgeStyles(status);

  const finished =
    statement.finished_at && new Date(statement.finished_at);

  const rowsInfo =
    statement.total_rows != null && statement.imported_rows != null
      ? `${statement.imported_rows}/${statement.total_rows} wgranych`
      : "brak danych o wierszach";

  const errorsInfo =
    statement.error_rows && statement.error_rows > 0
      ? `${statement.error_rows} błędnych wierszy`
      : "brak błędów";

  return (
    <motion.div
      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all flex flex-col gap-3 cursor-default"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: "easeOut" }}
    >
      {/* top: konto + status */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-100">
            {statement.account_name}
          </div>
          <div className="text-[11px] text-slate-500">
            {statement.institution ?? "Instytucja nieznana"} ·{" "}
            {statement.currency}
          </div>
          {statement.account_number && (
            <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
              {maskAccountNumber(statement.account_number)}
            </div>
          )}
        </div>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border",
            statusBadge.bg,
            statusBadge.border,
            statusBadge.text,
          ].join(" ")}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{statusBadge.label}</span>
        </span>
      </div>

      {/* okres + data wystawienia */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="space-y-0.5">
          <div className="text-slate-500">Okres wyciągu</div>
          <div className="text-slate-200">{period}</div>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-slate-500">Data wystawienia</div>
          <div className="text-slate-200">{issue}</div>
        </div>
      </div>

      {/* dół: statystyki importu */}
      <div className="flex items-end justify-between gap-2 text-[11px]">
        <div className="space-y-0.5">
          <div className="text-slate-500">Wiersze</div>
          <div className="text-slate-200">{rowsInfo}</div>
          <div className="text-slate-500">{errorsInfo}</div>
        </div>
        <div className="text-right space-y-0.5">
          {statement.pages_total != null && (
            <div className="text-slate-500">
              Strony:{" "}
              <span className="text-slate-200">
                {statement.pages_total}
              </span>
            </div>
          )}
          {finished && (
            <div className="text-slate-500">
              Import zakończony:{" "}
              <span className="text-slate-200">
                {finished.toLocaleString("pl-PL", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <div className="text-slate-500 italic">
            Szczegóły transakcji → zakładka Flow
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function normalizeStatus(s: string | null): "success" | "partial" | "failed" | "other" {
  if (!s) return "other";
  const v = s.toLowerCase();
  if (v.includes("partial")) return "partial";
  if (v.includes("success")) return "success";
  if (v.includes("fail")) return "failed";
  return "other";
}

function getStatusBadgeStyles(status: ReturnType<typeof normalizeStatus>) {
  switch (status) {
    case "success":
      return {
        label: "success",
        bg: "bg-emerald-500/10",
        border: "border-emerald-400/70",
        text: "text-emerald-300",
      };
    case "partial":
      return {
        label: "partial",
        bg: "bg-amber-500/10",
        border: "border-amber-400/70",
        text: "text-amber-300",
      };
    case "failed":
      return {
        label: "failed",
        bg: "bg-rose-500/10",
        border: "border-rose-400/70",
        text: "text-rose-300",
      };
    default:
      return {
        label: "unknown",
        bg: "bg-slate-500/10",
        border: "border-slate-500/70",
        text: "text-slate-300",
      };
  }
}

function maskAccountNumber(num: string | null): string {
  if (!num) return "—";
  const compact = num.replace(/\s+/g, "");
  if (compact.length <= 10) return compact;
  const visibleStart = compact.slice(0, 4);
  const visibleEnd = compact.slice(-4);
  const hidden = "•".repeat(Math.max(0, compact.length - 8));
  const masked = `${visibleStart}${hidden}${visibleEnd}`;
  return masked.match(/.{1,4}/g)?.join(" ") ?? masked;
}
