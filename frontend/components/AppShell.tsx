"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const enableBackdropMotion = isLanding;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-slate opacity-40 mix-blend-screen" />
        <div className={`aurora-pane ${enableBackdropMotion ? "aurora-pane--animated" : "aurora-pane--static"}`} />
        <div
          className={`aurora-pane aurora-pane--secondary ${
            enableBackdropMotion ? "aurora-pane--animated" : "aurora-pane--static"
          }`}
        />
        <div className="absolute inset-x-0 top-12 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      <div
        className={[
          "relative z-10 w-full",
          isLanding ? "px-4 sm:px-6 lg:px-10 pt-24 pb-16" : "px-4 sm:px-6 lg:px-10 pt-24 pb-14",
        ].join(" ")}
      >
        <div className="relative mx-auto flex w-full max-w-screen-2xl flex-col gap-10">
          <div className="pointer-events-none absolute -left-24 top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl -z-10" aria-hidden />
          <div className="pointer-events-none absolute -right-16 bottom-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-3xl -z-10" aria-hidden />
          <div className="relative w-full space-y-8 lg:space-y-10">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
