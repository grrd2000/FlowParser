"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-slate opacity-40 mix-blend-screen" />
        <div className="aurora-pane" />
        <div className="aurora-pane aurora-pane--secondary" />
        <div className="absolute inset-x-0 top-12 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      <div
        className={[
          "relative z-10 w-full",
          isLanding ? "px-4 md:px-10 pt-24 pb-16 max-w-7xl mx-auto" : "px-4 md:px-10 pt-24 pb-14 max-w-6xl mx-auto",
        ].join(" ")}
      >
        <div className="rounded-[34px] border border-white/10 bg-white/5 p-[1px] shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="rounded-[30px] border border-white/5 bg-slate-900/60 p-4 md:p-6 lg:p-8">
            <div className="relative">
              <div className="pointer-events-none absolute -left-12 top-6 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -right-10 -bottom-6 h-24 w-24 rounded-full bg-emerald-400/25 blur-3xl" />
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
