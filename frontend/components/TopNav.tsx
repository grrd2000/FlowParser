"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { UserMenu } from "@/components/UserMenu";

export function TopNav() {
  const pathname = usePathname();
  const { user, authLoading, openAuth } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/flow", label: "Flow" },
    { href: "/lab", label: "Lab" },
  ];

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-screen-2xl px-4 md:px-6 lg:px-10">
        <div className="relative mt-2 flex h-16 items-center justify-between gap-4 rounded-full border border-white/5 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-950/90 px-4 shadow-[0_15px_45px_-25px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/10 via-sky-400/5 to-emerald-400/10 blur-xl" aria-hidden />

          {/* brand */}
          <Link
            href="/"
            className="relative flex items-center gap-3 rounded-full px-2 py-2 text-slate-100 transition-transform hover:-translate-y-0.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-sky-400 to-emerald-400 text-[12px] font-black uppercase text-slate-950 shadow-lg shadow-indigo-500/30">
              FP
            </span>
            <div className="leading-tight">
              <span className="block text-[12px] uppercase tracking-[0.16em] text-slate-200">FlowParser</span>
              <span className="text-[11px] text-slate-400">Finance OS</span>
            </div>
          </Link>

          {/* nav */}
          <nav className="hidden flex-1 justify-center md:flex">
            <div className="relative inline-flex items-center gap-1 rounded-full border border-white/5 bg-slate-900/70 px-1 py-1 shadow-inner shadow-black/20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/5 via-indigo-400/5 to-emerald-400/5" aria-hidden />
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "relative flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[13px] font-semibold transition-all",
                      active
                        ? "text-slate-900"
                        : "text-slate-300/80 hover:text-white hover:bg-white/5",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute inset-0 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 opacity-0 transition-all duration-300",
                        active ? "opacity-100 shadow-lg shadow-indigo-500/30" : "hover:opacity-100",
                      ].join(" ")}
                      aria-hidden
                    />
                    <span className="relative z-10 flex items-center gap-2">
                      <span
                        className={[
                          "h-2 w-2 rounded-full bg-gradient-to-r from-sky-300 to-emerald-300 transition-all",
                          active ? "opacity-100" : "opacity-40",
                        ].join(" ")}
                      />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* actions */}
          <div className="flex items-center gap-2">
            {!authLoading && user && (
              <Link
                href="/import"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 px-4 py-2 text-[12px] font-semibold text-slate-950 shadow-lg shadow-indigo-500/30 transition-transform hover:-translate-y-0.5"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-slate-900/70 shadow-inner shadow-slate-900/30" />
                Quick import
              </Link>
            )}

            {authLoading ? (
              <div className="h-10 w-24 rounded-full border border-white/10 bg-white/10 animate-pulse" />
            ) : !user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth("login")}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-slate-100 shadow-sm shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
                >
                  Login
                </button>
                <button
                  onClick={() => openAuth("register")}
                  className="rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 px-3 py-2 text-[12px] font-semibold text-slate-950 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
                >
                  Create account
                </button>
              </div>
            ) : (
              <UserMenu />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

