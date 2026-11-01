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
    text: "Pick contacts or enter a number. Send a 💋, the one simple signal. Start Anonymous, or choose Named and review the identity you will share.",
  },
  {
    number: "03",
    title: "Mutual unlock",
    text: "Your interest starts the invitation. When the recipient accepts and voluntarily replies, private chat opens. A reciprocal probe alone does not unlock chat in this build. If they stay silent, you receive no delivery, read, ignore, or block status.",
  },
] as const;

export const JOURNEY_VISIBILITY_NOTE =
  "A probe is not public, but its recipient may see your intent before replying. A Named probe may also show your previewed name and photos. Silence hides response status; it does not make the probe invisible to its recipient.";

export const DISCRETION_PILLARS = [
  {
    icon: "checkmark-outline",
    title: "No rejection receipts",
    text: "Every valid accepted probe always says Sent. There are no delivery or read receipts, and no ignore or block status. Only if a person replies will you even know if they have the app. If a reply is received... Well.. intentions are clear...",
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
    text: "Anonymous probes share intent without a name or photos. You can deliberately choose Named instead. In accepted chat, each person separately confirms before revealing their own identity. A reply does not automatically reveal either person, and nobody can force a reveal.",
  },
  {
    icon: "hand-left-outline",
    title: "Silence is an answer",
    text: "Responding is optional. Opening, ignoring, blocking, reporting, or expiry sends no status back. Only a voluntary reply signals participation. No explanation or follow-up is owed; the app cannot guarantee how people behave outside it.",
  },
] as const;
