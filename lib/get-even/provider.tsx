import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { MeResponse } from "@/shared/get-even";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = await Auth.getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${getApiBaseUrl()}/api/get-even${path}`, {
    method,
    headers,
    credentials: "include",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.error ||
        data.message ||
        "This action couldn't be completed. Please try again.",
      response.status,
    );
  return data as T;
}
export function useLive<T>(key: string, path: string, enabled = true) {
  return useQuery<T>({
    queryKey: ["ge", key],
    queryFn: () => request<T>(path),
    enabled,
    retry: false,
    refetchInterval: 15000,
  });
}
type Context = {
  user: MeResponse["user"] | null;
  profile: MeResponse["profile"];
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
  refreshAll: () => Promise<void>;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [loginError, setLoginError] = useState<string | null>(null);
  const me = useQuery<MeResponse | null>({
    queryKey: ["ge", "me"],
    queryFn: async () => {
      try {
        return await request<MeResponse>("/me");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403))
          return null;
        throw e;
      }
    },
    retry: false,
    refetchInterval: 6000,
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void client.invalidateQueries({ queryKey: ["ge"] });
    });
    return () => subscription.remove();
  }, [client]);
  const value: Context = {
    user: me.data?.user ?? null,
    profile: me.data?.profile ?? null,
    loading: me.isPending,
    error:
      loginError ||
      (me.error
        ? "Unable to reach your private space. Check your connection and retry."
        : null),
    login: async () => {
      setLoginError(null);
      try {
        // No external sign-in: the server creates a private account and
        // returns a session token kept in SecureStore on this device.
        const response = await fetch(`${getApiBaseUrl()}/api/auth/anonymous`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data.sessionToken !== "string")
          throw new Error(
            response.status === 429
              ? "Too many new spaces from this network. Try again later."
              : "Your space couldn't be created. Check your connection and retry.",
          );
        await Auth.setSessionToken(data.sessionToken);
        await client.invalidateQueries({ queryKey: ["ge"] });
        await me.refetch();
      } catch (e) {
        setLoginError(
          e instanceof Error
            ? e.message
            : "Your space couldn't be created. Please retry.",
        );
      }
    },
    logout: async () => {
      const token = await Auth.getSessionToken();
      const response = await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok)
        throw new Error("Sign-out couldn't complete. Please retry.");
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      client.removeQueries({ queryKey: ["ge"] });
      await me.refetch();
    },
    refresh: () => me.refetch(),
    refreshAll: () => client.invalidateQueries({ queryKey: ["ge"] }),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing AppProvider");
  return value;
}
export function clientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export function errorText(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Something went wrong. Please try again.";
}
export function prettyPhone(value: string) {
  return value.replace(/(.{3})(.{3})(.*)/, "$1 $2 $3");
}
export function relativeDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
