"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const label = useMemo(() => {
    if (!user) return "User";
    const name = (user.full_name ?? "").trim();
    if (name) return name;
    const email = user.email ?? "";
    return email.includes("@") ? email.split("@")[0] : email;
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return "U";
    const name = (user.full_name ?? "").trim();
    if (name) {
      const parts = name.split(" ").filter(Boolean);
      const a = parts[0]?.[0] ?? "U";
      const b = parts[1]?.[0] ?? "";
      return (a + b).toUpperCase();
    }
    const email = user.email ?? "u";
    return (email[0] ?? "U").toUpperCase();
  }, [user]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // menu ma sens tylko dla zalogowanego
  if (!user) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          inline-flex items-center gap-2
          rounded-full border border-white/10
          bg-white/5 px-2.5 py-1.5
          text-[11px] text-slate-200
          hover:bg-white/10 transition-colors
        "
      >
        <span
          className="
            inline-flex h-7 w-7 items-center justify-center
            rounded-full border border-white/10
            bg-gradient-to-br from-indigo-400/60 to-emerald-400/40
            text-[11px] font-semibold text-slate-950
          "
        >
          {initials}
        </span>
        <span className="hidden sm:inline-block max-w-[140px] truncate">
          {label}
        </span>
        <span className="opacity-70">▾</span>
      </button>

      <div
        className={[
          "absolute right-0 mt-2 w-[260px] overflow-hidden rounded-2xl",
          "border border-white/10 bg-slate-950/75 backdrop-blur-xl",
          "shadow-2xl shadow-black/40",
          "transition-all duration-150",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none",
        ].join(" ")}
      >
        <div className="px-3 py-2 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            Zalogowany jako
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-slate-100 truncate">
            {user.email}
          </div>
        </div>

        {/* To jest to co chciałeś: Profile + podstrony */}
        <nav className="py-1">
          <MenuLink href="/profile" label="Profile" onClick={() => setOpen(false)} />
          <MenuLink
            href="/profile/accounts"
            label="Accounts"
            sub="Twoje konta i statystyki"
            onClick={() => setOpen(false)}
          />
          <MenuLink
            href="/profile/statements"
            label="Statements"
            sub="Wgrane wyciągi i importy"
            onClick={() => setOpen(false)}
          />
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="
              w-full rounded-xl border border-white/10
              bg-white/5 px-3 py-2
              text-left text-[12px] text-slate-200
              hover:bg-white/10 transition-colors
            "
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  sub,
  onClick,
}: {
  href: string;
  label: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        block px-3 py-2
        hover:bg-white/5 transition-colors
      "
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-slate-200">{label}</span>
        <span className="text-slate-500">→</span>
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </Link>
  );
}
