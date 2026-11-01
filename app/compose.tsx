import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Body,
  Button,
  C,
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
import { IdentityMode, Intent } from "@/shared/get-even";

export default function Compose() {
  const router = useRouter();
  const { profile, refreshAll } = useApp();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(
    typeof params.phone === "string" ? params.phone : "",
  );
  // Single 💋 intent; there is nothing to choose.
  const intent: Intent = "Kiss";
  const [mode, setMode] = useState<IdentityMode>("anonymous");
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submission = useRef<string | null>(null);
  const normalized = phone.replace(/[\s()\-]/g, "");
  const check = () => {
    setError(null);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError(
        "Enter a number with its country code, for example +61 412 345 678.",
      );
      return;
    }
    if (normalized === profile?.phone) {
      setError("Choose someone else's number, not your own.");
      return;
    }
    submission.current = clientId();
    setPreview(true);
  };
  const send = async () => {
    if (!submission.current) submission.current = clientId();
    setBusy(true);
    setError(null);
    try {
      await request("/probes", "POST", {
        phone: normalized,
        intent,
        mode,
        clientId: submission.current,
      });
      setSent(true);
      await refreshAll();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!profile)
    return (
      <Screen back title="Private probe">
        <Title small>Create your space before sending.</Title>
        <Button
          title="Open my space"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  if (sent)
    return (
      <Screen
        title=""
        footer={
          <Button
            title="Back to my space"
            onPress={() => router.replace("/(tabs)")}
          />
        }
      >
        <View style={{ paddingTop: 60, alignItems: "center", gap: 30 }}>
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: C.accentSoft,
              borderColor: C.accentBorder,
              borderWidth: 1,
            }}
          >
            <Icon name="checkmark" size={42} color={C.accent} />
          </View>
          <Label style={{ color: C.accent }}>YOUR PART IS DONE</Label>
          <Text
            style={{
              color: C.text,
              fontSize: 62,
              fontWeight: "300",
              letterSpacing: -2,
            }}
          >
            Sent.
          </Text>
          <Body style={{ textAlign: "center", maxWidth: 320 }}>
            You took a small step.{"\n"}Everything next is up to them.
          </Body>
        </View>
        <View style={{ paddingTop: 23 }}>
          <Note>
            Sent means accepted for processing, not delivered. You won’t see
            whether they’re here, received it, or opened it.
          </Note>
        </View>
        <Body style={{ fontSize: 13, textAlign: "center", paddingTop: 15 }}>
          No response is a complete answer.
        </Body>
      </Screen>
    );
  return (
    <Screen
      back
      title={preview ? "Only what they could see" : "A private probe"}
      footer={
        <>
          <ErrorNote message={error} />
          <Button
            title={preview ? "Send privately" : "Preview my probe"}
            icon="arrow-forward"
            loading={busy}
            onPress={preview ? send : check}
          />
          {preview && (
            <Button
              title="Edit this probe"
              variant="quiet"
              disabled={busy}
              onPress={() => {
                setPreview(false);
                submission.current = null;
              }}
            />
          )}
        </>
      }
    >
      {preview ? (
        <>
          <Label>RECIPIENT PREVIEW</Label>
          <Title small>One person.{"\n"}One honest intent.</Title>
          <IdentityCard
            anonymous={mode === "anonymous"}
            identity={mode === "named" ? profile : null}
            intent={intent}
          />
          <Body style={{ fontSize: 13, color: C.text }}>
            To: {prettyPhone(normalized)}
          </Body>
          {mode === "named" ? (
            <Note warning>
              They can see your name and selected photos when they open
              this—even if they never reply. Content could be captured or shared
              outside the app.
            </Note>
          ) : (
            <Note>
              No name, photos, or standing profile is included. Your identity
              stays hidden unless you explicitly reveal it in an accepted
              conversation.
            </Note>
          )}
          <Note warning>
            Numbers are self-declared, not verified. This beta cannot guarantee
            that a number identifies the person you intend. Server-managed
            encryption is not E2EE.
          </Note>
        </>
      ) : (
        <>
          <Label>NO SEARCH. NO PUBLIC EXPOSURE.</Label>
          <Title>Who’s on{"\n"}your mind?</Title>
          <Body>
            Someone you already know. Enter their number; we never look up or
            show their name.
          </Body>
          <Field
            label="THEIR PHONE NUMBER"
            placeholder="+61 412 345 678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            helper="No membership check. No invitation or SMS if they’re not here."
            maxLength={24}
          />
          <View style={{ gap: 15 }}>
            <Label>HOW MUCH OF YOU TO SHARE?</Label>
            {(["anonymous", "named"] as const).map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === choice }}
                onPress={() => setMode(choice)}
                style={{
                  flexDirection: "row",
                  gap: 15,
                  alignItems: "center",
                  padding: 19,
                  borderRadius: 15,
                  backgroundColor: mode === choice ? C.accentSoft : C.surface,
                  borderWidth: 1,
                  borderColor: mode === choice ? C.accentBorder : C.border,
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
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ color: C.text, fontSize: 15 }}>
                    {choice === "anonymous"
                      ? "Stay anonymous"
                      : "Let them know it’s you"}
                  </Text>
                  <Body style={{ fontSize: 12, lineHeight: 18 }}>
                    {choice === "anonymous"
                      ? "Just your intent. Reveal only if you choose."
                      : "Your name, details, and private photos."}
                  </Body>
                </View>
                <View
                  style={{
                    width: 19,
                    height: 19,
                    borderRadius: 10,
                    borderColor: mode === choice ? C.accent : C.subtle,
                    borderWidth: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {mode === choice && (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: C.accent,
                      }}
                    />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
          <Note>
            Always Sent. Never delivered, read, or ignored. The next step
            belongs to them.
          </Note>
        </>
      )}
    </Screen>
  );
}
