import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  managedPackagerExpoUrl,
  resolveExpoQrUrl,
  tokenFreeExpoUrl,
} from "../scripts/expo-qr.mjs";

const tempDirectories: string[] = [];
afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("managed Expo QR URLs", () => {
  it("prefers the authoritative app QR URL and refuses credentials, query strings, and fragments", () => {
    expect(
      resolveExpoQrUrl({
        env: {
          EXPO_APP_QR_URL: "exps://device-preview.example.test/project",
          EXPO_PACKAGER_PROXY_URL: "https://ignored.example.test",
        },
      }),
    ).toEqual({
      url: "exps://device-preview.example.test/project",
      source: "EXPO_APP_QR_URL",
      reason: null,
    });
    expect(tokenFreeExpoUrl("exps://user:password@example.test")).toBeNull();
    expect(tokenFreeExpoUrl("exps://example.test/?token=secret")).toBeNull();
    expect(tokenFreeExpoUrl("exps://example.test/#fragment")).toBeNull();
  });

  it("uses only the configured packager proxy as a fallback and transforms its scheme", () => {
    expect(managedPackagerExpoUrl("https://proxy.example.test:8081")).toBe(
      "exps://proxy.example.test:8081",
    );
    expect(managedPackagerExpoUrl("http://proxy.example.test")).toBe("exp://proxy.example.test");
    expect(
      resolveExpoQrUrl({ env: { EXPO_PACKAGER_PROXY_URL: "https://proxy.example.test:8081" } }),
    ).toEqual({
      url: "exps://proxy.example.test:8081",
      source: "EXPO_PACKAGER_PROXY_URL",
      reason: null,
    });
    expect(resolveExpoQrUrl({ env: {} })).toMatchObject({
      url: null,
      reason: "EXPO_APP_QR_URL and EXPO_PACKAGER_PROXY_URL are not configured",
    });
  });

  it("renders a terminal QR plus valid PNG and SVG assets in an isolated current directory", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "get-even-qr-"));
    tempDirectories.push(directory);
    const script = path.resolve(process.cwd(), "scripts/generate_qr.mjs");
    const url = "exps://device-preview.example.test";
    const output = execFileSync(process.execPath, [script], {
      cwd: directory,
      env: {
        ...process.env,
        EXPO_APP_QR_URL: url,
        EXPO_PACKAGER_PROXY_URL: "",
      },
      encoding: "utf8",
    });

    expect(output).toContain(`Expo URL: ${url}`);
    expect(output).toContain("Saved expo-qr-code.png and expo-qr-code.svg");
    const pngPath = path.join(directory, "expo-qr-code.png");
    const svgPath = path.join(directory, "expo-qr-code.svg");
    expect(statSync(pngPath).size).toBeGreaterThan(100);
    expect(readFileSync(pngPath).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(readFileSync(svgPath, "utf8")).toContain("<svg");
  });
});
