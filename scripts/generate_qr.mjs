#!/usr/bin/env node
import { resolveExpoQrUrl, writeExpoQr } from "./expo-qr.mjs";

const [argument, ...extraArguments] = process.argv.slice(2);
if (extraArguments.length > 0) {
  console.error("Usage: pnpm qr [token-free exp:// or exps:// URL]");
  process.exitCode = 1;
} else {
  const resolution = resolveExpoQrUrl({ argument });
  if (!resolution.url) {
    console.error(`[expo-qr] unavailable: ${resolution.reason}`);
    process.exitCode = 1;
  } else {
    try {
      const rendered = await writeExpoQr(resolution.url);
      console.log(`Expo URL: ${resolution.url}`);
      process.stdout.write(`${rendered.terminal}\n`);
      console.log("Saved expo-qr-code.png and expo-qr-code.svg");
    } catch {
      console.error(
        "[expo-qr] generation failed; check writable output directory",
      );
      process.exitCode = 1;
    }
  }
}
