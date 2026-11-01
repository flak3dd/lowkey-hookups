import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
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
import {
  clientId,
  errorText,
  request,
  useApp,
  useLive,
} from "@/lib/get-even/provider";
import { intentLabel, ThreadResponse } from "@/shared/get-even";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, refreshAll } = useApp();
  const conversation = useLive<ThreadResponse>(
    `thread-${id}`,
    `/threads/${id}`,
    !!profile,
  );
  const [text, setText] = useState("");
  const [modal, setModal] = useState<
    "reveal" | "identity" | "block" | "report" | null
  >(null);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const data = conversation.data;
  const act = async (action: "messages" | "reveal" | "block" | "report") => {
    if (action === "messages" && !text.trim()) return;
    if (action === "report" && reason.trim().length < 3) {
      setError("Add a short reason before reporting.");
      return;
    }
    setBusy(true);
    setError(null);
    if (action === "messages" && !pending.current) pending.current = clientId();
    try {
      await request(
        `/threads/${id}/${action}`,
        "POST",
        action === "messages"
          ? { text: text.trim(), clientId: pending.current }
          : action === "reveal"
            ? { confirm: true }
            : action === "report"
              ? { reason: reason.trim(), includeContent: evidence }
              : {},
      );
      if (action === "messages") {
        setText("");
        pending.current = null;
      }
      setModal(null);
      await refreshAll();
      if (action === "block") router.replace("/(tabs)/inbox");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (conversation.isPending)
    return (
      <Screen back title="A private conversation">
        <ActivityIndicator color={C.accent} />
      </Screen>
    );
  if (!data)
    return (
      <Screen back title="A private conversation">
        <Empty
          icon="chatbubble-outline"
          title="Conversation unavailable."
          description="Return to your inbox or try loading it again."
        />
        <Button
          title="Retry"
          variant="secondary"
          onPress={() => {
            void conversation.refetch();
          }}
        />
        <Button
          title="Back to inbox"
          onPress={() => router.replace("/(tabs)/inbox")}
        />
      </Screen>
    );
  return (
    <Screen
      back
      title={data.thread.otherIdentity?.name || "A private conversation"}
      footer={
        <>
          <ErrorNote message={error} />
          <View
            style={{ flexDirection: "row", gap: 9, alignItems: "flex-end" }}
          >
            <View style={{ flex: 1 }}>
              <Field
                label="YOUR MESSAGE"
                placeholder="Say what you mean…"
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  pending.current = null;
                }}
                maxLength={2000}
                multiline
                editable={!busy}
                style={{ minHeight: 52, maxHeight: 115, padding: 14 }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!text.trim() || busy}
              onPress={() => {
                void act("messages");
              }}
              style={{
                width: 49,
                height: 52,
                borderRadius: 13,
                backgroundColor: C.accent,
                opacity: !text.trim() || busy ? 0.4 : 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {busy ? (
                <ActivityIndicator color={C.bg} />
              ) : (
                <Icon name="arrow-up" color={C.bg} />
              )}
            </Pressable>
          </View>
        </>
      }
    >
      <View style={{ gap: 14 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Label>
            {intentLabel(data.thread.intent).toUpperCase()} · JUST THIS CONVERSATION
          </Label>
          {data.thread.otherIdentity && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setModal("identity")}
            >
              <Text style={{ color: C.accent, fontSize: 12 }}>Identity</Text>
            </Pressable>
          )}
        </View>
        <Note>
          {data.thread.ownRevealed
            ? "You’ve shared your selected identity here. It stays out of public view, but sharing cannot be fully undone."
            : "Your identity is still private. A reply never reveals your name or photos automatically."}
        </Note>
        {!data.thread.ownRevealed && (
          <Button
            title="Choose to reveal my identity"
            variant="secondary"
            icon="person-outline"
            onPress={() => {
              setError(null);
              setModal("reveal");
            }}
          />
        )}
      </View>
      <View style={{ gap: 14, paddingVertical: 10 }}>
        {data.messages.map((message) => (
          <View
            key={message.id}
            style={{
              alignItems: message.isMine ? "flex-end" : "flex-start",
              gap: 5,
            }}
          >
            <View
              style={{
                maxWidth: "86%",
                backgroundColor: message.isMine ? C.accentSoft : C.surface,
                paddingHorizontal: 17,
                paddingVertical: 13,
                borderRadius: 17,
                borderBottomRightRadius: message.isMine ? 5 : 17,
                borderBottomLeftRadius: message.isMine ? 17 : 5,
              }}
            >
              <Text
                selectable
                style={{ color: C.text, fontSize: 15, lineHeight: 23 }}
              >
                {message.text}
              </Text>
            </View>
            <Text
              style={{ color: C.subtle, fontSize: 9, paddingHorizontal: 3 }}
            >
              {new Date(message.createdAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        ))}
      </View>
      <Body style={{ textAlign: "center", color: C.subtle, fontSize: 11 }}>
        No read receipts. No typing or online indicators.
      </Body>
      <View style={{ flexDirection: "row", gap: 25, justifyContent: "center" }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setError(null);
            setModal("block");
          }}
        >
          <Text style={{ color: C.muted, fontSize: 12 }}>Block</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setError(null);
            setModal("report");
          }}
        >
          <Text style={{ color: C.muted, fontSize: 12 }}>Report</Text>
        </Pressable>
      </View>
      <Confirm
        visible={modal === "reveal"}
        title="Let them know it’s you?"
        description="Your current name, profile details and selected photos will be shared only in this conversation. They could capture or share it outside the app."
        confirm="Share my identity here"
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          void act("reveal");
        }}
      >
        <View style={{ gap: 7 }}>
          <Text style={{ color: C.text, fontSize: 20 }}>{profile?.name}</Text>
          <Body style={{ fontSize: 13 }}>
            {profile?.hereTo ? `I'm here to: ${profile.hereTo} · ` : ""}
            {profile?.photos.length || 0} private photos
          </Body>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {profile?.photos.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                style={{ width: 58, height: 72, borderRadius: 8 }}
              />
            ))}
          </View>
        </View>
        <ErrorNote message={error} />
      </Confirm>
      <Confirm
        visible={modal === "identity"}
        title={data.thread.otherIdentity?.name || "Shared identity"}
        description={
          data.thread.otherIdentity?.hereTo
            ? `I'm here to: ${data.thread.otherIdentity.hereTo}. Shared only here.`
            : "Shared only here."
        }
        confirm="Close"
        onCancel={() => setModal(null)}
        onConfirm={() => setModal(null)}
      >
        {data.thread.otherIdentity && (
          <IdentityCard identity={data.thread.otherIdentity} />
        )}
      </Confirm>
      <Confirm
        visible={modal === "block"}
        title="Close this conversation?"
        description="Future interests and messages from this account will be suppressed for you. They won’t receive a block indicator."
        danger
        confirm="Block privately"
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
        title="A private safety report."
        description="Tell the safety team what concerns you. Content is included only if you select it below. No report notice is sent to the other person."
        confirm="Submit report"
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          void act("report");
        }}
      >
        <Field
          label="REASON"
          value={reason}
          onChangeText={setReason}
          placeholder="What happened?"
          multiline
          maxLength={240}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: evidence }}
          onPress={() => setEvidence(!evidence)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Icon
            name={evidence ? "checkbox-outline" : "square-outline"}
            color={C.accent}
          />
          <Body style={{ flex: 1, fontSize: 12 }}>
            Include visible conversation content as evidence.
          </Body>
        </Pressable>
        <ErrorNote message={error} />
      </Confirm>
    </Screen>
  );
}
