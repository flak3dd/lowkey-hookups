# LOWKEY Candidate Inbox + Guessing Screen Wireframes

**Updated for commit `2c58e17`**

## Product rule
A candidate exists only after two people send anonymous probes to each other. Each participant gets two guesses. Two incorrect guesses pause the candidate for 24 hours. A green light means the other participant guessed correctly and is waiting. Chat unlocks only after both guesses are correct; both names are revealed automatically in chat.

## 1. Candidates tab — enhanced card hierarchy

```text
┌────────────────────────────────────┐
│ LOWKEY                             │
│ YOU HOLD THE NEXT STEP             │
│ On your terms.                     │
├────────────────────────────────────┤
│ Interests │ Candidates │ Chats     │
├────────────────────────────────────┤
│ ◉  ANONYMOUS CANDIDATE          ›  │
│    Two probes. Two guesses.        │
│    ▰━━━━━━━━  2 OF 2 REMAINING    │
│    2 guesses remaining.            │
│    OPEN                 View ›     │
├────────────────────────────────────┤
│ ◉  ANONYMOUS CANDIDATE          ›  │
│    Two probes. Two guesses.        │
│    ▰━━━━━━━  1 OF 2 REMAINING     │
│    Green light: they recognized you│
│    GREEN LIGHT          View ›     │
├────────────────────────────────────┤
│ No read receipts. No online status.│
└────────────────────────────────────┘
```

### Card rules

- Full card is tappable; the chevron is a secondary affordance, not the only target.
- Every card shows an anonymous eye icon until unlocked.
- Progress bars are filled by `guessesRemaining`; empty slots use the neutral border color.
- State labels are uppercase and short: `OPEN`, `GREEN LIGHT`, `PAUSED 24H`, `UNLOCKED`.
- Locked candidates remain visible so the user understands why a candidate disappeared from action.
- Unlocked candidates route to the named chat.

## 2. Guessing screen — open

```text
┌────────────────────────────────────┐
│ ‹  Anonymous candidate             │
├────────────────────────────────────┤
│ ◉  MUTUAL PROBE                    │
│    Two guesses. One possibility.   │
├────────────────────────────────────┤
│ YOUR PRIVATE CHANCE        OPEN    │
│ Both sent an anonymous probe.      │
│ Guess the verified number without  │
│ exposing who you are.              │
│ ▰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ 2 OF 2 GUESSES REMAINING           │
├────────────────────────────────────┤
│ WHO DO YOU THINK IT IS?            │
│ ┌────────────────────────────────┐ │
│ │ +61 412 345 678                │ │
│ └────────────────────────────────┘ │
│ Use the number you believe belongs │
│ to the person.                    │
│ [  Make anonymous guess  → ]       │
├────────────────────────────────────┤
│ Chat unlocks only after both       │
│ people guess correctly.            │
└────────────────────────────────────┘
```

## 3. Guessing screen — green light

```text
┌────────────────────────────────────┐
│ YOUR PRIVATE CHANCE       OPEN     │
│ ▰━━━━━━━━━━━━━━━ 1 OF 2 REMAINING │
├────────────────────────────────────┤
│ ◉  GREEN LIGHT                     │
│ They recognized you and are        │
│ waiting for your correct guess.    │
├────────────────────────────────────┤
│ WHO DO YOU THINK IT IS?            │
│ [ phone input ]                    │
│ [ Make anonymous guess  → ]        │
└────────────────────────────────────┘
```

## 4. Guessing screen — paused

```text
┌────────────────────────────────────┐
│ YOUR PRIVATE CHANCE       PAUSED   │
│ ▰━━━━━━━━━━━━━━━━ 0 OF 2 REMAINING│
├────────────────────────────────────┤
│ 🔒 TWO INCORRECT GUESSES           │
│ This candidate is paused for       │
│ 24 hours.                          │
│ Try again in about 23h 42m.        │
│                                    │
│ [       Guessing paused       ]    │
└────────────────────────────────────┘
```

## 5. Guessing screen — unlocked

```text
┌────────────────────────────────────┐
│ YOUR PRIVATE CHANCE       UNLOCKED │
├────────────────────────────────────┤
│ CHAT UNLOCKED                      │
│ Both of you guessed correctly.     │
│ Names are now revealed in the      │
│ private conversation.              │
│                                    │
│ [ Open revealed chat  → ]          │
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
