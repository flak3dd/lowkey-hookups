import {
  INTENTS,
  MAX_MASS_RECIPIENTS,
  SAMPLE_PHONES,
  type IdentityMode,
  type Intent,
} from "../../shared/get-even";

const E164 = /^\+[1-9]\d{7,14}$/;
const JPEG_DATA_URI = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

export type ProfileInput = {
  name: string;
  phone: string;
  intent: Intent;
  photos: string[];
  ageConfirmed: true;
  verificationToken?: string;
  hereTo?: string;
};

export type ProbeInput = {
  phone: string;
  intent: Intent;
  mode: IdentityMode;
  clientId: string;
};

/** Contact labels are normalized for the request only and are never persisted. */
export type MassProbeInput = {
  contacts: Array<{ phone: string; name?: string }>;
  intent: Intent;
  mode: IdentityMode;
  clientId: string;
};

function asTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}

export function isIntent(value: unknown): value is Intent {
  return (
    typeof value === "string" && (INTENTS as readonly string[]).includes(value)
  );
}

export function canonicalPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Only presentation separators are normalized; national-format inputs are rejected.
  const result = value.trim().replace(/[\s().-]/g, "");
  return E164.test(result) ? result : null;
}

export function validateProfileInput(value: unknown): ProfileInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = asTrimmedString(record.name, 80);
  const phone = canonicalPhone(record.phone);
  if (
    !name ||
    !phone ||
    !isIntent(record.intent) ||
    record.ageConfirmed !== true
  )
    return null;
  if (!Array.isArray(record.photos) || record.photos.length > 4) return null;
  const photos: string[] = [];
  for (const photo of record.photos) {
    if (
      typeof photo !== "string" ||
      photo.length > 1_500_000 ||
      !JPEG_DATA_URI.test(photo)
    )
      return null;
    photos.push(photo);
  }
  const verificationToken =
    typeof record.verificationToken === "string"
      ? asTrimmedString(record.verificationToken, 128) ?? undefined
      : undefined;
  const hereTo =
    typeof record.hereTo === "string"
      ? asTrimmedString(record.hereTo, 140) ?? undefined
      : undefined;
  return {
    name,
    phone,
    intent: record.intent,
    photos,
    ageConfirmed: true,
    verificationToken,
    hereTo,
  };
}

export function validatePhoneInput(value: unknown): { phone: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const phone = canonicalPhone(record.phone);
  return phone ? { phone } : null;
}

export function validateVerifyCodeInput(
  value: unknown,
): { phone: string; code: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const phone = canonicalPhone(record.phone);
  if (!phone || typeof record.code !== "string") return null;
  const code = record.code.trim().replace(/\D/g, "");
  if (code.length !== 6) return null;
  return { phone, code };
}

export function validateProbeInput(value: unknown): ProbeInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const phone = canonicalPhone(record.phone);
  const clientId = asTrimmedString(record.clientId, 96);
  if (!phone || !clientId || !isIntent(record.intent)) return null;
  if (record.mode !== "anonymous" && record.mode !== "named") return null;
  return { phone, intent: record.intent, mode: record.mode, clientId };
}

/**
 * Accept only bounded, phone-only international recipient entries. Contact labels,
 * sample markers and unexpected fields are rejected, not retained in validated input.
 */
export function validateMassProbeInput(value: unknown): MassProbeInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !["contacts", "intent", "mode", "clientId"].includes(key),
    )
  )
    return null;
  const clientId = asTrimmedString(record.clientId, 96);
  if (
    !Array.isArray(record.contacts) ||
    record.contacts.length === 0 ||
    record.contacts.length > MAX_MASS_RECIPIENTS ||
    !clientId ||
    !isIntent(record.intent) ||
    (record.mode !== "anonymous" && record.mode !== "named")
  ) {
    return null;
  }

  const contacts: MassProbeInput["contacts"] = [];
  const phones = new Set<string>();
  for (const item of record.contacts) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const contact = item as Record<string, unknown>;
    if (
      Object.keys(contact).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(contact, "phone")
    )
      return null;
    const phone = canonicalPhone(contact.phone);
    if (
      !phone ||
      SAMPLE_PHONES.includes(phone as (typeof SAMPLE_PHONES)[number])
    )
      return null;
    if (phones.has(phone)) continue;
    phones.add(phone);
    contacts.push({ phone });
  }
  if (!contacts.length) return null;
  return { contacts, intent: record.intent, mode: record.mode, clientId };
}

export function validateMessage(
  value: unknown,
): { text: string; clientId: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const text = asTrimmedString(record.text, 2_000);
  const clientId = asTrimmedString(record.clientId, 96);
  return text && clientId ? { text, clientId } : null;
}

export function validateReason(
  value: unknown,
): { reason: string; includeContent: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const reason = asTrimmedString(record.reason, 240);
  return reason && typeof record.includeContent === "boolean"
    ? { reason, includeContent: record.includeContent }
    : null;
}

export function isConfirmed(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).confirm === true
  );
}
