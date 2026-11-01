import { describe, expect, it, vi } from "vitest";
import {
  canonicalPhone,
  validatePhoneInput,
  validateVerifyCodeInput,
} from "../server/get-even/validation";
import {
  sendVerificationCode,
  verifyCode,
  verifyPhoneToken,
} from "../server/get-even/phone-verification";

describe("phone SMS verification service", () => {
  it("normalizes and validates international phone numbers", () => {
    expect(canonicalPhone("+61 412 345 678")).toBe("+61412345678");
    expect(canonicalPhone(" +1 (415) 555-0199 ")).toBe("+14155550199");
    expect(canonicalPhone("0412345678")).toBeNull(); // Missing country code
    expect(canonicalPhone("invalid")).toBeNull();

    expect(validatePhoneInput({ phone: "+61 412 345 678" })).toEqual({
      phone: "+61412345678",
    });
    expect(validatePhoneInput({ phone: "bad" })).toBeNull();
  });

  it("validates 6-digit verification code input format", () => {
    expect(
      validateVerifyCodeInput({ phone: "+61412345678", code: "123456" }),
    ).toEqual({
      phone: "+61412345678",
      code: "123456",
    });
    expect(
      validateVerifyCodeInput({ phone: "+61412345678", code: " 123 456 " }),
    ).toEqual({
      phone: "+61412345678",
      code: "123456",
    });
    expect(
      validateVerifyCodeInput({ phone: "+61412345678", code: "12345" }),
    ).toBeNull();
    expect(
      validateVerifyCodeInput({ phone: "+61412345678", code: "letters" }),
    ).toBeNull();
  });

  it("sends SMS verification code and returns debugCode in dev mode", async () => {
    const testPhone = "+61412999001";
    const result = await sendVerificationCode(testPhone);

    expect(result.success).toBe(true);
    expect(result.expiresInSeconds).toBeGreaterThan(0);
    expect(result.debugCode).toBeDefined();
    expect(result.debugCode).toMatch(/^\d{6}$/);

    // Verify rejection of rapid resends (cooldown)
    await expect(sendVerificationCode(testPhone)).rejects.toThrow(/wait/i);
  });

  it("rejects invalid codes and marks correct code as verified with token", async () => {
    const testPhone = "+61412999002";
    const sendResult = await sendVerificationCode(testPhone);
    const validCode = sendResult.debugCode!;

    // Wrong code attempt
    const failResult = await verifyCode(testPhone, "999999");
    expect(failResult.success).toBe(false);
    if (!failResult.success) {
      expect(failResult.error).toContain("Incorrect code");
    }

    // Correct code
    const successResult = await verifyCode(testPhone, validCode);
    expect(successResult.success).toBe(true);
    if (successResult.success) {
      expect(successResult.verified).toBe(true);
      expect(successResult.verificationToken).toBeDefined();

      // Verify token is valid for this phone
      const isTokenValid = await verifyPhoneToken(
        testPhone,
        successResult.verificationToken,
      );
      expect(isTokenValid).toBe(true);

      // Verify single-use token cannot be re-used
      const isReusedValid = await verifyPhoneToken(
        testPhone,
        successResult.verificationToken,
      );
      expect(isReusedValid).toBe(false);
    }
  });

  it("rejects tokens for different phone numbers", async () => {
    const phoneA = "+61412999003";
    const phoneB = "+61412999004";

    const sendRes = await sendVerificationCode(phoneA);
    const verifyRes = await verifyCode(phoneA, sendRes.debugCode!);
    expect(verifyRes.success).toBe(true);

    if (verifyRes.success) {
      // Trying to use Phone A's verification token with Phone B must fail
      const isValidForPhoneB = await verifyPhoneToken(
        phoneB,
        verifyRes.verificationToken,
      );
      expect(isValidForPhoneB).toBe(false);
    }
  });
});
