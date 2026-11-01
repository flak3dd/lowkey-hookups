# Get Even — live Expo implementation plan

## Current approved model

Build an Expo app with a live backend, not a simulation. The user's correction is that a phone number identifies a private signup record through its registered name; it does not need SMS verification. Signup collects a private name and phone number. There is no Twilio integration, OTP, SMS or phone-ownership-verification claim. Real account sign-in uses the starter's Manus OAuth separately; the number is matching data, not an authentication credential. Never expose a registered name or membership when another user enters a number.

Numbers are self-declared. Someone could claim another person's number; therefore this version cannot guarantee real-world recipient identity. State that limitation clearly in signup, compose and privacy. Multiple live registrations for a number make it ambiguous and suppress routing rather than choosing an arbitrary recipient. No pending probes are delivered to people who register later. A real person must voluntarily reply before the sender gets any participation signal.

## Live infrastructure and security

Keep the installed Expo Router / React Native / TypeScript / NativeWind starter, managed Express API and MySQL-compatible database. Preserve native IDs and runtime ports Metro 8081/API 3000. Use real server-validated Manus sessions, Native SecureStore and cross-site HTTPS cookies. No invented Preview accounts. Do not publicly deploy during the build.

Create owned profile, receipt, probe, thread/message, block, report and session-revocation records. Apply additive migrations. Use server-side authorization for all private content. Internal phone routing uses a domain-separated keyed index derived from the existing server secret; sensitive stored payloads may use server-managed encryption with an explicit key-rotation limitation. This is not E2EE, not operator blindness, and not verified phone identity. The service can decrypt stored content; disclose this. A reviewed E2EE/key-discovery design, stronger recovery/number-binding, age assurance and safety operations remain public-launch gates.

Only the account owner sees their private setup. Anonymous receiver records contain no sender name, phone, public account ID or photo reference. Named records contain the explicitly previewed identity snapshot only. Media is served only through authenticated API payloads or protected endpoints, never public upload URLs. Do not cache messages, phone numbers or photos in browser localStorage.

## Product flows

Logged-out brand entry and real sign-in; private signup name/number/18+ attestation/standing intent/photos; private home; manual number compose; Hook up / Date / Chat and Anonymous/Named selection; recipient preview; opaque Sent acknowledgement; private inbox/open/ignore/accept-plus-reply; accepted text threads; explicit confirmed reveal; block/report; private profile; privacy explanation; block list; wipe inbox; delete Get Even data; logout.

Valid accepted submissions always return the same receipt shape and Sent state independent of membership, block or ambiguity. Queue routing after acknowledgement, cap first-contact attempts and use idempotency. Do not return recipient status, delivery/read state, expiry notices or billing differences. No member directory, public profile, feed, contact upload, discovered people, typing/online/read/delivery indicators or target SMS. Named identity can be seen without a reply. A reply never automatically reveals an anonymous sender or recipient's identity card. Recipient acceptance and sender reveal are distinct decisions.

Use genuine empty states for empty accounts. No fictional users, seed conversations, fake notifications or fake app lock. Remote push is not configured initially; explain that the inbox refreshes in-app. Photos are private bounded local selections uploaded only to authorized live API records. Delete actions use controlled cross-platform confirmation and accurately state controlled-copy limitations.

## Structure

`app/` holds auth/signup, tabs and compose/inbox/thread/privacy routes. `components/get-even/` provides the shell and reusable controls. `lib/get-even/` holds the real API/session provider. `shared/get-even.ts` owns the frontend/backend contract. `server/get-even/` holds owned REST services, routing and security. `drizzle/` holds additive live tables. `assets/images/` holds native branding. `tests/` covers authorization and privacy-sensitive transitions. Preserve the supplied managed infrastructure.

## Design

Use the approved LOWKEY hookups theme: warm charcoal #101113, off-white #F4F1EB, ruby/coral #E65A68, rose borders and bold editorial sans-serif typography. The actual ruby lips artwork and LOWKEY hookups lockup lead the presentation. A restrained concentric-ring motif frames the lips on entry and Home. Use portrait asymmetric headlines, vertical warm-surface cards, generous space, small uppercase metadata and reachable ruby controls. No public grid and no replacement lettering or generic stock imagery. Preserve the native launcher artwork without baked-in rounded corners.

