"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import React from "react";

type UserRole = "exporter" | "farmer";

interface AuthUser {
  role: UserRole;
  username: string;
  id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: ReturnType<typeof useLoginMutation>;
  logout: ReturnType<typeof useLogoutMutation>;
}

const AUTH_STORAGE_KEY = "agrofactoring_auth";

function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function storeUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

interface LoginResponse {
  success: boolean;
  role: UserRole;
  username: string;
}

function useLoginMutation() {
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiPost<LoginResponse>("/api/auth/login", data),
  });
}

function useLogoutMutation() {
  return useMutation({
    mutationFn: () => apiPost<{ success: boolean }>("/api/auth/logout"),
  });
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  useEffect(() => {
    setUser(getStoredUser());
    setMounted(true);
  }, []);

  const login = {
    ...loginMutation,
    mutateAsync: useCallback(
      async (data: { username: string; password: string }) => {
        const result = await loginMutation.mutateAsync(data);
        const authUser: AuthUser = {
          role: result.role,
          username: result.username,
        };
        storeUser(authUser);
        setUser(authUser);
        router.push(result.role === "exporter" ? "/exporter" : "/farmer");
        return result;
      },
      [loginMutation, router]
    ),
  };

  const logout = {
    ...logoutMutation,
    mutateAsync: useCallback(async () => {
      const result = await logoutMutation.mutateAsync();
      clearStoredUser();
      setUser(null);
      router.push("/login");
      return result;
    }, [logoutMutation, router]),
  };

  if (!mounted) return null;

  return React.createElement(
    AuthContext.Provider,
    { value: { user, isAuthenticated: !!user, login, logout } },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getStoredAuth(): AuthUser | null {
  return getStoredUser();
}
