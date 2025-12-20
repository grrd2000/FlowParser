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
        className={[
          "group inline-flex items-center gap-3",
          "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl",
          "px-3.5 py-1.5 text-[11px] text-slate-100 shadow-inner shadow-black/30",
          "transition-all duration-150",
          "hover:border-indigo-400/50 hover:bg-white/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
          open ? "border-indigo-400/60 bg-white/10" : "",
        ].join(" ")}
      >
        <span
          className="
            inline-flex h-8 w-8 items-center justify-center
            rounded-xl border border-white/10 bg-gradient-to-br
            from-indigo-400/90 via-sky-300/80 to-emerald-300/80
            text-[11px] font-semibold text-slate-950 shadow-inner shadow-black/20
          "
        >
          {initials}
        </span>
        <div className="hidden sm:flex flex-col leading-tight">
          <span className="max-w-[140px] truncate text-[11px] font-semibold">
            {label}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Konto aktywne
          </span>
        </div>
        <span className="sm:hidden text-[11px] font-semibold">{label}</span>
        <span
          className={[
            "grid h-6 w-6 place-items-center rounded-full border border-white/10",
            "bg-white/5 text-[10px] text-slate-200 transition-transform duration-150",
            "group-hover:translate-y-[1px]",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          ▾
        </span>
      </button>

      <div
        className={[
          "absolute right-0 mt-3 w-[300px] overflow-hidden rounded-3xl",
          "border border-white/10 bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950/95 backdrop-blur-2xl",
          "shadow-[0_20px_80px_-24px_rgba(0,0,0,0.65)]",
          "transition-all duration-200",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none",
        ].join(" ")}
      >
        <div className="px-4 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-200/90">
                Zalogowany jako
              </div>
              <div className="mt-1 text-[12px] font-semibold text-slate-50 truncate">
                {user.email}
              </div>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 shadow-inner shadow-emerald-500/10">
              Online
            </span>
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

        <div className="border-t border-white/10 p-4 bg-white/5">
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="
              w-full rounded-xl border border-rose-400/30
              bg-gradient-to-r from-rose-500/80 via-amber-400/80 to-rose-500/80
              px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.08em]
              text-slate-950 shadow-lg shadow-rose-500/20
              transition-transform duration-150 hover:scale-[1.01]
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
        group block px-4 py-3
        hover:bg-white/5 transition-colors
      "
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-indigo-200">
            •
          </span>
          <span className="text-[12px] font-semibold text-slate-100">{label}</span>
        </div>
        <span className="text-xs text-indigo-300 transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-400/90">{sub}</div>}
    </Link>
  );
}