Use platform system sans with bold headlines, medium labels and 15–16 px body copy. Short 160–220 ms feedback, no urgency or simulated delivery animation, respect reduced motion. Confirm identity reveal and deletion. The sensual theme suggests chemistry while remaining direct and respectful: “Feel the chemistry. Keep it lowkey.” and “No reply is a complete answer.” Never revenge, social debt or guaranteed no-exposure/rejection claims.

## Handoff

Finish the connected Expo UI and backend, apply migrations, verify typecheck/tests and both listeners, run one read-only connected implementation review, fix confirmed issues and save a canonical checkpoint. Use Dashboard Connect Expo for Expo Go; native release builds are separate actions. Do not claim tested physical-device/SMS/push/E2EE/public-release features without evidence. Document actual security limitations and genuine blockers.

## Approved update: optional contact batching

The user approved applying a privacy-preserving version of the proposed mass-probe flow. After a new profile is first saved, redirect to an optional `app/mass-probe.tsx` route before Home; editing an existing profile returns directly to the app. Every user may reopen this route from Home. The flow is skippable, never imports contacts automatically, and never sends on signup.

Users can choose batch Hook up / Date / Chat and Anonymous/Named, explicitly import from a native contact picker/library permission or a supported browser Contact Picker API, paste international phone numbers and names, add manually, load clearly marked unsendable samples, search, toggle individual rows, and select/deselect sendable contacts. Keep the working list in component memory only, deduplicate normalized E.164 numbers, exclude self, and require explicit country codes rather than guessing. Native and browser contact APIs are platform-gated; unsupported browsers retain paste/manual alternatives. Names remain local labels, not profile lookup results. Import itself makes no server request.

Cap a batch at 20 unique real recipients within the existing 20/24-hour sender quota. Show the complete selected list, intent and identity preview before a deliberate confirmed send, including named-photo exposure and unverified-number/non-E2EE warnings. All batch receipt inserts, quota enforcement and batch retry idempotency are one sender-locked transaction in the real managed database. Only normal opaque individual receipts queue existing deferred routing. Return an opaque batch ID, Sent, and the count submitted based solely on the user's input. Never query reciprocal probes or return matchCount, member counts, routing outcomes, delivery/reads, per-contact status or any pre-reply participation signal. A whole-batch retry must return the same acknowledgement even at quota, and reusing a batch client ID with changed targets/intent/mode must fail generically without new sends. Sample phone numbers are rejected by both client and server.

Implement the batch contract in `shared/get-even.ts`, validation/router/profiles plus one additive batch-idempotency table; keep contact parsing/platform helpers in `lib/get-even/contacts.ts` and `lib/get-even/contact-import.ts`; reuse the existing design system. Record local names only for selection/review; do not persist or upload an address book, store contact labels, or change routing/membership privacy. Brand copy should express private interest honestly, not guarantee no exposure, rejection or awkwardness.

Upgrade `pnpm qr` to use the current platform-provided managed Expo address, produce PNG/SVG and a terminal QR, and invoke a nonfatal helper on backend startup. Do not guess a sandbox LAN IP, request/print Expo credentials, or commit generated QR assets/temporary URLs. Connect Expo and actual phone/native API testing remain user/device steps.

### Final batch contract boundary

The connected review identified that optional contact names in the API schema would permit labels to reach the server even though the UI did not send them. The final mass-probe contract therefore accepts only `{phone}` contact entries and rejects `name`, client sample flags and all extra fields. Label parsing and sanitation remain exclusively in the local contact utility. Known sample phone numbers remain independently rejected by the server. No pre-reply mutual-match count was added. This supersedes the earlier optional-name shape in this update's draft plan.

## Approved rebrand: LOWKEY hookups

