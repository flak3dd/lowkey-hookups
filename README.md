# LOWKEY hookups

A discreet, mobile-first Expo app for structured interest in someone you already know. There is no public profile, member directory, feed or people search.

## This build

This is a live app, not a mocked authentication demo. Secure account sign-in uses Manus OAuth. After sign-in, the user registers a private display name and phone number. **No SMS or OTP verifies the number.** Phone/name are matching data, not account authentication credentials.

The app includes private standing intent and photos, anonymous/named probes with previews, uniform Sent receipts, recipient-only interests, optional acceptance with a first reply, accepted text conversations, explicit identity reveal, hidden blocking, selected-evidence reports, private setup editing, inbox wipe, LOWKEY hookups data deletion and revocable logout.

Initial messages are structured Hook up / Date / Chat probes, not unsolicited free text. A recipient's reply is the first sender-visible participation signal. There are no membership, delivery, read, block, typing or online indicators.

## Important privacy limitations

Numbers and names are self-declared. This build cannot prove phone ownership or guarantee real-world recipient identity. Another person could claim a number. Ambiguous numbers are suppressed instead of routed to an arbitrary registration. Later signups do not receive previously undeliverable probes. Use this beta only with non-sensitive information.

Stored private payloads use server-managed protection, **not end-to-end encryption**. The service can decrypt them and knows account/routing metadata. “Anonymous” means hidden from the recipient, not from the operator. Authorized recipients can capture or share content outside the app. The adult-access check is self-attestation, not verified age.

The server-derived storage keys are coupled to the current application server secret. Changing that secret without a protected key migration can make stored content unreadable and change routing indexes. This is not independent production key-management or a cryptographic security audit.

Remote push is not configured. Open the app to refresh the live inbox. No biometric app lock is claimed. Reports are recorded for operator review; this build does not provide a staffed moderation service or promise a response time.

## Project commands

Use the pinned pnpm toolchain with the checked-in lockfile and workspace lifecycle policy.

```sh
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev
pnpm check
pnpm test
```

Metro/Web uses **8081**; the API uses **3000**. The managed project supplies API, database and OAuth environment values. Never put server credentials into Expo public configuration, source, logs or chat. Do not create alternate ports or hardcode temporary Preview addresses.

The database is shared across development and publication. Apply additive migrations deliberately; avoid destructive testing against real data. Deterministic tests use isolated doubles, never runtime fake authentication.

## Phone testing and native builds

Use Web Preview to inspect the interface. For a phone, open **Dashboard → Connect Expo**, enter the Expo credential in that protected form, and sign into Expo Go using the same Expo account. The platform supplies the current device address/QR. Refresh the project environment and restart Metro after authorization if requested; do not put an Expo token into chat.

A successful Web bundle does not verify native photo permissions, SecureStore, deep links, haptics or notifications. Test those on an actual phone before release. The project is configured with a distinct launcher/splash/adaptive icon and preserved native application identifiers.

Android APK/AAB and iOS/TestFlight builds are separate Dashboard actions from the recorded checkpoint. This delivery does not imply an App Store release or public deployment.

## Structure

`app/` contains Expo routes. `components/get-even/` contains the dark mobile design system. `lib/get-even/` contains the real client/session provider. `shared/get-even.ts` defines the live contract. `server/get-even/` implements owned private records and recipient routing. `server/auth-security.ts` implements bound OAuth flow and revocation storage. `drizzle/` contains additive schema and migrations. `tests/` contains deterministic security and domain checks.

## Public-launch gates

Before handling sensitive information at public scale: complete a reviewed endpoint-encryption/private-key-discovery design, strengthen number/person binding and recovery, implement the appropriate age policy, create operational safety/moderation and retention procedures, and complete device and security testing. Do not market this build as E2EE, verified identity, or complete protection from personal exposure.

## Verification completed in this session

TypeScript check passed. The final Expo Web export compiled all application routes. Forty deterministic tests passed across authentication, CORS, privacy policy and atomic submission creation. The read-only integration review's verified send-quota race was fixed with a sender-profile row lock around duplicate check, quota count and insert; a focused concurrent-request test covers it. Named identity snapshots preserve standing intent separately from the per-send intent.

The additive database migration is applied, with ten application/auth tables and three migration records. Both API and Metro are healthy. Unauthenticated private requests return 401; an untrusted browser origin returns 403. The actual OAuth begin endpoint creates a DB-bound authorization flow and sets the secure proof cookie without returning the Web verifier. The real runtime server-encryption round trip passed.

A full provider-login round trip, two-person live messaging, and physical-device native features have not been exercised. These checks are not a cryptographic audit or proof against every side channel. No public deployment or native release artifact has been created.

