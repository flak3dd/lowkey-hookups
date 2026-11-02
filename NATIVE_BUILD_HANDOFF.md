# LOWKEY Native Build Handoff

## Generated native projects

Expo prebuild completed successfully from commit `13d1934`.

- Android project: `android/`
- iOS project: `ios/`
- Bundle/package identifier: `space.manus.geteven.t063584009839075`
- App name: `LOWKEY hookups`
- Version: `1.0.0`

The generated project sources are packaged as `LOWKEY_NATIVE_PROJECTS.tar.gz` for transfer to a native build machine.

## Build commands

### Android

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm exec expo run:android --variant release
```

Or use EAS after configuring the Expo project and Android signing credentials:

```bash
npx eas-cli build --platform android --profile production
```

### iOS

Run on macOS with Xcode and CocoaPods installed:

```bash
pnpm install --frozen-lockfile
cd ios && pod install && cd ..
pnpm exec expo run:ios --configuration Release
```

Or use EAS with Apple credentials:

```bash
npx eas-cli build --platform ios --profile production
```

## Current environment blockers

This Linux sandbox cannot produce signed native binaries:

- Android SDK, `adb`, and Gradle are not installed.
- iOS native builds require macOS/Xcode.
- No `eas.json` is configured.
- No `EXPO_TOKEN` or EAS project ID is configured.
- No Android keystore or Apple signing credentials are available.
- `EXPO_PUBLIC_API_BASE_URL` is not configured for a production backend.

The Android probe failed with `spawn adb ENOENT`; the iOS probe correctly reported that iOS builds must run on macOS or through EAS.

## Release configuration still required

Before distribution, configure:

1. Production API base URL through `EXPO_PUBLIC_API_BASE_URL`.
2. EAS project linkage and production build profile.
3. Android application signing / Play Console credentials.
4. Apple team, provisioning, certificates, and App Store Connect credentials.
5. Production auth, SMS, database, and encryption secrets on the backend.