Adopt the user's approved ruby-red lips logo and its theme throughout the existing Expo app. Keep the charcoal base, warm off-white wordmark and a ruby/coral accent (#E65A68), with warm charcoal cards, muted rose borders and bolder typography matching the logo. Use the actual accepted lockup in app headers and a matching isolated lips symbol for launcher, favicon, splash and Android adaptive/monochrome assets. Keep all artwork content and proportions intact; no new wordmark typography is drawn over the image. Create only the planned native-alpha lips asset needed for native icon formats.

Expose centralized brand name and semantic theme tokens. Replace old blue accents and old Get Even user-facing labels across Home, Inbox, Private setup, compose, onboarding/mass-probe, recipient details, accepted conversations, privacy/safety screens and OAuth callback display. The tone may suggest chemistry/desire but must not promise no rejection/exposure, invent matching, remove Date/Chat options, pressure recipients or weaken warnings. Primary CTA foreground should contrast against the ruby accent; danger states remain distinguishable by wording/icons and a separate warm danger tone.

Preserve the original Expo slug `geteven`, generated bundle/package IDs, deep-link scheme, native permissions, database names, API routes, real sign-in, receipts, reveal/safety flows, quotas and contact privacy. No migration or new infrastructure is required. Reuse the active API/Metro listeners and fixed ports. Parent owns brand/theme components, asset adaptation and native config; a bounded parallel implementation updates screen presentation only. The existing project structure and approved application behavior remain unchanged.

## App info and the six pillars

Add a LOWKEY-styled App info route with the requested 3-Step Journey and reachable links from Home and Private, plus a link to the privacy page. Reuse the ruby/charcoal components and actual logo. Private setup and discreet probe descriptions follow the requested flow. The current third step is recipient acceptance plus a voluntary reply, not automatic reciprocal-probe matching; state that precisely, and do not claim an unseen/unaccepted probe is invisible to its recipient. A named identity can be viewed without replying.

Present The 6 Pillars of Discretion on the existing privacy page: no rejection/delivery/read receipts (not zero real-world rejection risk), no target SMS/spam, mass contact probes with input-only submitted counts (not mutual-match signals), no public directory, Anonymous by default with explicit per-person identity reveal in accepted chat (not an unimplemented two-party reveal-confirmation protocol), and optional silence without hidden-status feedback (not a guarantee of no social fallout). Retain every existing beta limitation, self-declared number/age warning, operator-readable encryption disclosure, screenshot/deletion limits, expiry and safety controls. This request is explanatory UI copy; it does not authorize quietly replacing the live chat/matching engine or adding privacy-leaking match counts. Shared copy can live in `constants/app-info.ts`; no schema/auth/API changes are needed.

## Strengthened LOWKEY theme presentation

The user asked to use the new design theme in the currently open Preview. The LOWKEY palette is already wired, but the initial browser view does not make the lips/logo visibly prominent. Keep the approved ruby/charcoal/off-white design, use the real logo lockup more prominently, add a restrained reusable lips-led brand motif on the entry/home presentation, and carry refined ruby-bordered surfaces and reachable controls through the shared components. Reuse existing art, do not invent matching or change the approved privacy copy, and do not replace the Expo framework, native IDs or live backend. Verify actual rendered asset state before altering any asset paths. Diagnose the observed raw-Preview connection error separately; only fix a confirmed address/proxy issue without weakening real authentication or CORS.

## Approved change: single 💋 Kiss intent and new landing copy

The user approved collapsing Hook up / Date / Chat into one intent, `Kiss`, shown as 💋. This supersedes the rebrand rule above about not removing Date/Chat options. `INTENTS` in `shared/get-even.ts` is `["Kiss"]`; the symbol is display-only via `INTENT_SYMBOL`/`intentLabel`. All four `intent` enum columns are `enum('Kiss')`. Migration `0004_kiss_intent.sql` widens the enum, rewrites existing rows to `Kiss`, then narrows. Older encrypted identity snapshots may still contain a retired value and display it as plain text. The server rejects the retired values.

The signed-out landing headline is now "For that sexual tension, that's never been acted on." It is followed by the "stare down" question and a "A way to make your intent clear" list: without the risk / without the fear of rejection / without social humiliation. These lines are user-approved marketing copy. The privacy page and pillars keep their existing accurate limits.
