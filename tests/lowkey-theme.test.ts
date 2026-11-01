import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LOWKEY theme presentation", () => {
  it("uses the installed Expo renderer for the approved lips and lockup", () => {
    const ui = readFileSync("components/get-even/ui.tsx", "utf8");
    expect(ui).toContain("Image as ExpoImage");
    expect(ui).toContain('from "expo-image"');
    expect(ui).toContain("lowkey-wordmark.png");
    expect(ui).toContain("lowkey-lips.png");
    expect(ui).toContain('contentFit="contain"');
    expect(ui).toContain("export function DesireMotif");
  });
  it("carries the ruby headline and both send routes into Home", () => {
    const home = readFileSync("app/(tabs)/index.tsx", "utf8");
    expect(home).toContain("color: C.accent");
    expect(home).toContain('pathname: "/compose"');
    expect(home).toContain('router.push("/mass-probe")');
  });
});
