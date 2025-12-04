"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";

export function TopNav() {
  const pathname = usePathname();

  const isDashboard =
    pathname === "/" || pathname?.startsWith("/dashboard");
  const isFlow = pathname?.startsWith("/flow");

  return (
    <header
      className="
        fixed top-0 left-0 right-0 z-40
        border-b border-white/10
        bg-black/35 backdrop-blur-xl
      "
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6">
        {/* LEWO: logo / nazwa */}
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-200/80">
            FlowParser
          </span>
          <span className="text-[10px] text-slate-500">
            Personal finance lab
          </span>
        </div>

        {/* ŚRODEK: segmented tabs (lekko w lewo, nie idealnie na środku ekranu) */}
        <div className="flex flex-1 justify-center md:justify-start">
          <div
            className="
              inline-flex items-center gap-1 rounded-full
              border border-white/15
              bg-white/5 backdrop-blur-xl
              px-1 py-1
              shadow-inner shadow-black/30
            "
          >
            <SegmentTab href="/dashboard" label="Dashboard" active={isDashboard} />
            <SegmentTab href="/flow" label="Flow" active={isFlow} />
          </div>
        </div>

        {/* PRAWO: Import + User */}
        <div className="flex items-center gap-3">
          <Link
            href="/import"
            className="
              hidden sm:inline-flex items-center justify-center
              rounded-full border border-indigo-400/70
              bg-indigo-500/75 px-3 py-1.5
              text-[11px] font-medium text-slate-950
              shadow-md shadow-indigo-500/40
              hover:bg-indigo-400 hover:border-indigo-300
              transition-colors
            "
          >
            Import
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function SegmentTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "px-5 py-1.5 text-[13px] rounded-full font-medium transition-all border",
        active
          ? "bg-white/80 text-slate-900 border-white shadow-md shadow-white/40"
          : "bg-white/0 text-slate-100/80 border-transparent hover:bg-white/15 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
