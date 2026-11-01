import { resolveExpoQrUrl, writeExpoQr } from "../../scripts/expo-qr.mjs";

/** Called once on API startup. QR failures never prevent the listener from serving. */
export async function generateExpoQr(): Promise<void> {
  try {
    const resolution = resolveExpoQrUrl({ env: process.env });
    if (!resolution.url) {
      console.warn(
        `[expo-qr] QR unavailable: ${resolution.reason}; API startup continues`,
      );
      return;
    }
    const rendered = await writeExpoQr(resolution.url);
    console.log(`[expo-qr] Expo Go URL: ${resolution.url}`);
    process.stdout.write(`${rendered.terminal}\n`);
    console.log(
      "[expo-qr] saved expo-qr-code.png and expo-qr-code.svg; use the same Expo account on the phone",
    );
  } catch {
    console.warn("[expo-qr] QR generation failed; API startup continues");
  }
}
export const reportExpoQrStartup = generateExpoQr;
