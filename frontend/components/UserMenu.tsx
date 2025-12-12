"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";

type UserProfileLite = {
  name: string;
  email: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  // const [showImportModal, setShowImportModal] = useState(false);
  const [profile, setProfile] = useState<UserProfileLite | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // pobranie podstawowych danych usera (do avatara i headera)
  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await fetch(`${API_BASE}/user/me`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        setProfile({
          name: data.name ?? "User",
          email: data.email ?? "you@example.com",
        });
      } catch {
        // zostawiamy null -> pokaże się fallback
      } finally {
        if (active) setLoadingProfile(false);
      }
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, []);

  // zamykanie po kliknięciu poza dropdownem
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const initials =
    profile?.name && profile.name.trim().length > 0
      ? profile.name
          .trim()
          .split(" ")
          .map((p) => p[0]?.toUpperCase())
          .slice(0, 2)
          .join("")
      : "U";

  return (
    <>
      {/* przycisk z avatarem w app shellu */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 hover:border-indigo-400/70 hover:bg-slate-900 transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-indigo-500/40 border border-indigo-400/60 flex items-center justify-center text-[11px] font-semibold text-indigo-50">
            {loadingProfile ? "…" : initials}
          </div>
        </button>

        {/* dropdown */}
        {open && (
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-950/95 shadow-xl shadow-black/60 backdrop-blur-md z-40 p-3">
            {/* header usera */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/60">
              <div className="h-9 w-9 rounded-full bg-indigo-500/40 border border-indigo-400/70 flex items-center justify-center text-xs font-semibold text-indigo-50">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-100">
                  {profile?.name ?? "User"}
                </span>
                <span className="text-[11px] text-slate-500">
                  {profile?.email ?? "you@example.com"}
                </span>
                <span className="text-[10px] text-slate-600 mt-0.5">
                  Local environment
                </span>
              </div>
            </div>

            {/* sekcja: profile / accounts / statements */}
            <div className="py-2 text-sm">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                My space
              </div>
              <nav className="flex flex-col gap-1">
                <Link
                  href="/profile"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-800/80 text-xs text-slate-200"
                  onClick={() => setOpen(false)}
                >
                  <span>Profile</span>
                  <span className="text-[10px] text-slate-500">
                    ustawienia
                  </span>
                </Link>
                <Link
                  href="/profile/accounts"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-800/80 text-xs text-slate-200"
                  onClick={() => setOpen(false)}
                >
                  <span>Accounts</span>
                  <span className="text-[10px] text-slate-500">
                    konta i banki
                  </span>
                </Link>
                <Link
                  href="/profile/statements"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-800/80 text-xs text-slate-200"
                  onClick={() => setOpen(false)}
                >
                  <span>Statements</span>
                  <span className="text-[10px] text-slate-500">
                    wyciągi
                  </span>
                </Link>
                {/* <Link
                  href="/lab"
                  className="
                    flex items-center justify-between gap-3
                    rounded-xl px-3 py-2
                    text-[12px] text-slate-200
                    hover:bg-white/5 hover:text-white
                    transition-colors
                  "
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-400/30">
                      ✨
                    </span>
                    AI Assistant
                  </span>
                  <span className="text-[10px] text-slate-500">Lab</span>
                </Link> */}
              </nav>
            </div>

            {/* sekcja: data & imports */}
            <div className="py-2 border-t border-slate-800/60 text-sm">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Data &amp; imports
              </div>
                <Link
                  href="/import"
                  className="w-full rounded-lg bg-indigo-500/15 border border-indigo-400/60 px-2 py-1.5 text-xs text-indigo-100 hover:bg-indigo-500/25 flex items-center justify-between"
                  onClick={() => setOpen(false)}
                >
                  <span>Import statements</span>
                  {/* <span className="text-[10px] text-indigo-200">PKO BP</span> */}
                </Link>

            </div>

            {/* sekcja: preferences na przyszłość */}
            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
              <span>Theme: dark · Preferences in Profile</span>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
