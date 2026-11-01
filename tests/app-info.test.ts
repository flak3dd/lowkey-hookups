import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  APP_JOURNEY,
  DISCRETION_PILLARS,
  JOURNEY_VISIBILITY_NOTE,
} from "../constants/app-info";

describe("App info and discretion copy", () => {
  it("explains three steps without claiming automatic reciprocal-probe chat", () => {
    expect(APP_JOURNEY).toHaveLength(3);
    expect(APP_JOURNEY[0].text).toContain("No public profile");
    expect(APP_JOURNEY[1].text).toContain("Send a 💋");
    expect(APP_JOURNEY[1].text).not.toContain("Hook up, Date, or Chat");
    expect(APP_JOURNEY[2].text).toContain("accepts and voluntarily replies");
    expect(APP_JOURNEY[2].text).toContain("does not unlock chat");
    expect(JOURNEY_VISIBILITY_NOTE).toContain("recipient may see");
    expect(JOURNEY_VISIBILITY_NOTE).toContain("Named probe");
  });
  it("provides six pillars with accurate receipt, batch and reveal limits", () => {
    expect(DISCRETION_PILLARS).toHaveLength(6);
    expect(DISCRETION_PILLARS[0].text).toContain("no ignore or block status");
    expect(DISCRETION_PILLARS[2].text).toContain(
      "not how many contacts like you back",
    );
    expect(DISCRETION_PILLARS[4].text).toContain(
      "each person separately confirms",
    );
    expect(DISCRETION_PILLARS[5].text).toContain("cannot guarantee");
    expect(DISCRETION_PILLARS.map((p) => p.title).join(" ")).not.toContain(
      "Zero Rejection Risk",
    );
  });
  it("exposes the info route from both Home states and Private", () => {
    const home = readFileSync("app/(tabs)/index.tsx", "utf8");
    const privatePage = readFileSync("app/(tabs)/private.tsx", "utf8");
    expect(home.match(/router\.push\("\/app-info"\)/g)).toHaveLength(2);
    expect(privatePage).toContain('router.push("/app-info")');
    expect(readFileSync("app/app-info.tsx", "utf8")).toContain(
      "APP_JOURNEY.map",
    );
  });
});
