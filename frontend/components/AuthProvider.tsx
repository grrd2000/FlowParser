"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authMe, authLogin, authLogout, authRegister, type AuthUser } from "@/lib/serverApi";
import { AuthModal } from "@/components/AuthModal";

type AuthMode = "login" | "register";

type AuthContextValue = {
  user: AuthUser | null;
  authLoading: boolean;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  async function refreshUser() {
    setAuthLoading(true);
    try {
      const u = await authMe();
      setUser(u);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAuth(nextMode: AuthMode) {
    setMode(nextMode);
    setModalOpen(true);
  }

  function closeAuth() {
    setModalOpen(false);
  }

  async function login(email: string, password: string) {
    await authLogin({ email, password });
    await refreshUser();
    // ważne: SSR/Server Components dostaną cookies po refresh
    router.refresh();
  }

  async function register(email: string, password: string, fullName?: string) {
    await authRegister({ email, password, full_name: fullName });
    await refreshUser();
    router.refresh();
  }

  async function logout() {
    await authLogout();
    await refreshUser();
    router.refresh();
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authLoading,
      openAuth,
      closeAuth,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, authLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={modalOpen}
        mode={mode}
        onClose={closeAuth}
        onSwitchMode={(m) => setMode(m)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
