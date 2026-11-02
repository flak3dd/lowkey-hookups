import { BRAND } from "./branding";

export const APP_JOURNEY = [
  {
    number: "01",
    title: "Private setup",
    text: "Add a private name and verified number with optional details on what you’re here for. No public profile is created.",
  },
  {
    number: "02",
    title: "Discreet probe",
    text: "Pick a contact or enter a number. Send one anonymous 💋 probe. No written content or identity is attached.",
  },
  {
    number: "03",
    title: "Mutual unlock",
    text: "A chat opens only after both people probe each other and both correctly guess within two attempts. Two incorrect guesses lock the candidate for 24 hours. Once unlocked, both names appear in the chat.",
  },
] as const;

export const JOURNEY_VISIBILITY_NOTE =
  "Every probe is anonymous and contains no written content. A mutual probe creates a private guessing game; the green light means the other person has guessed correctly and is waiting.";

export const DISCRETION_PILLARS = [
  {
    icon: "checkmark-outline",
    title: "No rejection receipts",
    text: "Every valid probe says Sent. There are no delivery, read, guess, ignore, or block receipts. Only a mutual probe creates a candidate.",
  },
  {
    icon: "notifications-off-outline",
    title: "No target spam",
    text: `${BRAND.name} never sends a probe by SMS or texts an invitation to your contacts. A contact without an account receives nothing, and a later signup does not receive an old undeliverable probe.`,
  },
  {
    icon: "people-outline",
    title: "Mass contact probes",
    text: "Review a batch of selected contacts and send with one intent and identity choice. Any batch count describes how many probes you submitted—not how many contacts like you back. There are no pre-reply mutual-match or membership signals.",
  },
  {
    icon: "eye-off-outline",
    title: "No public directory",
    text: "There is no public profile link, directory, feed, or searchable list of members. Strangers cannot browse accounts. Entering a number never reveals a registered name or membership.",
  },
  {
    icon: "person-outline",
    title: "Anonymous by default",
    text: "Every probe starts anonymous. A candidate requires two correct guesses from both people; the unlocked chat then reveals both names automatically.",
  },
  {
    icon: "hand-left-outline",
    title: "Silence is an answer",
    text: "Responding is optional. Opening, ignoring, blocking, reporting, or expiry sends no status back. A reciprocal probe is the only way a candidate is created. No explanation or follow-up is owed; the app cannot guarantee how people behave outside it.",
  },
] as const;
