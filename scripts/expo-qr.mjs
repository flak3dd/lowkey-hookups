import path from "node:path";
import QRCode from "qrcode";

const EXPO_PROTOCOLS = new Set(["exp:", "exps:"]);
const PACKAGER_PROTOCOLS = new Set(["http:", "https:"]);

function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (!url.hostname || url.username || url.password || url.search || url.hash)
      return null;
    return url;
  } catch {
    return null;
  }
}

function serializeExpoUrl(url, protocol) {
  const pathname = url.pathname === "/" ? "" : url.pathname;
  return `${protocol}//${url.host}${pathname}`;
}

/** Accept only token-free Expo Go URLs supplied directly or by the managed runtime. */
export function tokenFreeExpoUrl(value) {
  const url = safeUrl(value);
  if (!url || !EXPO_PROTOCOLS.has(url.protocol)) return null;
  return serializeExpoUrl(url, url.protocol);
}

/** Convert the configured managed packager proxy into the Expo Go URL form. */
export function managedPackagerExpoUrl(value) {
  const url = safeUrl(value);
  if (!url || !PACKAGER_PROTOCOLS.has(url.protocol)) return null;
  return serializeExpoUrl(url, url.protocol === "https:" ? "exps:" : "exp:");
}

/**
 * Picks the current Expo device URL without LAN discovery or credentials.
 * EXPO_APP_QR_URL is authoritative; the configured packager proxy is a fallback.
 */
export function resolveExpoQrUrl({ argument, env = process.env } = {}) {
  if (argument !== undefined) {
    const url = tokenFreeExpoUrl(argument);
    return url
      ? { url, source: "argument", reason: null }
      : {
          url: null,
          source: null,
          reason: "the explicit URL must be a token-free exp:// or exps:// URL",
        };
  }

  const appQrUrl = tokenFreeExpoUrl(env.EXPO_APP_QR_URL);
  if (appQrUrl)
    return { url: appQrUrl, source: "EXPO_APP_QR_URL", reason: null };

  const packagerUrl = managedPackagerExpoUrl(env.EXPO_PACKAGER_PROXY_URL);
  if (packagerUrl)
    return {
      url: packagerUrl,
      source: "EXPO_PACKAGER_PROXY_URL",
      reason: null,
    };

  const hasAppQrUrl = Boolean(env.EXPO_APP_QR_URL);
  const hasPackagerUrl = Boolean(env.EXPO_PACKAGER_PROXY_URL);
  if (!hasAppQrUrl && !hasPackagerUrl) {
    return {
      url: null,
      source: null,
      reason: "EXPO_APP_QR_URL and EXPO_PACKAGER_PROXY_URL are not configured",
    };
  }

  return {
    url: null,
    source: null,
    reason: "managed Expo URL configuration is missing or unsafe",
  };
}

/** Generate ephemeral assets only; callers decide how to print the terminal output. */
export async function writeExpoQr(url, { directory = process.cwd() } = {}) {
  const safe = tokenFreeExpoUrl(url);
  if (!safe) throw new Error("Unsafe Expo QR URL");
  const pngPath = path.join(directory, "expo-qr-code.png");
  const svgPath = path.join(directory, "expo-qr-code.svg");
  const options = { errorCorrectionLevel: "M", margin: 2, width: 512 };
  const terminal = await QRCode.toString(safe, {
    type: "terminal",
    errorCorrectionLevel: "M",
  });
  await Promise.all([
    QRCode.toFile(pngPath, safe, options),
    QRCode.toFile(svgPath, safe, { ...options, type: "svg" }),
  ]);
  return { pngPath, svgPath, terminal };
}
