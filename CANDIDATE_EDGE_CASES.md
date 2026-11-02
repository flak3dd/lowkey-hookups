# Candidate Workflow Edge-Case Test Matrix

| Case | Input/state | Expected outcome |
|---|---|---|
| Invalid phone | Missing `+`, too short, too long, letters | Reject with `400`; no guess count changes |
| Formatting separators | `+61 412 345 678`, `+61412345678` | Normalize consistently before HMAC comparison |
| Self-guess | Guesser submits their own verified number | Incorrect unless the other profile matches; no identity leakage |
| First wrong guess | `guessesRemaining=2`, incorrect number | Count becomes 1; candidate remains open |
| Second wrong guess | `guessesRemaining=1`, incorrect number | Count becomes 0; set a 24-hour lock |
| Guess while locked | Any phone before `lockedUntil` | Return current locked candidate; no count changes |
| Lock elapsed | `lockedUntil <= now` | Reset the candidate attempt window server-side, then accept a new guess |
| Correct but other side pending | Guess correct; other participant not correct | Mark current side correct; return green-light state only to the other side as appropriate |
| Both correct | Both flags true | Create exactly one thread; populate both identity snapshots; mark both probes accepted |
| Duplicate unlock race | Two correct requests arrive together | Transaction/unique candidate state yields one thread, not two |
| Duplicate tap | Same user submits twice while request is in flight | UI disables the action; server does not increment after already-correct state |
| Blocked participant | Either-direction block exists | Candidate is unavailable; do not reveal candidate linkage |
| Expired probe | Either probe expired before reciprocal match | No candidate is created; neutral unavailable response |
| Deleted/recreated profile | Old incarnation no longer matches | Old candidate is unavailable; no stale identity shown |
| Unauthorized candidate ID | Candidate belongs to another user | `404`-style neutral response; no existence oracle |
| No reciprocal probe | One anonymous probe only | Inbox shows no candidate; no match/count signal |
| Mass probe | Batch is submitted | Each accepted recipient is anonymous; candidate appears only after reciprocal probe |
| Server/device clock drift | Device clock differs from server | Lock authorization is server-side; client only formats remaining time |
| Network retry after success | Response lost after a correct guess | Refetch returns the durable candidate state; no duplicate thread |
