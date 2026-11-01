import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({
  platform: { OS: "web" },
  picker: vi.fn(),
  details: vi.fn(),
  permissions: vi.fn(),
  request: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: native.platform }));
vi.mock("expo-contacts", () => ({
  ContactField: { FULL_NAME: "fullName", PHONES: "phones" },
  Contact: { presentPicker: native.picker, getAllDetails: native.details },
  getPermissionsAsync: native.permissions,
  requestPermissionsAsync: native.request,
}));
import {
  contactPickerAvailable,
  importDeviceContacts,
} from "../lib/get-even/contact-import";

beforeEach(() => {
  vi.clearAllMocks();
  native.platform.OS = "web";
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
function browser(
  select = vi
    .fn()
    .mockResolvedValue([
      { name: ["Local label"], tel: ["+61412345678", "0412 345 678"] },
    ]),
  secure = true,
  embedded = false,
) {
  const frame: any = { isSecureContext: secure };
  frame.self = frame;
  frame.top = embedded ? {} : frame;
  vi.stubGlobal("window", frame);
  vi.stubGlobal("navigator", { contacts: { select } });
  return select;
}
describe("explicit local contact access", () => {
  it("invokes the browser picker synchronously from the gesture and never uploads contacts", async () => {
    const select = browser();
    expect(contactPickerAvailable()).toBe(true);
    const promise = importDeviceContacts();
    expect(select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
    const result = await promise;
    expect(result.contacts).toMatchObject([
      { name: "Local label", phone: "+61412345678", source: "device" },
    ]);
    expect(result.skipped).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [false, false],
    [true, true],
  ])(
    "rejects insecure or embedded browser contexts",
    async (secure, embedded) => {
      const select = browser(vi.fn(), secure, embedded);
      expect(contactPickerAvailable()).toBe(false);
      await expect(importDeviceContacts()).rejects.toThrow("paste or add");
      expect(select).not.toHaveBeenCalled();
    },
  );
  it("a cancelled native picker does not read the full library or request permission", async () => {
    native.platform.OS = "ios";
    native.picker.mockResolvedValue(null);
    expect(await importDeviceContacts()).toEqual({ contacts: [], skipped: 0 });
    expect(native.permissions).not.toHaveBeenCalled();
    expect(native.request).not.toHaveBeenCalled();
    expect(native.details).not.toHaveBeenCalled();
  });
  it("explicit library import respects denied permission and does not fetch contacts", async () => {
    native.platform.OS = "android";
    native.permissions.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    await expect(importDeviceContacts("library")).rejects.toThrow(
      "permission was not granted",
    );
    expect(native.details).not.toHaveBeenCalled();
    expect(native.request).not.toHaveBeenCalled();
  });
  it("requests permission only for explicit library import and bounds retrieved fields/rows", async () => {
    native.platform.OS = "android";
    native.permissions.mockResolvedValue({ granted: false, canAskAgain: true });
    native.request.mockResolvedValue({ granted: true, canAskAgain: true });
    native.details.mockResolvedValue([
      { fullName: "Local label", phones: [{ number: "+61412345678" }] },
    ]);
    expect((await importDeviceContacts("library")).contacts).toHaveLength(1);
    expect(native.request).toHaveBeenCalledOnce();
    expect(native.details).toHaveBeenCalledWith(["fullName", "phones"], {
      limit: 200,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
