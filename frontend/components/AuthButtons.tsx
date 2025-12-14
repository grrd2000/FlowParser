"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export function AuthButtons() {
  const { user, authLoading, openAuth, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="h-9 w-28 rounded-full border border-white/10 bg-white/5 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => openAuth("login")}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
        >
          Login
        </button>
        <button
          onClick={() => openAuth("register")}
          className="rounded-full border border-indigo-400/70 bg-indigo-500/75 px-3 py-1.5 text-[11px] font-medium text-slate-950 shadow-md shadow-indigo-500/40 hover:bg-indigo-400 hover:border-indigo-300 transition-colors"
        >
          Register
        </button>
      </div>
    );
  }

  // proste menu po zalogowaniu (na razie)
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/lab"
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
      >
        Lab
      </Link>
      <button
        onClick={() => logout()}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
