import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Body,
  Button,
  C,
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
import { errorText, request, useApp, useLive } from "@/lib/get-even/provider";
import { InboxItem } from "@/shared/get-even";

export default function Interest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, refreshAll } = useApp();
  const inbox = useLive<{ items: InboxItem[] }>("inbox", "/inbox", !!profile);
  const item = inbox.data?.items.find((probe) => probe.id === id);
  const [modal, setModal] = useState<"block" | "report" | null>(null);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: "ignore" | "block" | "report" | "accept") => {
    if (action === "report" && reason.trim().length < 3) {
      setError("Add a short reason for the safety team.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await request<{ candidateId?: string }>(
        `/inbox/${id}/${action}`,
        "POST",
        action === "report"
            ? { reason: reason.trim(), includeContent: evidence }
            : {},
      );
      await refreshAll();
      setModal(null);
      if (result.candidateId)
        router.replace(`/candidate/${result.candidateId}` as never);
      else router.replace("/(tabs)/inbox");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (inbox.isPending)
    return (
      <Screen back title="Just for you">
        <ActivityIndicator color={C.accent} />
      </Screen>
    );
  if (!item)
    return (
      <Screen back title="Just for you">
        <Empty
          icon="mail-outline"
          title="No interest to show."
          description="It may have been removed or expired. Your decision stays private."
        />
        <ErrorNote
          message={inbox.error ? "This interest couldn’t load." : null}
        />
        <Button
          title="Back to inbox"
          onPress={() => router.replace("/(tabs)/inbox")}
        />
      </Screen>
    );
  return (
    <Screen back title="Just for you">
      <Label>NO ONE KNOWS YOU OPENED THIS</Label>
      <Title small>A possibility.{"\n"}Not an obligation.</Title>
      <IdentityCard
        identity={item.identity}
        anonymous={item.mode === "anonymous"}
        intent={item.intent}
      />
      <Note>Opening, ignoring, or blocking never sends a status back. Send an anonymous probe back if you want to create a mutual candidate.</Note>
      <Button title="Send an anonymous probe back" icon="eye-off-outline" loading={busy} onPress={() => void act("accept")} />
      <Button title="Ignore privately" variant="secondary" loading={busy} onPress={() => void act("ignore")} />
      <ErrorNote message={error} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 32 }}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setError(null);
            setModal("block");
          }}
          style={{ padding: 10 }}
        >
          <Text style={{ color: C.muted, fontSize: 12 }}>
            Block this person
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setError(null);
            setModal("report");
          }}
          style={{ padding: 10 }}
        >
          <Text style={{ color: C.muted, fontSize: 12 }}>Report</Text>
        </Pressable>
      </View>
      <Confirm
        visible={modal === "block"}
        title="Keep this door closed?"
        description="This interest will be removed and future probes from this account will be blocked. They won’t see a block status. You can unblock in Private."
        confirm="Block privately"
        danger
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          void act("block");
        }}
      >
        <ErrorNote message={error} />
      </Confirm>
      <Confirm
        visible={modal === "report"}
        title="Tell us what happened."
        description="This report is private. Only the evidence you choose to include is added to the safety report. They won’t receive a report status."
        confirm="Submit private report"
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          void act("report");
        }}
      >
        <Field
          label="REASON"
          placeholder="What concerns you?"
          multiline
          value={reason}
          onChangeText={setReason}
          maxLength={240}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: evidence }}
          onPress={() => setEvidence(!evidence)}
          style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
        >
          <Icon
            name={evidence ? "checkbox-outline" : "square-outline"}
            color={C.accent}
          />
          <Body style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>
            Include this interest and its visible identity as evidence.
          </Body>
        </Pressable>
        <ErrorNote message={error} />
      </Confirm>
    </Screen>
  );
}
