import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Body,
  Button,
  C,
  Card,
  Confirm,
  Empty,
  ErrorNote,
  Field,
  Icon,
  IdentityCard,
  Label,
  Note,
  Screen,
  Title,
} from "@/components/get-even/ui";
import {
  clientId,
  errorText,
  prettyPhone,
  request,
  useApp,
} from "@/lib/get-even/provider";
import {
  contactFrom,
  isSendableContact,
  LocalContact,
  makeSampleContacts,
  mergeContacts,
  parseContactText,
} from "@/lib/get-even/contacts";
import {
  contactPickerAvailable,
  importDeviceContacts,
} from "@/lib/get-even/contact-import";
import {
  IdentityMode,
  Intent,
  intentLabel,
  MassProbeInput,
  MassProbeResponse,
  MAX_LOCAL_CONTACTS,
  MAX_MASS_RECIPIENTS,
} from "@/shared/get-even";

type Review = { contacts: LocalContact[]; intent: Intent; mode: IdentityMode };
export default function MassProbe() {
  const { user, profile } = useApp();
  return (
    <MassProbeFlow
      key={`${user?.id ?? "signed-out"}:${profile?.id ?? "no-profile"}`}
    />
  );
}

function MassProbeFlow() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const { profile, loading, refreshAll } = useApp();
  const [contacts, setContacts] = useState<LocalContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Single 💋 intent; there is nothing to choose.
  const intent: Intent = "Kiss";
  const [mode, setMode] = useState<IdentityMode>("anonymous");
  const [search, setSearch] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [paste, setPaste] = useState("");
  const [modal, setModal] = useState<"paste" | "library" | "send" | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [result, setResult] = useState<MassProbeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submission = useRef<{
    fingerprint: string;
    input: MassProbeInput;
  } | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const pickerSupported = contactPickerAvailable();
  const chosen = useMemo(
    () =>
      contacts.filter(
        (item) =>
          selected.has(item.phone) && isSendableContact(item, profile?.phone),
      ),
    [contacts, selected, profile?.phone],
  );
  const visible = useMemo(
    () =>
      contacts.filter((item) =>
        `${item.name} ${item.phone}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [contacts, search],
  );
  const addContacts = (incoming: LocalContact[], skipped = 0) => {
    const merged = mergeContacts(contacts, incoming, profile?.phone);
    setContacts(merged.contacts);
    const dropped = merged.dropped + skipped;
    setNotice(
      `${merged.contacts.length} contacts in this local list.${dropped ? ` ${dropped} duplicate, self, invalid or over-limit entries were skipped.` : ""} Nothing has been submitted.`,
    );
  };
  const addManual = () => {
    setError(null);
    const item = contactFrom(
      manualName || "Chosen contact",
      manualPhone,
      "manual",
    );
    if (!item) {
      setError(
        "Use a complete international number, including + and its country code.",
      );
      return;
    }
    if (!isSendableContact(item, profile?.phone)) {
      setError(
        "Your own number and sample numbers cannot be added as real recipients.",
      );
      return;
    }
    addContacts([item]);
    setManualName("");
    setManualPhone("");
  };
  const addPaste = () => {
    setError(null);
    const parsed = parseContactText(paste, profile?.phone);
    if (!parsed.contacts.length) {
      setError(
        "No eligible international numbers found. Include explicit country codes, for example +61 412 345 678.",
      );
      return;
    }
    addContacts(parsed.contacts, parsed.skipped);
    setPaste("");
    setModal(null);
  };
  const importContacts = async (kind: "picker" | "library") => {
    setBusy(true);
    setError(null);
    try {
      const imported = await importDeviceContacts(kind);
      if (!active.current) return;
      addContacts(imported.contacts, imported.skipped);
      setModal(null);
    } catch (e) {
      if (active.current && !(e instanceof Error && e.name === "AbortError"))
        setError(errorText(e));
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const toggle = (item: LocalContact) => {
    if (!isSendableContact(item, profile?.phone)) return;
    setError(null);
    if (!selected.has(item.phone) && chosen.length >= MAX_MASS_RECIPIENTS) {
      setError(`Choose up to ${MAX_MASS_RECIPIENTS} recipients per batch.`);
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      next.has(item.phone) ? next.delete(item.phone) : next.add(item.phone);
      return next;
    });
  };
  const selectVisible = () => {
    const next = new Set(chosen.map((item) => item.phone));
    for (const item of visible)
      if (
        isSendableContact(item, profile?.phone) &&
        next.size < MAX_MASS_RECIPIENTS
      )
        next.add(item.phone);
    setSelected(next);
    setNotice(
      `Selected up to ${MAX_MASS_RECIPIENTS} eligible visible contacts. Samples and your own number are excluded.`,
    );
    setError(null);
  };
  const prepareReview = () => {
    setError(null);
    if (!chosen.length || chosen.length > MAX_MASS_RECIPIENTS) {
      setError(`Choose between 1 and ${MAX_MASS_RECIPIENTS} real recipients.`);
      return;
    }
    setReview({ contacts: chosen.map((item) => ({ ...item })), intent, mode });
  };
  const send = async () => {
    if (
      !review ||
      !profile ||
      review.contacts.some((item) => !isSendableContact(item, profile.phone))
    ) {
      setError("Review a valid selection of real contacts before sending.");
      return;
    }
    const fingerprint = JSON.stringify({
      phones: review.contacts.map((item) => item.phone).sort(),
      intent: review.intent,
      mode: review.mode,
    });
    if (submission.current?.fingerprint !== fingerprint)
      submission.current = {
        fingerprint,
        input: {
          contacts: review.contacts.map((item) => ({ phone: item.phone })),
          intent: review.intent,
          mode: review.mode,
          clientId: clientId(),
        },
      };
    setBusy(true);
    setError(null);
    try {
      const accepted = await request<MassProbeResponse>(
        "/probes/mass",
        "POST",
        submission.current.input,
      );
      if (!active.current) return;
      setResult(accepted);
      setModal(null);
      setContacts([]);
      setSelected(new Set());
      setPaste("");
      await refreshAll();
    } catch (e) {
      if (active.current) setError(errorText(e));
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (loading)
    return (
      <Screen back title="Chosen contacts">
        <ActivityIndicator color={C.accent} />
      </Screen>
    );
  if (!profile)
    return (
      <Screen back title="Chosen contacts">
        <Empty
          icon="lock-closed-outline"
          title="A private setup first."
          description="Create your space and save your private name-and-number record before choosing recipients."
        />
        <Button
          title="Open my space"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  if (result)
    return (
      <Screen
        title="Your part is done"
        footer={
          <Button
            title="Open my private space"
            onPress={() => router.replace("/(tabs)")}
          />
        }
      >
        <View style={{ gap: 25, alignItems: "center", paddingVertical: 35 }}>
          <View
            style={{
              width: 90,
              height: 90,
              borderRadius: 32,
              backgroundColor: C.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="checkmark" size={38} color={C.accent} />
          </View>
          <Title>Sent.</Title>
          <Body style={{ textAlign: "center" }}>
            {result.submittedCount} private{" "}
            {result.submittedCount === 1 ? "submission" : "submissions"}{" "}
            accepted for processing.
          </Body>
        </View>
        <Note>
          This count describes only what you submitted. It does not indicate
          members, mutual interest, receipt, delivery or opening.
        </Note>
        <Body>
          There’s no match counter to watch. If someone voluntarily replies, the
          conversation appears in your inbox.
        </Body>
      </Screen>
    );
  return (
    <Screen
      back
      title={
        review
          ? "Review every recipient"
          : onboarding === "1"
            ? "An optional next step"
            : "Chosen contacts"
      }
      footer={
        <>
          <ErrorNote message={error} />
          <Button
            title={
              review
                ? `Send ${review.contacts.length} private ${review.contacts.length === 1 ? "probe" : "probes"}`
                : `Review ${chosen.length} ${chosen.length === 1 ? "recipient" : "recipients"}`
            }
            icon={review ? "paper-plane-outline" : "arrow-forward"}
            disabled={!review && !chosen.length}
            loading={busy}
            onPress={
              review
                ? () => {
                    setError(null);
                    setModal("send");
                  }
                : prepareReview
            }
          />
          {review ? (
            <Button
              title="Edit my selection"
              variant="quiet"
              disabled={busy}
              onPress={() => {
                setReview(null);
                setError(null);
              }}
            />
          ) : (
            <Button
              title={onboarding === "1" ? "Skip for now" : "Back to my space"}
              variant="quiet"
              disabled={busy}
              onPress={() => router.replace("/(tabs)")}
            />
          )}
        </>
      }
    >
      {review ? (
        <>
          <Label>YOUR CHOICE, NOT A MEMBERSHIP CHECK</Label>
          <Title small>One intent.{"\n"}Chosen people.</Title>
          <IdentityCard
            anonymous={review.mode === "anonymous"}
            identity={review.mode === "named" ? profile : null}
            intent={review.intent}
          />
          <View style={{ gap: 14 }}>
            <Label>EVERY SELECTED RECIPIENT · {review.contacts.length}</Label>
            {review.contacts.map((item) => (
              <View
                key={item.phone}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: C.border,
                  gap: 5,
                }}
              >
                <Text style={{ color: C.text, fontSize: 15 }}>{item.name}</Text>
                <Body style={{ fontSize: 13 }}>{prettyPhone(item.phone)}</Body>
              </View>
            ))}
          </View>
          {review.mode === "named" && (
            <Note warning>
              Your name, details and selected photos can be viewed
              without a reply. A recipient can capture or share them outside the
              app.
            </Note>
          )}
          <Note warning>
            Numbers are self-declared, not verified. This beta cannot guarantee
            real-world recipient identity. Server-managed encryption is not
            end-to-end encryption.
          </Note>
          <Note>
            No membership or mutual-match count is returned. A voluntary reply
            is the only sender-visible participation signal.
          </Note>
          <Body style={{ fontSize: 12 }}>
            Contact names are local labels. Only these reviewed numbers are
            submitted. The existing 20-per-24-hour limit includes individual and
            batch probes.
          </Body>
        </>
      ) : (
        <>
          <Label>
            {onboarding === "1"
              ? "SETUP SAVED · THIS STEP IS OPTIONAL"
              : "NO DIRECTORY. NO PEOPLE SEARCH."}
          </Label>
          <Title small>A few people.{"\n"}Still private.</Title>
          <Body>
            Choose contacts you already know. Nothing imports or sends until you
            explicitly choose it.
          </Body>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["anonymous", "named"] as const).map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === choice }}
                onPress={() => setMode(choice)}
                style={{
                  flex: 1,
                  padding: 17,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: mode === choice ? C.accentBorder : C.border,
                  backgroundColor: mode === choice ? C.accentSoft : C.surface,
                  gap: 9,
                }}
              >
                <Icon
                  name={
                    choice === "anonymous"
                      ? "eye-off-outline"
                      : "person-outline"
                  }
                  color={mode === choice ? C.accent : C.muted}
                />
                <Text style={{ color: C.text, fontSize: 13 }}>
                  {choice === "anonymous" ? "Anonymous" : "Named"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Card>
            <Label>CONTACTS STAY HERE UNTIL YOU REVIEW</Label>
            <Button
              title={
                Platform.OS === "web"
                  ? "Choose browser contacts"
                  : "Pick a device contact"
              }
              variant="secondary"
              icon="people-outline"
              disabled={!pickerSupported}
              loading={busy}
              onPress={() => {
                void importContacts("picker");
              }}
            />
            {Platform.OS !== "web" && (
              <Button
                title={`Import up to ${MAX_LOCAL_CONTACTS} device contacts`}
                variant="quiet"
                disabled={busy}
                onPress={() => {
                  setError(null);
                  setModal("library");
                }}
              />
            )}
            <Button
              title="Paste names and numbers"
              variant="secondary"
              icon="clipboard-outline"
              disabled={busy}
              onPress={() => {
                setError(null);
                setModal("paste");
              }}
            />
            <Body style={{ fontSize: 12, lineHeight: 18 }}>
              {Platform.OS === "web" && !pickerSupported
                ? "Contact picking is unavailable in this browser or embedded Preview. Paste or add numbers below instead."
                : "Imported names and numbers stay in memory on this screen. Only reviewed numbers are submitted on confirmation."}
            </Body>
          </Card>
          <Card>
            <Label>ADD ONE YOU KNOW</Label>
            <Field
              label="LOCAL CONTACT LABEL"
              placeholder="Name (optional)"
              value={manualName}
              onChangeText={setManualName}
              maxLength={80}
            />
            <Field
              label="INTERNATIONAL PHONE NUMBER"
              placeholder="+61 412 345 678"
              keyboardType="phone-pad"
              value={manualPhone}
              onChangeText={setManualPhone}
              maxLength={24}
            />
            <Button
              title="Add to local list"
              variant="secondary"
              icon="add"
              onPress={addManual}
              disabled={busy}
            />
          </Card>
          <View style={{ gap: 15 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Label>
                YOUR LOCAL LIST · {contacts.length}/{MAX_LOCAL_CONTACTS}
              </Label>
              <Text style={{ color: C.accent, fontSize: 12 }}>
                {chosen.length}/{MAX_MASS_RECIPIENTS} selected
              </Text>
            </View>
            <Field
              label="FILTER LOCAL CONTACTS"
              placeholder="Search by your label or number"
              value={search}
              onChangeText={setSearch}
              maxLength={100}
            />
            <View
              style={{ flexDirection: "row", gap: 18, alignItems: "center" }}
            >
              <Pressable accessibilityRole="button" onPress={selectVisible}>
                <Text style={{ color: C.accent, fontSize: 12 }}>
                  Select all (up to 20)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelected(new Set());
                  setError(null);
                }}
              >
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  Deselect all
                </Text>
              </Pressable>
            </View>
            {visible.length ? (
              visible.map((item) => {
                const sendable = isSendableContact(item, profile.phone);
                const checked = selected.has(item.phone) && sendable;
                return (
                  <View
                    key={item.phone}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderBottomWidth: 1,
                      borderColor: C.border,
                      paddingVertical: 13,
                    }}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Select ${item.name} ${item.phone}`}
                      accessibilityState={{ checked, disabled: !sendable }}
                      disabled={!sendable || busy}
                      onPress={() => toggle(item)}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        gap: 14,
                        alignItems: "center",
                      }}
                    >
                      <Icon
                        name={checked ? "checkbox" : "square-outline"}
                        color={checked ? C.accent : C.subtle}
                        size={23}
                      />
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text
                          style={{
                            color: sendable ? C.text : C.subtle,
                            fontSize: 15,
                          }}
                        >
                          {item.name}
                        </Text>
                        <Text style={{ color: C.muted, fontSize: 12 }}>
                          {prettyPhone(item.phone)}
                        </Text>
                        {item.sample && <Label>SAMPLE · NEVER SENT</Label>}
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name}`}
                      disabled={busy}
                      onPress={() => {
                        setContacts(
                          contacts.filter((row) => row.phone !== item.phone),
                        );
                        setSelected((current) => {
                          const next = new Set(current);
                          next.delete(item.phone);
                          return next;
                        });
                      }}
                      style={{ padding: 9 }}
                    >
                      <Icon name="close" size={18} />
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <Empty
                icon="people-outline"
                title={
                  contacts.length
                    ? "No local matches."
                    : "Only the people you choose."
                }
                description={
                  contacts.length
                    ? "Try a different local label or number."
                    : "Import, paste or add contacts. There is no automatic search for accounts."
                }
              />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                addContacts(makeSampleContacts());
                setError(null);
              }}
              style={{ paddingVertical: 10 }}
            >
              <Text
                style={{
                  color: C.subtle,
                  fontSize: 12,
                  textDecorationLine: "underline",
                }}
              >
                Load clearly marked sample contacts
              </Text>
            </Pressable>
            {contacts.some((item) => item.sample) && (
              <Button
                title="Remove sample contacts"
                variant="quiet"
                onPress={() =>
                  setContacts(contacts.filter((item) => !item.sample))
                }
              />
            )}
            {notice && (
              <Body style={{ fontSize: 12, lineHeight: 19 }}>{notice}</Body>
            )}
          </View>
          <Note>
            No match counts before a voluntary reply. A batch always says Sent,
            never who is here or who opened it.
          </Note>
        </>
      )}
      <Confirm
        visible={modal === "paste"}
        title="Paste a private list."
        description="Use one person per line or a CSV/tab export. Explicit international numbers only; we never guess a country code. Names stay on this screen."
        confirm="Add parsed contacts"
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setModal(null);
            setError(null);
          }
        }}
        onConfirm={addPaste}
      >
        <Field
          label="NAMES AND INTERNATIONAL NUMBERS"
          placeholder={"Alex, +61 412 345 678\nSam, +1 415 555 2671"}
          value={paste}
          onChangeText={setPaste}
          multiline
          maxLength={20000}
          style={{ minHeight: 170 }}
        />
        <ErrorNote message={error} />
      </Confirm>
      <Confirm
        visible={modal === "library"}
        title="Bring contacts into this screen?"
        description="The device permission prompt will let you control contact access. We’ll read up to 200 accessible contacts into memory only. None will be selected or uploaded automatically."
        confirm="Continue to device permission"
        busy={busy}
        onCancel={() => {
          if (!busy) setModal(null);
        }}
        onConfirm={() => {
          void importContacts("library");
        }}
      >
        <ErrorNote message={error} />
      </Confirm>
      <Confirm
        visible={modal === "send"}
        title={`Send to ${review?.contacts.length || 0} chosen ${review?.contacts.length === 1 ? "person" : "people"}?`}
        description={`${intentLabel(review?.intent || intent)} · ${review?.mode === "named" ? "Named: your identity and photos can be seen without a reply." : "Anonymous: no name or photos are included."} No target SMS, membership check or mutual-match count. Sent means submitted, not delivered.`}
        confirm={`Send ${review?.contacts.length || 0} private probes`}
        busy={busy}
        onCancel={() => {
          if (!busy) setModal(null);
        }}
        onConfirm={() => {
          void send();
        }}
      >
        <Body style={{ fontSize: 12 }}>
          Only the exact recipients on your review screen are included. Names
          are local labels; number ownership is unverified. This is not E2EE.
        </Body>
        <ErrorNote message={error} />
      </Confirm>
    </Screen>
  );
}
