export type ExpoQrSource =
  | "argument"
  | "EXPO_APP_QR_URL"
  | "EXPO_PACKAGER_PROXY_URL";

export type ExpoQrResolution =
  | { url: string; source: ExpoQrSource; reason: null }
  | { url: null; source: null; reason: string };

export function tokenFreeExpoUrl(value: unknown): string | null;
export function managedPackagerExpoUrl(value: unknown): string | null;
export function resolveExpoQrUrl(options?: {
  argument?: unknown;
  env?: Record<string, string | undefined>;
}): ExpoQrResolution;

export function writeExpoQr(
  url: string,
  options?: { directory?: string },
): Promise<{ pngPath: string; svgPath: string; terminal: string }>;
