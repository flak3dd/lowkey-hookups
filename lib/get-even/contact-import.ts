import { Platform } from "react-native";
import { MAX_LOCAL_CONTACTS } from "../../shared/get-even";
import { contactFrom, LocalContact } from "./contacts";

type BrowserContact = { name?: string[]; tel?: string[] };
type BrowserPicker = {
  select: (
    fields: string[],
    options: { multiple: boolean },
  ) => Promise<BrowserContact[]>;
};
export type ContactImportResult = { contacts: LocalContact[]; skipped: number };

function browserPicker(): BrowserPicker | null {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return null;
  if (!window.isSecureContext || window.top !== window.self) return null;
  const picker = (navigator as Navigator & { contacts?: BrowserPicker })
    .contacts;
  return typeof picker?.select === "function" ? picker : null;
}
export function contactPickerAvailable(): boolean {
  return Platform.OS !== "web" || browserPicker() !== null;
}
function fromDetails(
  details: { fullName?: string | null; phones?: { number?: string }[] }[],
): ContactImportResult {
  const contacts: LocalContact[] = [];
  let skipped = 0;
  for (const detail of details) {
    for (const phone of detail.phones || []) {
      const item = contactFrom(
        detail.fullName || "Saved contact",
        phone.number || "",
        "device",
      );
      if (item && contacts.length < MAX_LOCAL_CONTACTS) contacts.push(item);
      else skipped++;
    }
  }
  return { contacts, skipped };
}

/** Call only from an explicit user gesture. No backend requests or persistent storage. */
export async function importDeviceContacts(
  kind: "picker" | "library" = "picker",
): Promise<ContactImportResult> {
  if (Platform.OS === "web") {
    const picker = browserPicker();
    if (!picker)
      throw new Error(
        "This browser or embedded Preview cannot open a contact picker. Use paste or add a number manually.",
      );
    // Invoke select before any asynchronous work so the browser gesture is retained.
    const selected = await picker.select(["name", "tel"], { multiple: true });
    return fromDetails(
      selected.map((item) => ({
        fullName: item.name?.[0],
        phones: (item.tel || []).map((number) => ({ number })),
      })),
    );
  }
  const Contacts = await import("expo-contacts");
  const fields = [
    Contacts.ContactField.FULL_NAME,
    Contacts.ContactField.PHONES,
  ] as const;
  if (kind === "picker") {
    const chosen = await Contacts.Contact.presentPicker();
    return chosen
      ? fromDetails([await chosen.getDetails(fields)])
      : { contacts: [], skipped: 0 };
  }
  let permission = await Contacts.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Contact permission was not granted. You can still pick a contact, paste numbers, or add them manually.",
    );
  const details = await Contacts.Contact.getAllDetails(fields, {
    limit: MAX_LOCAL_CONTACTS,
  });
  return fromDetails(details);
}
