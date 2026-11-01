import { and, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { authFlows, revokedSessions } from "../drizzle/auth-schema";
import { SESSION_COOKIE_SUFFIX } from "../shared/const";
import { getDb } from "./db";
import {
  currentOAuthProofCookie,
  currentSessionCookie,
  getOAuthProofCookieName,
  getSessionCookieName,
  getSessionCookieOptions,
} from "./_core/cookies";
import { isLoopbackApiHost } from "./_core/cors";

export const APP_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const OAUTH_FLOW_TTL_MS = 1000 * 60 * 10;

const OAUTH_CALLBACK_PATH = "/api/oauth/callback";
const NATIVE_APP_SCHEME = `manus${SESSION_COOKIE_SUFFIX}`;
const NATIVE_CALLBACK_URI = `${NATIVE_APP_SCHEME}:///oauth/callback`;

export class AuthStorageUnavailableError extends Error {
  constructor() {
    super("Authentication storage is unavailable");
    this.name = "AuthStorageUnavailableError";
  }
}

export type OAuthFlowState = {
  redirectUri: string;
  nonce: string;
};

export type OAuthFlow = OAuthFlowState & {
  verifier: string;
  expiresAt: Date;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function secureRandomValue(): string {
  return randomBytes(32).toString("base64url");
}

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new AuthStorageUnavailableError();
  return db;
}


/** Create a state nonce and an out-of-band verifier for one OAuth attempt. */
export function createOAuthFlow(redirectUri: string): OAuthFlow {
  return {
    redirectUri,
    nonce: secureRandomValue(),
    verifier: secureRandomValue(),
    expiresAt: new Date(Date.now() + OAUTH_FLOW_TTL_MS),
  };
}

export function encodeOAuthState(state: OAuthFlowState): string {
  return Buffer.from(
    JSON.stringify({ redirectUri: state.redirectUri, nonce: state.nonce }),
    "utf8",
  ).toString("base64url");
}

/** Strictly decode only the state format produced by encodeOAuthState. */
export function parseOAuthState(value: string): OAuthFlowState | null {
  if (!/^[A-Za-z0-9_-]{16,4096}$/.test(value)) return null;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).length !== 2 ||
      typeof record.redirectUri !== "string" ||
      typeof record.nonce !== "string" ||
      record.redirectUri.length > 2048 ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(record.nonce)
    ) {
      return null;
    }
    return { redirectUri: record.redirectUri, nonce: record.nonce };
  } catch {
    return null;
  }
}

export async function persistOAuthFlow(flow: OAuthFlow): Promise<void> {
  const db = await requireDatabase();
  await db.insert(authFlows).values({
    flowId: flow.nonce,
    verifierHash: sha256(flow.verifier),
    redirectUri: flow.redirectUri,
    expiresAt: flow.expiresAt,
  });
}

/**
 * Atomically consumes a flow before the provider authorization code is
 * exchanged. A replay, expired flow, redirect mismatch, or bad verifier all
 * yield false without revealing which part failed.
 */
export async function consumeOAuthFlow(
  state: OAuthFlowState,
  verifier: string,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(verifier)) return false;

  const db = await requireDatabase();
  const consumed = await db
    .delete(authFlows)
    .where(
      and(
        eq(authFlows.flowId, state.nonce),
        eq(authFlows.verifierHash, sha256(verifier)),
        eq(authFlows.redirectUri, state.redirectUri),
        gt(authFlows.expiresAt, new Date()),
      ),
    )
    .returning({ flowId: authFlows.flowId });

  return consumed.length === 1;
}

function getOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function pairedApiOrigin(packagerUrl: string | undefined): string | null {
  const origin = getOrigin(packagerUrl);
  if (!origin) return null;
  const url = new URL(origin);
  const apiHostname = url.hostname.replace(/^8081-/, "3000-");
  if (apiHostname === url.hostname) return null;
  url.hostname = apiHostname;
  return url.origin;
}

function configuredApiOrigins(req: Request): Set<string> {
  const origins = new Set<string>();
  for (const value of [
    process.env.EXPO_PUBLIC_API_BASE_URL,
    process.env.API_PUBLIC_URL,
  ]) {
    const origin = getOrigin(value);
    if (origin) origins.add(origin);
  }

  const pairedOrigin = pairedApiOrigin(process.env.EXPO_PACKAGER_PROXY_URL);
  if (pairedOrigin) origins.add(pairedOrigin);

  // Plain HTTP remains usable for an explicitly local API. Never infer a
  // remotely reachable callback host from a request Host header.
  if (isLoopbackApiHost(req.hostname)) {
    const protocol = req.protocol === "https" ? "https" : "http";
    const host = req.get("host");
    if (host) origins.add(`${protocol}://${host}`);
  }
  return origins;
}

