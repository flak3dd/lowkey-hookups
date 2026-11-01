import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const qr = vi.hoisted(() => ({ resolve: vi.fn(), write: vi.fn() }));
vi.mock("../scripts/expo-qr.mjs", () => ({
  resolveExpoQrUrl: qr.resolve,
  writeExpoQr: qr.write,
}));
import { generateExpoQr } from "../server/_core/qr";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterEach(() => vi.restoreAllMocks());
describe("nonfatal automatic Expo QR startup", () => {
  it("renders the resolved managed URL and prints its terminal QR", async () => {
    qr.resolve.mockReturnValue({
      url: "exps://managed.example.test",
      source: "EXPO_APP_QR_URL",
      reason: null,
    });
    qr.write.mockResolvedValue({
      pngPath: "test.png",
      svgPath: "test.svg",
      terminal: "test-terminal-qr",
    });
    await expect(generateExpoQr()).resolves.toBeUndefined();
    expect(qr.write).toHaveBeenCalledWith("exps://managed.example.test");
    expect(process.stdout.write).toHaveBeenCalledWith("test-terminal-qr\n");
  });
  it("missing safe configuration leaves the API startup unaffected", async () => {
    qr.resolve.mockReturnValue({
      url: null,
      source: null,
      reason: "not configured",
    });
    await expect(generateExpoQr()).resolves.toBeUndefined();
    expect(qr.write).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("API startup continues"),
    );
  });
  it("a failed renderer is caught and does not prevent API startup", async () => {
    qr.resolve.mockReturnValue({
      url: "exps://managed.example.test",
      source: "EXPO_APP_QR_URL",
      reason: null,
    });
    qr.write.mockRejectedValue(new Error("test output failure"));
    await expect(generateExpoQr()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("API startup continues"),
    );
  });
});