## Contact-batch update

After a first successful private signup, the app offers optional contact-batch onboarding. Skip goes straight to Home; editing an existing profile does not repeat onboarding. Home has a chosen-contacts shortcut.

The new screen supports the SDK 57 native picker, an explicitly permissioned import of up to 200 accessible device contacts, a secure top-level browser contact picker where supported, multiline/CSV/tab paste, manual labels/numbers, local search and selection, and unsendable sample contacts. Only explicit international numbers are accepted; no country is guessed. Address-book entries and names stay in component memory. The draft is isolated by account/profile and disappears when the screen is removed. Imported contacts are not automatically selected or submitted.

Select up to 20 real recipients within the shared 20-per-24-hour single-and-batch quota. Choose Hook up / Date / Chat and Anonymous/Named, review every number and the identity preview, then explicitly confirm sending. Contact names are not uploaded by this UI or stored by the batch backend. Samples are rejected by the client and server.

`POST /api/get-even/probes/mass` returns only an opaque batch ID, Sent, and input-only submitted count. It does not query reciprocal probes or recipient registrations, return mutual matches, or expose member/delivery/read/block counts. A sender-locked database transaction enforces all-or-none quota and batch retry idempotency; a changed semantic payload cannot reuse the same batch key. Normal receipts use the existing deferred, recipient-controlled routing.

`pnpm qr` uses the current token-free managed Expo device address automatically, prints a terminal QR and writes `expo-qr-code.png` / `.svg`. The nonfatal API startup hook renders the same outputs. No sandbox LAN IP is guessed. Generated files are ignored by Git and must be regenerated when the managed address changes. A QR image is not proof of Expo authorization or a successful phone connection: Connect Expo in Dashboard and use the same Expo account in Expo Go.

Native contact permission/picker behavior and a full phone messaging flow remain unverified on a physical device. Browser picking is unavailable in unsupported browsers and embedded Preview; paste and manual entry remain usable. Numbers remain self-declared and storage remains server-managed encryption, not E2EE. No live contact probes were sent during development.

The final batch contract accepts phone-only contact entries; labels, sample markers and unexpected fields are rejected. Local label sanitation remains in the contact utility. The connected review found this one API-boundary mismatch and it was corrected with focused validation coverage.

For this update, 64 deterministic tests passed, TypeScript passed, and the full Expo Web export compiled 17 routes including `/mass-probe`. The additive batch migration is applied. Actual current managed QR PNG/SVG exports were generated and checked, and generated QR assets are ignored by Git. Physical-device contact access, Expo authorization and full two-person live messaging remain unverified; no live probes were sent during development.

## Adopted LOWKEY visual identity

The app now uses the approved ruby-red lips logo with warm charcoal surfaces, off-white text, rose borders and stronger headline typography. The real logo lockup is bundled in headers; matching lips artwork is used for launcher, splash, favicon and Android adaptive/monochrome icons. The name shown to users is LOWKEY hookups. The original Expo slug, bundle/package identifiers and deep-link scheme remain unchanged for sign-in compatibility.

Shared brand and semantic color tokens live in `constants/branding.ts`; `components/get-even/ui.tsx` and the generic shell palette use the same colors. Production screens contain no old blue accents or legacy Get Even display labels. No backend, auth, database, receipt, contact or safety behavior changed as part of the visual rebrand. The native icon appearance/display name requires a rebuilt installed app; Web Preview and a native release build are not equivalent.

Rebrand verification: 67 tests and TypeScript passed; Web export compiled all 17 routes. Key color contrasts and original native identifiers are covered by branding tests. No new native release build or physical-device verification is claimed.

## App info and discretion pillars

App info is available from both Home entry states and Private. It presents the three-step journey in LOWKEY's ruby/charcoal design, with a link to the six pillars on Privacy. The journey reflects the live beta: recipient acceptance plus a voluntary reply opens chat; merely submitting reciprocal probes does not. A recipient may view a probe or a Named identity without replying.

The six pillars cover no rejection/delivery/read receipts, no target SMS, contact batching with submitted-only counts, no public directory, default anonymous probes with explicit individual identity reveal, and optional silence. They do not promise zero real-world rejection or social fallout, expose mutual-match counts, or claim an unimplemented two-party reveal protocol. The detailed beta limitations and safety/data controls remain on Privacy. This update changes explanatory UI, not the backend, auth or matching policy.

Verification for this update: 70 tests and TypeScript passed, the Web export compiled 18 routes including App info, and the iPhone JavaScript bundle returned HTTP 200. Expo, API and App info listeners returned HTTP 200. These checks do not claim a physical iPhone completed a live messaging flow.
