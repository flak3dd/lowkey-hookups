import { describe, expect, it } from "vitest";
import { validateGuessInput, validateProbeInput } from "../server/get-even/validation";

describe("anonymous candidate workflow boundaries", () => {
  it("accepts international phone formats with presentation separators", () => {
    expect(validateGuessInput({ phone: "+61 412 345 678" })).toEqual({ phone: "+61412345678" });
    expect(validateGuessInput({ phone: "+61412345678" })).toEqual({ phone: "+61412345678" });
  });

  it("rejects malformed guess numbers", () => {
    for (const phone of ["61412345678", "+61", "+614123456789012345", "not-a-number", ""]) {
      expect(validateGuessInput({ phone })).toBeNull();
    }
  });

  it("accepts only anonymous single probes", () => {
    const base = { phone: "+61412345678", intent: "Kiss", clientId: "edge-case-1" };
    expect(validateProbeInput({ ...base, mode: "anonymous" })).toMatchObject({ mode: "anonymous" });
    expect(validateProbeInput({ ...base, mode: "named" })).toBeNull();
  });
});
