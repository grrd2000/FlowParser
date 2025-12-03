"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";

export function TopNav() {
  const pathname = usePathname();

  return (
    <header
      className="
        fixed top-4 left-1/2 -translate-x-1/2 
        z-50 w-[90%] max-w-4xl
        px-4 py-2
        rounded-3xl
        border border-white/10
        bg-white/10 backdrop-blur-xl
        shadow-lg shadow-black/30
        flex items-center justify-between
      "
    >
      <nav className="flex items-center gap-2 text-sm">
        <NavTab href="/dashboard" label="Dashboard" pathname={pathname} />
        <NavTab href="/flow" label="Flow" pathname={pathname} />
        <NavTab href="/import" label="Import" pathname={pathname} />
        <NavTab href="/profile" label="Profile" pathname={pathname} />
      </nav>

      <UserMenu />
    </header>
  );
}

function NavTab({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string | null;
}) {
  const active =
    pathname === href ||
    (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "px-4 py-1.5 rounded-full font-medium transition-all border",
        active
          ? "bg-white/25 text-slate-900 border-white/80 shadow-inner shadow-white/30"
          : "bg-white/5 text-slate-100/80 border-white/10 hover:bg-white/15 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
