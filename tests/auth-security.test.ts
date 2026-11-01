import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  createOAuthFlow,
  encodeOAuthState,
  isAllowedNativeRedirectUri,
  isAllowedWebRedirectUri,
  parseOAuthState,
} from "../server/auth-security";
import {
  getOAuthProofCookieName,
  getSessionCookieName,
  getSessionCookieOptions,
} from "../server/_core/cookies";
import { sdk } from "../server/_core/sdk";
import { SESSION_COOKIE_SUFFIX } from "../shared/const";

function request(hostname = "3000-preview.example.test", protocol = "http"): Request {
  return {
    hostname,
    protocol,
    headers: {},
    get: (name: string) => (name.toLowerCase() === "host" ? hostname : undefined),
  } as unknown as Request;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuth flow security", () => {
  it("keeps the verifier out of the base64 state", () => {
    const flow = createOAuthFlow("https://api.example.test/api/oauth/callback");
    const state = encodeOAuthState(flow);

    expect(state).not.toContain(flow.verifier);
    expect(parseOAuthState(state)).toEqual({
      redirectUri: flow.redirectUri,
      nonce: flow.nonce,
    });
  });

  it("rejects malformed or expanded state payloads", () => {
    expect(parseOAuthState("not-a-valid-oauth-state")).toBeNull();
    const expanded = Buffer.from(
      JSON.stringify({ redirectUri: "https://api.example.test/api/oauth/callback", nonce: "a".repeat(43), x: 1 }),
      "utf8",
    ).toString("base64url");
    expect(parseOAuthState(expanded)).toBeNull();
  });

  it("allows only the exact configured API callback", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://3000-preview.example.test");
    const req = request();

    expect(
      isAllowedWebRedirectUri(req, "https://3000-preview.example.test/api/oauth/callback"),
    ).toBe(true);
    expect(
      isAllowedWebRedirectUri(req, "https://evil.example.test/api/oauth/callback"),
    ).toBe(false);
    expect(
      isAllowedWebRedirectUri(
        req,
        "https://3000-preview.example.test/api/oauth/callback?next=https://evil.example.test",
      ),
    ).toBe(false);
  });

  it("accepts only this app's exact native scheme callback", () => {
    expect(
      isAllowedNativeRedirectUri(`manus${SESSION_COOKIE_SUFFIX}:///oauth/callback`),
    ).toBe(true);
    expect(isAllowedNativeRedirectUri("manuswrong:///oauth/callback")).toBe(false);
    expect(
      isAllowedNativeRedirectUri(`manus${SESSION_COOKIE_SUFFIX}:///oauth/callback/other`),
    ).toBe(false);
  });

  it("uses secure host-only cookies for configured public HTTPS despite internal HTTP", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://3000-preview.example.test");
    const req = request("3000-preview.example.test", "http");

    expect(getSessionCookieOptions(req)).toMatchObject({
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
    expect(getSessionCookieName(req)).toBe(`__Host-manus_session_${SESSION_COOKIE_SUFFIX}`);
    expect(getOAuthProofCookieName(req)).toBe(
      `__Host-manus_oauth_proof_${SESSION_COOKIE_SUFFIX}`,
    );
  });

  it("retains plain HTTP local cookie behavior when no public HTTPS is configured", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("EXPO_PACKAGER_PROXY_URL", "");
    vi.stubEnv("EXPO_WEB_PREVIEW_URL", "");
    vi.stubEnv("API_PUBLIC_URL", "");
    const req = request("localhost:3000", "http");

    expect(getSessionCookieOptions(req)).toMatchObject({ secure: false, sameSite: "lax" });
    expect(getSessionCookieName(req)).toBe(`manus_local_session_${SESSION_COOKIE_SUFFIX}`);
  });

  it("rejects a correctly signed session for a different Manus project", async () => {
    const token = await sdk.signSession({
      openId: "different-project-user",
      appId: "different-manus-project",
      name: "User",
    });

    expect(await sdk.verifySession(token)).toBeNull();
  });
});