export function isAllowedWebRedirectUri(req: Request, redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      url.pathname === OAUTH_CALLBACK_PATH &&
      !url.search &&
      !url.hash &&
      configuredApiOrigins(req).has(url.origin)
    );
  } catch {
    return false;
  }
}

function isManagedExpoGoRedirectUri(redirectUri: string): boolean {
  const configuredPackager = getOrigin(process.env.EXPO_PACKAGER_PROXY_URL);
  if (!configuredPackager) return false;

  try {
    const expected = new URL(configuredPackager);
    const candidate = new URL(redirectUri);
    return (
      (candidate.protocol === "exp:" || candidate.protocol === "exps:") &&
      candidate.host === expected.host &&
      candidate.pathname === "/--/oauth/callback" &&
      !candidate.search &&
      !candidate.hash
    );
  } catch {
    return false;
  }
}

/** Permit only this app's exact custom callback or its current managed Expo Go host. */
export function isAllowedNativeRedirectUri(redirectUri: string): boolean {
  return redirectUri === NATIVE_CALLBACK_URI || isManagedExpoGoRedirectUri(redirectUri);
}

export function isAllowedOAuthRedirectUri(req: Request, redirectUri: string): boolean {
  return (
    isAllowedWebRedirectUri(req, redirectUri) || isAllowedNativeRedirectUri(redirectUri)
  );
}

export function isWebOAuthRedirectUri(req: Request, redirectUri: string): boolean {
  return isAllowedWebRedirectUri(req, redirectUri);
}

export function getOAuthAuthorizationUrl(state: OAuthFlowState): string | null {
  const portalOrigin = getOrigin(process.env.MANUS_OAUTH_PORTAL_URL);
  const appId = process.env.MANUS_PROJECT_ID;
  if (!portalOrigin || !appId) return null;

  const url = new URL("/app-auth", portalOrigin);
  url.searchParams.set("responseType", "code");
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", state.redirectUri);
  url.searchParams.set("state", encodeOAuthState(state));
  return url.toString();
}

/** Return only a configured Expo web origin, never a request-supplied target. */
export function getPostOAuthWebRedirect(): string | null {
  for (const value of [
    process.env.EXPO_WEB_PREVIEW_URL,
    process.env.EXPO_PACKAGER_PROXY_URL,
  ]) {
    const origin = getOrigin(value);
    if (origin) return `${origin}/`;
  }
  return null;
}

export function getRequestSessionToken(req: Request): string | undefined {
  const authorization = req.headers.authorization ?? req.headers.Authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    return token || undefined;
  }
  return currentSessionCookie(req);
}

export function getOAuthProof(req: Request): { flowId: string; verifier: string } | null {
  const value = currentOAuthProofCookie(req);
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator !== value.lastIndexOf(".")) return null;
  const flowId = value.slice(0, separator);
  const verifier = value.slice(separator + 1);
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(flowId) ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(verifier)
  ) {
    return null;
  }
  return { flowId, verifier };
}

export function setOAuthProofCookie(req: Request, res: Response, flow: OAuthFlow): void {
  res.cookie(getOAuthProofCookieName(req), `${flow.nonce}.${flow.verifier}`, {
    ...getSessionCookieOptions(req),
    maxAge: OAUTH_FLOW_TTL_MS,
  });
}

export function clearOAuthProofCookie(req: Request, res: Response): void {
  res.clearCookie(getOAuthProofCookieName(req), {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}

export async function isSessionRevoked(token: string): Promise<boolean> {
  const db = await requireDatabase();
  const matches = await db
    .select({ tokenHash: revokedSessions.tokenHash })
    .from(revokedSessions)
    .where(
      and(
        eq(revokedSessions.tokenHash, sha256(token)),
        gt(revokedSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return matches.length > 0;
}

export async function revokeSessionToken(token: string, expiresAt: Date): Promise<void> {
  const db = await requireDatabase();
  await db
    .insert(revokedSessions)
    .values({ tokenHash: sha256(token), expiresAt })
    .onConflictDoUpdate({ target: revokedSessions.tokenHash, set: { expiresAt } });
}

/**
 * Clears only the application-owned host-only cookie. Callers must validate
 * the request token before calling revokeSessionToken for an authenticated
 * logout; this helper is exported for the tRPC logout route as well.
 */
export function clearCurrentSessionCookie(req: Request, res: Response): void {
  res.clearCookie(getSessionCookieName(req), {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}
