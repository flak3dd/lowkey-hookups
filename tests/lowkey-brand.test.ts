import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { BRAND, LOWKEY_THEME as C } from "../constants/branding";

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("LOWKEY brand adoption", () => {
  it("uses LOWKEY display branding while preserving the original native identity", () => {
    const config = readFileSync(resolve("app.config.ts"), "utf8");
    expect(BRAND.name).toBe("LOWKEY hookups");
    expect(config).toContain('appName: "LOWKEY hookups"');
    expect(config).toContain('appSlug: "geteven"');
    expect(config).toContain(
      'const rawBundleId = "space.manus.geteven.t063584009839075"',
    );
    expect(config).toContain("const schemeFromBundleId = `manus${timestamp}`");
  });
  it("bundles the actual logo lockup and the full native icon family", () => {
    for (const file of [
      "lowkey-wordmark.png",
      "lowkey-lips.png",
      "icon.png",
      "splash-icon.png",
      "favicon.png",
      "android-icon-foreground.png",
      "android-icon-background.png",
      "android-icon-monochrome.png",
    ]) {
      const path = resolve("assets/images", file);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path).subarray(0, 8).toString("hex")).toBe(
        "89504e470d0a1a0a",
      );
    }
    const ui = readFileSync(resolve("components/get-even/ui.tsx"), "utf8");
    expect(ui).toContain("lowkey-wordmark.png");
    expect(ui).toContain("lowkey-lips.png");
    expect(ui).not.toContain("C.blue");
  });
  it("maintains readable ruby CTA, text and warning contrasts", () => {
    expect(contrast(C.onAccent, C.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(C.accent, C.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(C.text, C.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(C.subtle, C.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(C.danger, C.surface)).toBeGreaterThanOrEqual(4.5);
    expect(C.danger).not.toBe(C.accent);
  });
});
