// frontend/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/flow", label: "Flow" },
  { href: "/accounts", label: "Accounts" },
  { href: "/profile", label: "My Profile" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Floating card */}
      <div className="max-w-6xl mx-auto py-4 px-2 md:px-4">
        <div
          className="rounded-2xl border border-slate-800/80 bg-slate-950/70
                     backdrop-blur-lg shadow-2xl flex flex-col md:flex-row
                     overflow-hidden min-h-[70vh]"
        >
          {/* Sidebar (inside card) */}
          <aside className="hidden md:flex md:flex-col md:w-60 border-r border-slate-800/80 bg-slate-950/60">
            <div className="h-16 flex items-center px-5 border-b border-slate-800/80">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold tracking-[0.25em] text-emerald-400 uppercase">
                  Flow
                </span>
                <span className="text-sm text-slate-300">Parser</span>
              </div>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "mx-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-slate-800/80 text-slate-50"
                        : "text-slate-400 hover:bg-slate-900/70 hover:text-slate-100",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-1.5 w-1.5 rounded-full",
                        active ? "bg-emerald-400" : "bg-slate-600",
                      ].join(" ")}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-800/80 px-4 py-3 text-xs text-slate-500">
              <div>Logged in as</div>
              <div className="text-slate-300">demo@example.com</div>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex-1 flex flex-col">
            {/* Topbar – sticky wewnątrz karty */}
            <header
              className="h-14 border-b border-slate-800/80 bg-slate-950/80
                         backdrop-blur flex items-center justify-between px-4 md:px-6
                         sticky top-0 z-10"
            >
              {/* Mobile brand */}
              <div className="md:hidden flex items-center gap-2">
                <span className="text-sm font-semibold">FlowParser</span>
              </div>

              {/* Greeting */}
              <div className="hidden md:flex flex-col">
                <span className="text-[11px] text-slate-400">Welcome back,</span>
                <span className="text-sm text-slate-100 font-medium">
                  Gerard
                </span>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="h-8 w-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-200">
                  G
                </div>
              </div>
            </header>

            {/* Content */}
            <main className="flex-1">
              <div className="px-4 md:px-6 py-5">{children}</div>
            </main>

            {/* Mobile bottom nav (inside card, przyklejony na dole) */}
            <nav className="md:hidden border-t border-slate-800/80 bg-slate-950/90 backdrop-blur">
              <div className="flex">
                {navItems.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex-1 flex flex-col items-center justify-center py-2 text-[11px]",
                        active
                          ? "text-emerald-400"
                          : "text-slate-400 hover:text-slate-100",
                      ].join(" ")}
                    >
                      <span className="mb-0.5 inline-block h-1 w-6 rounded-full bg-slate-700">
                        {active && (
                          <span className="block h-1 w-full rounded-full bg-emerald-400" />
                        )}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
