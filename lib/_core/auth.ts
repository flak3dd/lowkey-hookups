import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  OAUTH_VERIFIER_KEY,
  SESSION_TOKEN_KEY,
  USER_INFO_KEY,
} from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS !== "web")
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // Local cleanup is best effort during logout.
  }
}

export async function getOAuthVerifier(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;
    return await SecureStore.getItemAsync(OAUTH_VERIFIER_KEY);
  } catch {
    return null;
  }
}

/** Returns and erases the one-time native OAuth verifier. */
export async function consumeOAuthVerifier(): Promise<string | null> {
  const verifier = await getOAuthVerifier();
  try {
    if (Platform.OS !== "web")
      await SecureStore.deleteItemAsync(OAUTH_VERIFIER_KEY);
  } catch {
    // An exchange without a locally held verifier will fail closed server-side.
  }
  return verifier;
}

export async function clearOAuthVerifier(): Promise<void> {
  try {
    if (Platform.OS !== "web")
      await SecureStore.deleteItemAsync(OAUTH_VERIFIER_KEY);
  } catch {
    // Local cleanup is best effort.
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    const info =
      Platform.OS === "web"
        ? window.localStorage.getItem(USER_INFO_KEY)
        : await SecureStore.getItemAsync(USER_INFO_KEY);
    return info ? (JSON.parse(info) as User) : null;
  } catch {
    return null;
  }
}

/** Stores only the server-returned, verified identity for local display. */
export async function setUserInfo(user: User): Promise<void> {
  try {
    const serialized = JSON.stringify(user);
    if (Platform.OS === "web") {
      window.localStorage.setItem(USER_INFO_KEY, serialized);
      return;
    }
    await SecureStore.setItemAsync(USER_INFO_KEY, serialized);
  } catch {
    // Session authentication remains server-verified even if display caching fails.
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch {
    // Local cleanup is best effort during logout.
  }
}
