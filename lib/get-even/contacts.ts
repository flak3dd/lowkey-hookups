import {
  MAX_LOCAL_CONTACTS,
  SAMPLE_PHONES,
} from "../../shared/get-even";

export type ContactSource = "manual" | "paste" | "device" | "sample";

export type LocalContact = {
  phone: string;
  name: string;
  source: ContactSource;
  sample: boolean;
};

const E164 = /^\+[1-9]\d{7,14}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;
const PRESENTATION_SEPARATORS = /[\s().-]/g;
// End on a digit so a following CSV/tab label stays outside the phone candidate.
const PHONE_CANDIDATE = /\+(?:[\d().-]*\d)(?:[\d\s().-]*\d)?/g;
const SAMPLE_PHONE_SET = new Set<string>(SAMPLE_PHONES);
const GENERIC_LABEL = /^(?:phone|mobile|number|telephone|contact)$/i;

/**
 * Removes only common presentation separators and accepts an explicitly supplied
 * international E.164 number. National-format numbers are never guessed.
 */
export function canonicalContactPhone(value: string): string | null {
  const normalized = value.trim().replace(PRESENTATION_SEPARATORS, "");
  return E164.test(normalized) ? normalized : null;
}

/** Keep local labels readable and bounded without retaining control characters. */
export function sanitizeContactName(value: string): string {
  return Array.from(value.replace(CONTROL_CHARACTERS, " ").trim().replace(/\s+/g, " "))
    .slice(0, 80)
    .join("");
}

function isContactSource(value: unknown): value is ContactSource {
  return value === "manual" || value === "paste" || value === "device" || value === "sample";
}

function localContactFrom(
  name: string,
  phone: string,
  source: ContactSource,
  forceSample = false,
): LocalContact | null {
  const canonicalPhone = canonicalContactPhone(phone);
  if (!canonicalPhone) return null;

  const label = sanitizeContactName(name);
  return {
    phone: canonicalPhone,
    name: label || canonicalPhone,
    source,
    // Known sample numbers remain samples even if they were typed or pasted.
    sample: forceSample || source === "sample" || SAMPLE_PHONE_SET.has(canonicalPhone),
  };
}

/** Construct a local-only contact from a name/number pair. */
export function contactFrom(
  name: string,
  phone: string,
  source: ContactSource,
): LocalContact | null {
  return localContactFrom(name, phone, source);
}

/**
 * Returns whether a contact may be selected for a live send. This repeats the
 * validation so stale or hand-crafted local state cannot bypass sample/self rules.
 */
export function isSendableContact(contact: LocalContact, ownPhone?: string): boolean {
  if (!contact || typeof contact !== "object") return false;
  const canonicalPhone = canonicalContactPhone(contact.phone);
  if (!canonicalPhone || canonicalPhone !== contact.phone) return false;
  if (contact.sample || contact.source === "sample" || SAMPLE_PHONE_SET.has(canonicalPhone)) {
    return false;
  }

  const canonicalOwnPhone = ownPhone ? canonicalContactPhone(ownPhone) : null;
  return canonicalPhone !== canonicalOwnPhone;
}

function labelFragment(value: string): string {
  const withoutDelimiters = value
    .replace(/^[\s,;|:\-]+|[\s,;|:\-]+$/g, "")
    .replace(/^['"]+|['"]+$/g, "");
  const firstField = withoutDelimiters.split(/[\t,;|]/, 1)[0] ?? "";
  const label = sanitizeContactName(firstField.replace(/^(?:and|or)\s+/i, ""));
  return GENERIC_LABEL.test(label) ? "" : label;
}

function nameForPhone(
  line: string,
  candidateStart: number,
  candidateEnd: number,
  previousCandidateEnd: number,
  nextCandidateStart: number,
): string {
  const left = labelFragment(line.slice(previousCandidateEnd, candidateStart));
  if (left) return left;

  const right = labelFragment(line.slice(candidateEnd, nextCandidateStart));
  return right;
}

/**
 * Parses pasted notes and simple CSV/tab exports. Every retained number must be
 * explicitly international; text without a usable +E.164 number is skipped.
 */
export function parseContactText(
  input: string,
  ownPhone?: string,
): { contacts: LocalContact[]; skipped: number } {
  const contacts: LocalContact[] = [];
  const seen = new Set<string>();
  const canonicalOwnPhone = ownPhone ? canonicalContactPhone(ownPhone) : null;
  let skipped = 0;

  for (const line of input.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) continue;

    const matches = Array.from(line.matchAll(PHONE_CANDIDATE));
    if (matches.length === 0) {
      skipped += 1;
      continue;
    }

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const rawCandidate = match[0];
      const candidateStart = match.index ?? 0;
      const candidateEnd = candidateStart + rawCandidate.length;
      const previousCandidateEnd = index === 0
        ? 0
        : (matches[index - 1].index ?? 0) + matches[index - 1][0].length;
      const nextCandidateStart = index === matches.length - 1
        ? line.length
        : matches[index + 1].index ?? line.length;
      const precedingCharacter = line[candidateStart - 1];
      const followingCharacter = line[candidateEnd];

      // Do not salvage half of malformed ++number or numberword input.
      if (precedingCharacter === "+" || followingCharacter === "+" || /[A-Za-z]/.test(followingCharacter ?? "")) {
        skipped += 1;
        continue;
      }

      const contact = localContactFrom(
        nameForPhone(
          line,
          candidateStart,
          candidateEnd,
          previousCandidateEnd,
          nextCandidateStart,
        ),
        rawCandidate,
        "paste",
      );
      if (!contact || contact.phone === canonicalOwnPhone || seen.has(contact.phone)) {
        skipped += 1;
        continue;
      }
      if (contacts.length >= MAX_LOCAL_CONTACTS) {
        skipped += 1;
        continue;
      }

      seen.add(contact.phone);
      contacts.push(contact);
    }
  }

  return { contacts, skipped };
}

function normalizeLocalContact(contact: LocalContact): LocalContact | null {
  if (!contact || typeof contact !== "object" || !isContactSource(contact.source)) return null;
  return localContactFrom(
    typeof contact.name === "string" ? contact.name : "",
    typeof contact.phone === "string" ? contact.phone : "",
    contact.source,
    contact.sample === true,
  );
}

/**
 * Merges working local lists in their existing order. The first valid label for a
 * number wins, and a contact already marked as a sample can never become sendable.
 */
export function mergeContacts(
  existing: LocalContact[],
  incoming: LocalContact[],
  ownPhone?: string,
): { contacts: LocalContact[]; dropped: number } {
  const contacts: LocalContact[] = [];
  const seen = new Set<string>();
  const canonicalOwnPhone = ownPhone ? canonicalContactPhone(ownPhone) : null;
  let dropped = 0;

  for (const candidate of [...existing, ...incoming]) {
    const contact = normalizeLocalContact(candidate);
    if (
      !contact ||
      contact.phone === canonicalOwnPhone ||
      seen.has(contact.phone) ||
      contacts.length >= MAX_LOCAL_CONTACTS
    ) {
      dropped += 1;
      continue;
    }

    seen.add(contact.phone);
    contacts.push(contact);
  }

  return { contacts, dropped };
}

/** Clearly labelled fixture contacts for UI demonstrations; they are never sendable. */
export function makeSampleContacts(): LocalContact[] {
  return SAMPLE_PHONES.map((phone, index) => ({
    phone,
    name: `Sample contact ${index + 1}`,
    source: "sample",
    sample: true,
  }));
}
