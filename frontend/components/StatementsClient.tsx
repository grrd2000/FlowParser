"use client";

import { StatementSummary } from "@/lib/serverApi";
import * as Popover from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

type Props = {
  statements: StatementSummary[];
};

type StatusFilter = "all" | "success" | "partial" | "failed";
type IconProps = { className?: string };
type IconComponent = (props: IconProps) => JSX.Element;
type FilterOption = { value: string; label: string; helper?: string };

export function StatementsClient({ statements }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [slide, setSlide] = useState(0);

  const { filtered, total, byStatus, years, months } = useMemo(() => {
    const normStatus = (s: string | null) => {
      const v = s?.toLowerCase() ?? "";
      if (v.includes("partial")) return "partial";
      if (v.includes("success")) return "success";
      if (v.includes("fail")) return "failed";
      return "other";
    };

    const extractDate = (s: StatementSummary) => {
      const candidate = s.period_start ?? s.issue_date ?? s.period_end;
      if (!candidate) return null;
      const d = new Date(candidate);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const byStatus: Record<string, number> = {
      success: 0,
      partial: 0,
      failed: 0,
      other: 0,
    };

    const years = new Set<string>();
    const months = new Set<number>();

    for (const st of statements) {
      const k = normStatus(st.import_status);
      if (byStatus[k] !== undefined) byStatus[k] += 1;
      else byStatus["other"] += 1;

      const date = extractDate(st);
      if (date) {
        years.add(date.getFullYear().toString());
        months.add(date.getMonth());
      }
    }

    let filtered = statements;
    if (statusFilter !== "all") {
      filtered = statements.filter(
        (s) => normStatus(s.import_status) === statusFilter
      );
    }

    filtered = filtered.filter((s) => {
      const date = extractDate(s);
      if (yearFilter !== "all") {
        if (!date || date.getFullYear().toString() !== yearFilter) return false;
      }
      if (monthFilter !== "all") {
        if (!date || date.getMonth().toString() !== monthFilter) return false;
      }
      return true;
    });

    return {
      filtered,
      total: statements.length,
      byStatus,
      years: Array.from(years).sort((a, b) => Number(b) - Number(a)),
      months: Array.from(months).sort((a, b) => b - a),
    };
  }, [monthFilter, statements, statusFilter, yearFilter]);

  const slides = useMemo(() => chunkArray(filtered, 4), [filtered]);
  const activeSlide = Math.min(slide, Math.max(slides.length - 1, 0));

  const yearOptions: FilterOption[] = [
    {
      value: "all",
      label: "Wszystkie lata",
      helper: "Cała oś czasu",
    },
    ...years.map((y) => ({
      value: y,
      label: y,
      helper: `Dane z ${y} roku`,
    })),
  ];

  const monthOptions: FilterOption[] = [
    {
      value: "all",
      label: "Wszystkie miesiące",
      helper: "Bez zawężania dat",
    },
    ...months.map((m) => ({
      value: m.toString(),
      label: monthLabel(Number(m)),
      helper: `Importy z miesiąca ${monthLabel(Number(m))}`,
    })),
  ];

  return (
    <div className="space-y-8">
      {/* nagłówek */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-lg shadow-black/30">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-800/40 via-transparent to-emerald-700/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Spójny widok wyciągów
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-50">Statements</h1>
              <p className="mt-1 text-sm text-slate-400">
                Nowoczesny, minimalistyczny widok wyciągów z szybką filtracją i
                mikrointerakcjami dopasowanymi do całej aplikacji.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-[11px] text-slate-300">
              <SummaryPill
                label="Liczba wyciągów"
                value={total.toString()}
                helper="Wszystkie zaimportowane PDFy"
                accent="from-indigo-500/60 via-indigo-400/40 to-indigo-300/30"
              />
              <SummaryPill
                label="Zakończone sukcesem"
                value={byStatus["success"].toString()}
                helper="Pełne importy bez błędów"
                accent="from-emerald-500/60 via-emerald-400/40 to-emerald-300/30"
              />
              <SummaryPill
                label="Wymagają uwagi"
                value={(byStatus["partial"] + byStatus["failed"]).toString()}
                helper="Partial / failed"
                accent="from-amber-500/60 via-amber-400/40 to-rose-400/30"
              />
            </div>
          </div>

          <div className="relative inline-flex self-start overflow-hidden rounded-full border border-slate-800/80 bg-slate-900/80 p-1 text-[11px] shadow-lg shadow-black/20">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-emerald-400/10" />
            <div className="relative flex items-center gap-1">
              {([
                ["all", "Wszystkie"],
                ["success", "Success"],
                ["partial", "Partial"],
                ["failed", "Failed"],
              ] as [StatusFilter, string][]).map(([value, label]) => {
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={[
                      "relative px-3 py-1 rounded-full transition duration-200",
                      active
                        ? "bg-indigo-500 text-slate-50 shadow-[0_12px_30px_-18px_rgba(99,102,241,0.9)]"
                        : "text-slate-400 hover:text-slate-100",
                    ].join(" ")}
                  >
                    {active && (
                      <span className="absolute inset-0 -z-10 rounded-full bg-indigo-500/20 blur" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* lista wyciągów */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-6 text-sm text-slate-400">
          Brak wyciągów w wybranym filtrze. Zaimportuj plik PDF w zakładce
          <span className="text-slate-200"> Flow</span> lub przełącz filtr.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
            <FilterControl
              label="Rok"
              icon={CalendarRangeIcon}
              highlightTone="from-indigo-500/50 via-indigo-400/40 to-indigo-300/30"
              value={yearFilter}
              options={yearOptions}
              onChange={(value) => {
                setYearFilter(value);
                setSlide(0);
              }}
            />
            <FilterControl
              label="Miesiąc"
              icon={CalendarDaysIcon}
              highlightTone="from-emerald-500/40 via-emerald-400/30 to-emerald-300/30"
              value={monthFilter}
              options={monthOptions}
              onChange={(value) => {
                setMonthFilter(value);
                setSlide(0);
              }}
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-indigo-200/90 shadow-inner shadow-black/30">
              <SparklesIcon className="h-3.5 w-3.5 text-indigo-300" />
              <span>Filtry dopasowane do UI</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl shadow-black/30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(16,185,129,0.08),transparent_45%)]" />
              <motion.div
                className="relative flex"
                animate={{ x: `-${activeSlide * 100}%` }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              >
                {slides.map((chunk, chunkIdx) => (
                  <div
                    key={chunkIdx}
                    className="min-w-full grid gap-4 p-6 md:grid-cols-2"
                  >
                    {chunk.map((s, idx) => (
                      <StatementCard
                        key={s.id}
                        statement={s}
                        index={chunkIdx * 4 + idx}
                      />
                    ))}
                  </div>
                ))}
              </motion.div>

              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSlide((s) => (s === 0 ? slides.length - 1 : s - 1))
                    }
                    className="group absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-900/90 p-2 text-slate-200 shadow-lg shadow-black/40 backdrop-blur transition hover:-translate-y-1/2 hover:-translate-x-0.5 hover:border-indigo-400/80 hover:text-indigo-100"
                  >
                    <span className="inline-block transition group-hover:-translate-x-0.5">←</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSlide((s) => (s === slides.length - 1 ? 0 : s + 1))
                    }
                    className="group absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-900/90 p-2 text-slate-200 shadow-lg shadow-black/40 backdrop-blur transition hover:-translate-y-1/2 hover:translate-x-0.5 hover:border-indigo-400/80 hover:text-indigo-100"
                  >
                    <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                  </button>
                </>
              )}
            </div>

            {slides.length > 1 && (
              <div className="flex items-center justify-center gap-3 text-[11px] text-slate-300">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/70 px-3 py-1 shadow-inner shadow-black/30">
                  <span className="text-slate-500">Slajd</span>
                  <span className="font-semibold text-slate-100">
                    {activeSlide + 1}/{slides.length}
                  </span>
                </div>
                <div className="flex gap-2">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSlide(idx)}
                      className={[
                        "h-2.5 w-2.5 rounded-full border transition",
                        activeSlide === idx
                          ? "border-indigo-400 bg-indigo-400 shadow-md shadow-indigo-500/40"
                          : "border-slate-600 bg-slate-800 hover:border-slate-400",
                      ].join(" ")}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterControl({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  highlightTone,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon: IconComponent;
  highlightTone: string;
}) {
  const active =
    options.find((o) => o.value === value) ?? options.find((o) => o.value === "all") ?? options[0];

  return (
    <Popover.Root>
      <Popover.Trigger
        className="group relative inline-flex min-w-[150px] items-center gap-2 rounded-full border border-slate-800/80 bg-slate-950/70 px-3 py-1.5 pr-3 text-left shadow-inner shadow-black/30 transition hover:border-indigo-400/60 hover:shadow-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 data-[state=open]:border-indigo-400/70"
        aria-label={`Filtruj po polu ${label}`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <span
            className={`absolute inset-0 bg-gradient-to-r ${highlightTone} opacity-0 transition duration-300 group-hover:opacity-40 group-data-[state=open]:opacity-70`}
          />
          <span className="absolute inset-0 rounded-full border border-slate-700/70" />
        </div>

        <div className="relative flex items-center justify-center rounded-full bg-slate-900/80 p-1 text-indigo-200 shadow-inner shadow-black/30">
          <Icon className="h-4 w-4" />
        </div>

        <div className="relative flex flex-1 flex-col">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</span>
          <span className="text-[13px] font-semibold text-slate-100">{active?.label ?? value}</span>
          {active?.helper && (
            <span className="text-[9px] text-slate-400">{active.helper}</span>
          )}
        </div>

        <span className="relative rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-200 shadow-inner shadow-black/30">
          ▼
        </span>
      </Popover.Trigger>

      <Popover.Content
        sideOffset={10}
        className="z-50 w-[220px] max-h-[340px] overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/95 p-2 shadow-xl shadow-black/40 backdrop-blur"
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-900/60 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">
          <Icon className="h-3.5 w-3.5 text-indigo-300" />
          <span>Wybierz {label.toLowerCase()}</span>
        </div>

        <div className="flex flex-col gap-1">
          {options.map((option) => (
            <Popover.Close asChild key={option.value}>
              <button
                type="button"
                onClick={() => onChange(option.value)}
                className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition duration-150 hover:-translate-y-[1px] hover:border-indigo-400/60 hover:bg-slate-900/90 ${
                  option.value === value
                    ? "border-indigo-400/70 bg-slate-900/70 text-slate-100 shadow-lg shadow-indigo-500/10"
                    : "border-slate-800/80 bg-slate-950/60 text-slate-300"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                    option.value === value
                      ? "border-indigo-300 bg-indigo-500/20 text-indigo-100"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                  }`}
                >
                  {option.value === value ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    option.label.slice(0, 1)
                  )}
                </span>

                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{option.label}</span>
                  {option.helper && (
                    <span className="text-[10px] text-slate-400">{option.helper}</span>
                  )}
                </div>
              </button>
            </Popover.Close>
          ))}
        </div>

        <Popover.Arrow className="fill-slate-800/80" />
      </Popover.Content>
    </Popover.Root>
  );
}

function CalendarRangeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 9h18" />
      <path d="M8 15h3" />
      <path d="M13 15h3" />
      <path d="M8 12h5" />
    </svg>
  );
}

function CalendarDaysIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 9h18" />
      <path d="M8 13h2v2H8z" />
      <path d="M12 13h2v2h-2z" />
      <path d="M16 13h2v2h-2z" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SparklesIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4Z" />
      <path d="M5 19l1-2.5 2.5-1-2.5-1L5 12l-1 2.5L1.5 15l2.5 1Z" />
      <path d="M19 19.5l.8-2 2-1-.8-2-.8 2-2 .8 2 1Z" />
    </svg>
  );
}

function SummaryPill({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3 shadow-inner shadow-black/20">
      <div className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-60 transition duration-300 group-hover:opacity-90`} />
      <div className="relative space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-slate-300/80">
          {label}
        </div>
        <div className="text-xl font-semibold text-slate-50">{value}</div>
        <div className="text-[11px] text-slate-300">{helper}</div>
      </div>
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

  const reimportInfo =
    statement.import_runs_count > 1
      ? `Reimportowany ${statement.import_runs_count}×`
      : null;

  return (
    <motion.div
      className="group rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-md transition duration-200 hover:-translate-y-1 hover:border-indigo-400/60 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col gap-4 cursor-default"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: "easeOut" }}
    >
      {/* top: konto + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-100">
              {statement.account_name}
            </div>
            {statement.is_reimported && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                Reimport
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {statement.institution ?? "Instytucja nieznana"} ·{" "}
            <span className="text-slate-300">{statement.currency}</span>
          </div>
          {statement.account_number && (
            <div className="mt-0.5 text-[11px] text-slate-400 font-mono">
              {maskAccountNumber(statement.account_number)}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] border shadow-inner shadow-black/20",
              statusBadge.bg,
              statusBadge.border,
              statusBadge.text,
            ].join(" ")}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>{statusBadge.label}</span>
          </span>

          {reimportInfo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200 border border-indigo-400/60">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
              <span>{reimportInfo}</span>
            </span>
          )}
        </div>
      </div>


      {/* okres + data wystawienia */}
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-slate-500">Okres wyciągu</div>
            <div className="text-slate-200">{period}</div>
          </div>
          <div className="text-right space-y-0.5">
            <div className="text-slate-500">Data wystawienia</div>
            <div className="text-slate-200">{issue}</div>
          </div>
        </div>
      </div>

      {/* dół: statystyki importu */}
      <div className="mt-2 grid gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-slate-500">Wiersze</div>
            <div className="text-slate-200 text-sm font-medium">{rowsInfo}</div>
            <div
              className={
                (statement.error_rows ?? 0) > 0
                  ? "text-rose-300"
                  : "text-emerald-300"
              }
            >
              {errorsInfo}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            {statement.pages_total != null && (
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5">
                <span className="text-slate-500">Pages:</span>
                <span className="text-slate-200 font-medium">
                  {statement.pages_total}
                </span>
              </div>
            )}

            {finished && (
              <div className="text-slate-500">
                <span className="block text-[10px] uppercase tracking-wide">
                  Import zakończony
                </span>
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

function monthLabel(idx: number) {
  const names = [
    "styczeń",
    "luty",
    "marzec",
    "kwiecień",
    "maj",
    "czerwiec",
    "lipiec",
    "sierpień",
    "wrzesień",
    "październik",
    "listopad",
    "grudzień",
  ];
  return names[idx] ?? `Miesiąc ${idx + 1}`;
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
