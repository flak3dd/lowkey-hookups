# LOWKEY Candidate UX + Workflow — Development Handoff

**Status:** Ready for implementation review  
**Source commit:** `2c58e17` (`Enhance candidate guessing UI states`)

## 1. Product contract

A **candidate** is created only after two users have sent anonymous probes to each other. No candidate, membership signal, or app-presence signal is exposed from a one-way probe.

Each participant receives two guesses. A correct guess marks that participant as recognized. If both participants are correct, the server creates one private thread, marks both probes accepted, and stores encrypted identity snapshots so the chat opens with both names revealed.

Two incorrect guesses set a durable 24-hour `lockedUntil` timestamp. The candidate remains visible in the inbox as paused, but guessing is disabled until the server confirms the lock has elapsed.

## 2. Route map

| Surface | Route | Purpose |
|---|---|---|
| Inbox | `app/(tabs)/inbox.tsx` | Interests, Candidates, and Conversations tabs |
| Candidate detail | `app/candidate/[id].tsx` | Open, green-light, paused, and unlocked states |
| Incoming interest | `app/interest/[id].tsx` | Ignore or send an anonymous reciprocal probe |
| Chat | `app/thread/[id].tsx` | Automatically named conversation after unlock |

## 3. Candidate inbox UI contract

The Candidates tab is visible for authenticated users even when empty. Candidate cards are full-surface tappable and show:

- Anonymous candidate icon, never a person name or photo.
- `Two probes. Two guesses.` as the stable card title.
- Two horizontal progress bars. Filled bars represent remaining attempts.
- State label: `OPEN`, `GREEN LIGHT`, `PAUSED 24H`, or `UNLOCKED`.
- State description: remaining guesses, other-side correct state, paused state, or revealed-chat state.
- `View candidate` affordance with a chevron.

The empty state reads `No mutual candidates yet.` and explains that the game appears only after both people send an anonymous probe.

## 4. Candidate detail UI contract

### Open

- Header icon: anonymous eye-off mark.
- Title: `Two guesses. One possibility.`
- Explanatory text: both people sent anonymous probes; the user must guess the verified number without exposing their identity.
- Progress: `N OF 2 GUESSES REMAINING` with two bars.
- Input: E.164 phone number, presentation separators accepted.
- Primary action: `Make anonymous guess`.

### Green light

When `otherGuessedCorrectly=true`, show an accent note: `GREEN LIGHT. They recognized you and are waiting for your correct guess.` Keep the same input and guess action. This is not a read receipt or online indicator.

### Paused

When the server returns an active `lockedUntil`, show `TWO INCORRECT GUESSES`, a 24-hour pause explanation, a live remaining-time label, and a disabled `Guessing paused` button. The candidate remains visible.

### Unlocked

When `threadId` exists, show `CHAT UNLOCKED`, explain that both names are now revealed, and provide `Open revealed chat`. Do not show a manual identity-reveal control.

## 5. API contract

```text
POST /api/get-even/inbox/:id/accept
  -> { candidateId }
  Sends an anonymous reciprocal probe and creates/reuses the mutual candidate.

GET /api/get-even/candidates
  -> { items: CandidateSummary[] }

GET /api/get-even/candidates/:id
  -> { candidate: CandidateSummary }

POST /api/get-even/candidates/:id/guess
  body: { phone: string }
  -> { candidate: CandidateSummary }
```

`CandidateSummary`:

```ts
{
  id: string;
  guessesRemaining: number;
  otherGuessedCorrectly: boolean;
  lockedUntil: string | null;
  threadId: string | null;
  createdAt: string;
}
```

## 6. State machine

```text
ONE-WAY PROBE
  └─ no candidate; no membership signal

RECIPROCAL PROBES
  └─ OPEN candidate; guessesRemaining = 2
       ├─ incorrect guess #1 -> OPEN; guessesRemaining = 1
       ├─ incorrect guess #2 -> PAUSED; lockedUntil = now + 24h
       ├─ correct guess -> participant correct flag = true
       │    ├─ other participant incorrect/pending -> GREEN LIGHT for other side
       │    └─ both correct -> UNLOCKED; create one thread; reveal both names
       └─ active lock -> return paused candidate without changing counters

LOCK EXPIRES
  └─ server resets the attempt window on the next guess request
```

## 7. Persistence model

`getEvenCandidates` stores:

- `probeAId`, `probeBId`: unique reciprocal probe pair.
- `participantAUserId`, `participantBUserId`: participant ownership, not exposed to clients.
- Per-participant guess counts and correct flags.
- `lockedUntil`: durable 24-hour pause.
- `threadId`: exactly one unlocked conversation.
- `createdAt`, `updatedAt`: inbox ordering and auditability.

The server compares guessed numbers against the other profile’s phone HMAC. Plain-text guessed numbers are not persisted in candidate records.

## 8. Privacy and concurrency requirements

1. Return neutral unavailable behavior for blocked, expired, deleted, or unauthorized candidates.
2. Do not reveal whether a target uses LOWKEY from a one-way probe or a failed guess.
3. Use a transaction for guess updates and thread creation.
4. Preserve idempotency when a correct-guess response is retried.
5. Prevent a third guess while `lockedUntil` is active.
6. Keep the green light informational and private.
7. The client may format countdown copy, but the server owns lock authorization.

## 9. Verification evidence

- `pnpm check` passes.
- Candidate boundary tests pass: `tests/candidate-workflow.test.ts`.
- Focused app/workflow suite passes: 16 tests.
- Edge-case matrix: `CANDIDATE_EDGE_CASES.md`.
- Wireframes: `CANDIDATE_WIREFRAMES.md`.
