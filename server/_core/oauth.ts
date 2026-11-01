import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import {
  APP_SESSION_TTL_MS,
  AuthStorageUnavailableError,
  clearCurrentSessionCookie,
  clearOAuthProofCookie,
  consumeOAuthFlow,
  createOAuthFlow,
  getOAuthAuthorizationUrl,
  getOAuthProof,
  getPostOAuthWebRedirect,
  getRequestSessionToken,
  isAllowedNativeRedirectUri,
  isAllowedOAuthRedirectUri,
  isWebOAuthRedirectUri,
  parseOAuthState,
  persistOAuthFlow,
  revokeSessionToken,
  setOAuthProofCookie,
} from "../auth-security";
import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getBodyString(req: Request, key: string): string | undefined {
  const value = req.body?.[key];
  return typeof value === "string" ? value : undefined;
}

function validAuthorizationCode(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 8192;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

async function exchangeAndSync(code: string, redirectUri: string) {
  const tokenResponse = await sdk.exchangeCodeForToken(code, redirectUri);
  const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
  if (!userInfo.openId) throw new Error("Provider did not return an openId");
  const user = await syncUser(userInfo);
  const sessionToken = await sdk.createSessionToken(userInfo.openId, {
    name: userInfo.name || "",
    expiresInMs: APP_SESSION_TTL_MS,
  });
  return { sessionToken, user };
}

function oauthErrorStatus(error: unknown): number {
  return error instanceof AuthStorageUnavailableError ? 503 : 502;
}

/** Prefix for accounts created without any external identity provider. */
export const ANONYMOUS_OPEN_ID_PREFIX = "anon_";
const ANONYMOUS_LIMIT_PER_HOUR = 20;
const anonymousCreations = new Map<string, number[]>();

/** Small in-memory per-IP throttle so the open endpoint can't mint unlimited accounts. */
function allowAnonymousCreation(req: Request): boolean {
  const key = req.ip || "unknown";
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = (anonymousCreations.get(key) ?? []).filter((at) => at > cutoff);
  if (recent.length >= ANONYMOUS_LIMIT_PER_HOUR) {
    anonymousCreations.set(key, recent);
    return false;
  }
  recent.push(Date.now());
  anonymousCreations.set(key, recent);
  return true;
}

/**
 * Revokes the exact application JWT from the cookie or Bearer header, then
 * clears the host-only application cookie. It never touches a Manus account.
 * Exported for the tRPC logout integration as well as the REST route below.
 */
export async function revokeCurrentSession(req: Request, res: Response): Promise<void> {
  const token = getRequestSessionToken(req);
  try {
    if (token) {
      const session = await sdk.verifySession(token);
      if (session) await revokeSessionToken(token, session.expiresAt);
    }
  } finally {
    clearCurrentSessionCookie(req, res);
  }
}

export function registerOAuthRoutes(app: Express) {
  /** Starts a bound OAuth flow. The verifier is never included in state or the portal URL. */
  app.post("/api/oauth/begin", async (req: Request, res: Response) => {
    const redirectUri = getBodyString(req, "redirectUri");
    if (!redirectUri || !isAllowedOAuthRedirectUri(req, redirectUri)) {
      res.status(400).json({ error: "invalid_redirect_uri" });
      return;
    }

    const flow = createOAuthFlow(redirectUri);
    const authorizationUrl = getOAuthAuthorizationUrl(flow);
    if (!authorizationUrl) {
      res.status(503).json({ error: "oauth_unavailable" });
      return;
    }

    try {
      await persistOAuthFlow(flow);
      if (isWebOAuthRedirectUri(req, redirectUri)) {
        setOAuthProofCookie(req, res, flow);
        res.json({ authorizationUrl });
        return;
      }

      // Native callers keep this one-time verifier in SecureStore. It is not
      // present in portal URLs, provider state, logs, or the app callback URL.
      res.json({ authorizationUrl, verifier: flow.verifier });
    } catch (error) {
      res.status(oauthErrorStatus(error)).json({ error: "oauth_unavailable" });
    }
  });

  /**
   * Provider-only web callback. It accepts only code and state, validates the
   * HTTP-only proof cookie and flow row, consumes the row, then exchanges code.
   */
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const rawState = getQueryParam(req, "state");
    const state = rawState ? parseOAuthState(rawState) : null;
    const proof = getOAuthProof(req);
    clearOAuthProofCookie(req, res);

    if (
      !validAuthorizationCode(code) ||
      !state ||
      !proof ||
      proof.flowId !== state.nonce ||
      !isWebOAuthRedirectUri(req, state.redirectUri)
    ) {
      res.status(400).json({ error: "invalid_oauth_callback" });
      return;
    }

    try {
      const consumed = await consumeOAuthFlow(state, proof.verifier);
      if (!consumed) {
        res.status(400).json({ error: "invalid_oauth_callback" });
        return;
      }

      const { sessionToken } = await exchangeAndSync(code, state.redirectUri);
      res.cookie(getSessionCookieName(req), sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: APP_SESSION_TTL_MS,
      });

      const frontendUrl = getPostOAuthWebRedirect();
      if (!frontendUrl) {
        res.status(503).json({ error: "oauth_unavailable" });
        return;
      }
      // Fixed configured location only; no code, token, or profile is copied
      // into the browser-visible redirect URL.
      res.redirect(302, frontendUrl);
    } catch (error) {
      res.status(oauthErrorStatus(error)).json({ error: "oauth_callback_failed" });
    }
  });

  /**
   * Native code exchange. Legacy GET/query exchange is intentionally absent:
   * every exchange requires a POST body with the one-time bound verifier.
   */
  app.post("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getBodyString(req, "code");
    const rawState = getBodyString(req, "state");
    const verifier = getBodyString(req, "verifier");
    const state = rawState ? parseOAuthState(rawState) : null;

    if (
      !validAuthorizationCode(code) ||
      !state ||
      !verifier ||
      !isAllowedNativeRedirectUri(state.redirectUri)
    ) {
      res.status(400).json({ error: "invalid_oauth_exchange" });
      return;
    }

    try {
      const consumed = await consumeOAuthFlow(state, verifier);
      if (!consumed) {
        res.status(400).json({ error: "invalid_oauth_exchange" });
        return;
      }

      const { sessionToken, user } = await exchangeAndSync(code, state.redirectUri);
      res.json({
        sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      res.status(oauthErrorStatus(error)).json({ error: "oauth_exchange_failed" });
    }
  });

  /**
   * Creates a private account with no external sign-in. The phone keeps the
   * returned session token in SecureStore; web callers receive the app cookie.
   */
  app.post("/api/auth/anonymous", async (req: Request, res: Response) => {
    if (!allowAnonymousCreation(req)) {
      res.status(429).json({ error: "Try again later" });
      return;
    }
    try {
      const openId = `${ANONYMOUS_OPEN_ID_PREFIX}${randomUUID().replace(/-/g, "")}`;
      const user = await syncUser({ openId, name: null, loginMethod: "anonymous" });
      if (!(user as { id?: number }).id) throw new AuthStorageUnavailableError();
      const sessionToken = await sdk.createSessionToken(openId, {
        expiresInMs: APP_SESSION_TTL_MS,
      });
      res.cookie(getSessionCookieName(req), sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: APP_SESSION_TTL_MS,
      });
      res.json({ sessionToken, user: buildUserResponse(user) });
    } catch {
      res.status(503).json({ error: "account_unavailable" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      await revokeCurrentSession(req, res);
      res.json({ success: true });
    } catch (error) {
      res.status(error instanceof AuthStorageUnavailableError ? 503 : 500).json({
        error: "logout_failed",
      });
    }
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile).
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch {
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish an app cookie from a currently valid native Bearer token for the
  // paired iframe-preview use case. A revoked token is rejected by authenticateRequest.
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const token = getRequestSessionToken(req);
      if (!token || !req.headers.authorization?.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }

      res.cookie(getSessionCookieName(req), token, {
        ...getSessionCookieOptions(req),
        maxAge: APP_SESSION_TTL_MS,
      });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
