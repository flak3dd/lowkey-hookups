import { describe, expect, it } from "vitest";
import {
  canonicalContactPhone,
  contactFrom,
  isSendableContact,
  makeSampleContacts,
  mergeContacts,
  parseContactText,
  sanitizeContactName,
  type LocalContact,
} from "../lib/get-even/contacts";
import { MAX_LOCAL_CONTACTS, SAMPLE_PHONES } from "../shared/get-even";

describe("local Get Even contacts", () => {
  it("normalizes only explicitly international E.164 numbers", () => {
    expect(canonicalContactPhone(" +1 (415) 555-0111 ")).toBe("+14155550111");
    expect(canonicalContactPhone("415 555 0111")).toBeNull();
    expect(canonicalContactPhone("+04155550111")).toBeNull();
    expect(canonicalContactPhone("+1415")).toBeNull();
    expect(canonicalContactPhone("+1234567890123456")).toBeNull();
  });

  it("sanitizes bounded local labels and marks all fixture numbers as samples", () => {
    expect(sanitizeContactName(`  Ada\u0000\nLovelace  `)).toBe("Ada Lovelace");
    expect(sanitizeContactName("x".repeat(100))).toHaveLength(80);

    const knownSample = contactFrom("Example", SAMPLE_PHONES[0], "manual");
    expect(knownSample).toMatchObject({ phone: SAMPLE_PHONES[0], sample: true });
    expect(isSendableContact(knownSample!)).toBe(false);
    expect(makeSampleContacts()).toEqual(
      SAMPLE_PHONES.map((phone, index) => ({
        phone,
        name: `Sample contact ${index + 1}`,
        source: "sample",
        sample: true,
      })),
    );
  });

  it("parses multiline notes plus CSV/tab exports with a nearby name for each number", () => {
    const parsed = parseContactText(
      [
        "Ada Lovelace, +1 (415) 555-0111",
        "+44 20 7946 0958\tGrace Hopper",
        "Linus,+14155550113\tMargaret,+14155550114",
      ].join("\n"),
    );

    expect(parsed).toEqual({
      contacts: [
        { name: "Ada Lovelace", phone: "+14155550111", source: "paste", sample: false },
        { name: "Grace Hopper", phone: "+442079460958", source: "paste", sample: false },
        { name: "Linus", phone: "+14155550113", source: "paste", sample: false },
        { name: "Margaret", phone: "+14155550114", source: "paste", sample: false },
      ],
      skipped: 0,
    });
  });

  it("drops duplicates, self, malformed/no-plus/oversized values, and never makes sample input sendable", () => {
    const parsed = parseContactText(
      [
        "Ada,+14155550111",
        "Duplicate,+1 415 555 0111",
        "Me,+14155550112",
        "No country code,4155550113",
        "Too short,+1415",
        "Too long,+1234567890123456",
        `Fixture,${SAMPLE_PHONES[1]}`,
      ].join("\n"),
      "+1 (415) 555-0112",
    );

    expect(parsed.contacts).toEqual([
      { name: "Ada", phone: "+14155550111", source: "paste", sample: false },
      { name: "Fixture", phone: SAMPLE_PHONES[1], source: "paste", sample: true },
    ]);
    expect(parsed.skipped).toBe(5);
    expect(isSendableContact(parsed.contacts[1])).toBe(false);
  });

  it("enforces the 200-contact local bound while counting omitted entries", () => {
    const parsed = parseContactText(
      Array.from(
        { length: MAX_LOCAL_CONTACTS + 2 },
        (_, index) => `Person ${index},+1202555${String(1000 + index).padStart(4, "0")}`,
      ).join("\n"),
    );

    expect(parsed.contacts).toHaveLength(MAX_LOCAL_CONTACTS);
    expect(parsed.skipped).toBe(2);
  });

  it("merges stably, preserves the first local label, and retains any sample marker", () => {
    const existing: LocalContact[] = [
      { name: "First label", phone: "+14155550111", source: "manual", sample: false },
      { name: "Manually marked fixture", phone: "+14155550115", source: "manual", sample: true },
    ];
    const incoming: LocalContact[] = [
      { name: "Replacement label", phone: "+1 (415) 555-0111", source: "paste", sample: false },
      { name: "My number", phone: "+14155550112", source: "device", sample: false },
      { name: "New", phone: "+14155550116", source: "paste", sample: false },
    ];

    const merged = mergeContacts(existing, incoming, "+14155550112");
    expect(merged.contacts).toEqual([
      existing[0],
      existing[1],
      { name: "New", phone: "+14155550116", source: "paste", sample: false },
    ]);
    expect(merged.dropped).toBe(2);
    expect(isSendableContact(merged.contacts[1])).toBe(false);
  });
});
