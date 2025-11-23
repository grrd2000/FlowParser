// frontend/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/flow", label: "Flow" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#050816] via-[#020617] to-[#020617] text-slate-100 overflow-hidden">
      {/* animowane tło */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-orbit bg-orbit--left" />
        <div className="bg-orbit bg-orbit--right" />
      </div>

      {/* główny layout */}
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar na desktopie */}
        <aside className="hidden md:flex md:flex-col w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl">
          <div className="h-16 flex items-center px-6 border-b border-white/10">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-[0.25em] text-indigo-400 uppercase">
                Flow
              </span>
              <span className="text-sm text-slate-200">Parser</span>
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
                    "mx-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-indigo-500/20 text-slate-50 border border-indigo-500/40"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-1.5 w-1.5 rounded-full",
                      active ? "bg-indigo-400" : "bg-slate-600",
                    ].join(" ")}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-400">
            <div>Logged in as</div>
            <div className="text-slate-200">demo@example.com</div>
          </div>
        </aside>

        {/* Prawa kolumna: topbar + content + mobile nav */}
        <div className="flex-1 flex flex-col">
          {/* Topbar (sticky, jak w nowoczesnych apkach) */}
          <header className="h-16 border-b border-white/10 bg-black/30 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="md:hidden flex items-center gap-2">
                <span className="text-sm font-semibold">FlowParser</span>
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-[11px] text-slate-400">
                  Welcome back,
                </span>
                <span className="text-sm text-slate-100 font-medium">
                  Gerard
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* mały „badge” stanu */}
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Local only
              </span>

              {/* avatar */}
              <div className="h-9 w-9 rounded-full bg-indigo-500/30 border border-indigo-400/60 flex items-center justify-center text-xs font-semibold text-indigo-100">
                G
              </div>
            </div>
          </header>

          {/* Główna treść */}
          <main className="flex-1">
            <div className="px-4 md:px-10 py-6 max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>

          {/* Mobile bottom nav */}
          <nav className="md:hidden border-t border-white/10 bg-black/40 backdrop-blur-xl">
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
                        ? "text-indigo-400"
                        : "text-slate-400 hover:text-slate-100",
                    ].join(" ")}
                  >
                    <span className="mb-0.5 inline-block h-1 w-6 rounded-full bg-slate-700">
                      {active && (
                        <span className="block h-1 w-full rounded-full bg-indigo-400" />
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
  );
}
