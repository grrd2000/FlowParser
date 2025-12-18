"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  const mainClasses = isLanding ? "pt-20 pb-14" : "pt-20 pb-10 px-4 md:px-6";
  const containerClasses = isLanding ? undefined : "mx-auto w-full max-w-6xl";

  return (
    <main className={mainClasses}>
      <div className={containerClasses}>{children}</div>
    </main>
  );
}
