# LOWKEY Candidate Inbox + Guessing Screen Wireframes

## Product rule
A candidate exists only after two people send anonymous probes to each other. Each participant gets two guesses. Two incorrect guesses close the candidate for 24 hours. A green light means the other participant guessed correctly and is waiting. Chat unlocks only after both guesses are correct; the chat reveals both names automatically.

## 1. Inbox tab — Candidates

```text
┌────────────────────────────────────┐
│ LOWKEY                             │
│ YOU HOLD THE NEXT STEP             │
│ On your terms.                     │
│ Probe back, guess, or leave it.    │
├────────────────────────────────────┤
│ Interests │ Candidates │ Chats     │
├────────────────────────────────────┤
│ ANONYMOUS CANDIDATE                │
│ Two probes. Two guesses.           │
│ 2 guesses remaining.               │
│ Open candidate                 →   │
├────────────────────────────────────┤
│ ANONYMOUS CANDIDATE                │
│ Two probes. Two guesses.           │
│ Green light: they recognized you.  │
│ Open candidate                 →   │
├────────────────────────────────────┤
│ No read receipts. No online status.│
└────────────────────────────────────┘
```

### Interaction rules
- The tab is visible to authenticated users even when empty.
- A candidate card is tappable across its full surface.
- Status copy is driven by state: `Open candidate`, `Green light: they recognized you and are waiting`, `Locked for 24 hours`, or `Chat unlocked`.
- Locked candidates remain visible; tapping them explains the remaining lock time.
- Empty state: “No mutual candidates yet.” / “When you both send an anonymous probe, the guessing game appears here.”
- Loading state uses the existing LOWKEY spinner; error state keeps the existing retry pattern.

## 2. Guessing screen — default

```text
┌────────────────────────────────────┐
│ ‹  Anonymous candidate             │
├────────────────────────────────────┤
│ MUTUAL PROBE                       │
│ Two guesses. One possibility.      │
│                                    │
│ Both of you sent an anonymous      │
│ probe. You have 2 guesses          │
│ remaining.                         │
│                                    │
│ WHO DO YOU THINK IT IS?            │
│ ┌────────────────────────────────┐ │
│ │ +61 412 345 678                │ │
│ └────────────────────────────────┘ │
│                                    │
│ [ Make anonymous guess ]           │
│                                    │
│ Chat unlocks only after both       │
│ people guess correctly. Once       │
│ unlocked, both names are shown.    │
└────────────────────────────────────┘
```

## 3. Guessing screen — green light

```text
┌────────────────────────────────────┐
│ ‹  Anonymous candidate             │
├────────────────────────────────────┤
│ MUTUAL PROBE                       │
│ Two guesses. One possibility.      │
│                                    │
│ Both of you sent an anonymous      │
│ probe. You have 1 guess remaining.│
│                                    │
│ ✓ GREEN LIGHT                      │
│ They recognized you and are        │
│ waiting for your correct guess.    │
│                                    │
│ WHO DO YOU THINK IT IS?            │
│ [ phone input ]                    │
│ [ Make anonymous guess ]           │
└────────────────────────────────────┘
```

## 4. Guessing screen — locked

```text
┌────────────────────────────────────┐
│ ‹  Anonymous candidate             │
├────────────────────────────────────┤
│ MUTUAL PROBE                       │
│ Two guesses. One possibility.      │
│                                    │
│ TWO INCORRECT GUESSES              │
│ This candidate is closed for       │
│ 24 hours.                          │
│ Try again in about 23 hours.       │
│                                    │
│ [ input disabled ]                 │
│ [ Make anonymous guess disabled ]  │
└────────────────────────────────────┘
```

## 5. Guessing screen — unlocked transition

```text
┌────────────────────────────────────┐
│ ‹  Anonymous candidate             │
├────────────────────────────────────┤
│ MUTUAL PROBE                       │
│ CHAT UNLOCKED                      │
│                                    │
│ Both of you guessed correctly.     │
│ Names are now revealed in chat.    │
│                                    │
│ [ Open revealed chat ]             │
└────────────────────────────────────┘
```

## UX guardrails

1. Never show whether the target has the app before a reciprocal probe exists.
2. Never expose a guessed phone number, guess correctness detail, or candidate linkage in a public surface.
3. Keep the green light informational, not a read receipt or online indicator.
4. Treat expired, blocked, deleted-profile, and unavailable-candidate responses as the same neutral unavailable state.
5. Disable duplicate submissions while a guess request is pending.
6. Normalize presentation separators but require an international `+` number format.
7. Reset the 24-hour lock only after the server confirms the lock has elapsed; do not rely on device time for authorization.
8. On unlock, route directly to the thread and show both names from server-provided identity snapshots.
