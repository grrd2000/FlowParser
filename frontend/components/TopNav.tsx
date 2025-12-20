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
    <header
      className="
        fixed top-0 left-0 right-0 z-40
        border-b border-white/5
        bg-slate-950/60 backdrop-blur-2xl
      "
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative mt-2 flex h-16 items-center justify-between gap-4 rounded-full border border-white/10 bg-white/5 px-4 shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-2xl">
          {/* brand */}
          <Link href="/" className="flex items-center gap-3 rounded-full px-2 py-2 transition-transform hover:translate-y-[-1px]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-emerald-400 text-[13px] font-black uppercase text-slate-950 shadow-lg shadow-indigo-500/30">
              FP
            </span>
            <div className="leading-tight">
              <span className="block text-[12px] uppercase tracking-[0.2em] text-slate-200">FlowParser</span>
              <span className="text-[11px] text-slate-400">Next-gen personal finance</span>
            </div>
          </Link>

          {/* nav */}
          <nav className="hidden flex-1 justify-center md:flex">
            <div className="relative inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/60 px-1 py-1 shadow-inner shadow-black/30">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/5 via-indigo-500/5 to-emerald-400/5 blur-md" />
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative overflow-hidden rounded-full px-4 py-2 text-[13px] font-semibold text-slate-200/80 transition-all"
                  >
                    <span
                      className={[
                        "relative z-10 flex items-center gap-2",
                        active ? "text-white" : "text-slate-300/80 group-hover:text-white",
                      ].join(" ")}
                    >
                      <span className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400 opacity-0 group-hover:opacity-80 transition-opacity" />
                      {item.label}
                    </span>
                    <span
                      className={[
                        "absolute inset-0 scale-0 bg-gradient-to-r from-indigo-500/40 via-sky-400/30 to-emerald-400/40 opacity-0 blur-xl transition-all duration-300",
                        active ? "scale-100 opacity-70" : "group-hover:scale-100 group-hover:opacity-60",
                      ].join(" ")}
                    />
                    <span
                      className={[
                        "absolute inset-x-3 -bottom-1 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent transition-all",
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                      ].join(" ")}
                    />
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* actions */}
          <div className="flex items-center gap-3">
            {!authLoading && user && (
              <Link
                href="/import"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 px-4 py-2 text-[12px] font-semibold text-slate-950 shadow-lg shadow-indigo-500/30 transition-transform hover:-translate-y-0.5"
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
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-slate-100 shadow-sm shadow-black/30 transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
                >
                  Login
                </button>
                <button
                  onClick={() => openAuth("register")}
                  className="rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 px-3 py-2 text-[12px] font-semibold text-slate-950 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
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

