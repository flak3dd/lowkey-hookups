import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  }

  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const error = (await response.json()) as {
        error?: unknown;
        message?: unknown;
      };
      if (typeof error.error === "string") errorMessage = error.error;
      else if (typeof error.message === "string") errorMessage = error.message;
    } catch {
      // Do not surface or log a provider response body that could contain sensitive values.
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json"))
    return (await response.json()) as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Native callback exchange; verifier is never sent in a query string. */
export async function exchangeOAuthCode(
  code: string,
  state: string,
  verifier: string,
): Promise<{ sessionToken: string; user: unknown }> {
  const result = await apiCall<{ sessionToken?: unknown; user?: unknown }>(
    "/api/oauth/mobile",
    {
      method: "POST",
      body: JSON.stringify({ code, state, verifier }),
    },
  );
  if (typeof result.sessionToken !== "string" || !result.sessionToken) {
    throw new Error("Unable to complete secure sign-in");
  }
  return { sessionToken: result.sessionToken, user: result.user };
}

export async function logout(): Promise<void> {
  try {
    await apiCall<void>("/api/auth/logout", { method: "POST" });
  } finally {
    await Promise.all([
      Auth.removeSessionToken(),
      Auth.clearUserInfo(),
      Auth.clearOAuthVerifier(),
    ]);
  }
}

export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch {
    return null;
  }
}

/** Establishes the API host cookie from a currently valid Bearer token. */
export async function establishSession(token: string): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}
