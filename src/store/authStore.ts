"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCheckedSession: boolean;
  login: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (userData: Partial<User>) => void;
  validateSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      hasCheckedSession: false,

      login: (user: User) => {
        set({ user, isAuthenticated: true, isLoading: false, hasCheckedSession: true });
      },

      logout: () => {
        // The session cookie is httpOnly, so only the server can clear it.
        fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
        set({ user: null, isAuthenticated: false, isLoading: false, hasCheckedSession: true });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      // Validate session against the database
      validateSession: async () => {
        const state = get();
        if (!state.user?.id) {
          set({ isAuthenticated: false, isLoading: false, hasCheckedSession: true });
          return false;
        }

        try {
          // A saved browser login only counts if the server session agrees. This also
          // signs out logins saved before session cookies existed, once.
          const sessionRes = await fetch("/api/auth/me");
          if (sessionRes.status === 401) {
            set({ user: null, isAuthenticated: false, isLoading: false, hasCheckedSession: true });
            return false;
          }
          if (sessionRes.ok) {
            const { user: sessionUser } = await sessionRes.json();
            if (sessionUser?.id !== state.user.id) {
              set({ user: null, isAuthenticated: false, isLoading: false, hasCheckedSession: true });
              return false;
            }
          }

          const res = await fetch(`/api/user/profile?userId=${state.user.id}`);
          if (!res.ok) {
            // User no longer exists (e.g., DB was re-seeded) — clear stale session
            set({ user: null, isAuthenticated: false, isLoading: false, hasCheckedSession: true });
            return false;
          }
          const data = await res.json();
          if (data.user) {
            set({ user: { ...state.user, ...data.user }, isAuthenticated: true, isLoading: false, hasCheckedSession: true });
            return true;
          }
          set({ user: null, isAuthenticated: false, isLoading: false, hasCheckedSession: true });
          return false;
        } catch {
          // Network error — keep existing session if we have one
          if (state.user) {
            set({ isAuthenticated: true, isLoading: false, hasCheckedSession: true });
          } else {
            set({ isAuthenticated: false, isLoading: false, hasCheckedSession: true });
          }
          return true;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
