import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Body,
  Button,
  C,
  Card,
  Empty,
  ErrorNote,
  Icon,
  Label,
  Screen,
  Title,
} from "@/components/get-even/ui";
import { relativeDate, useApp, useLive } from "@/lib/get-even/provider";
import { InboxItem, INTENT_SYMBOL, ThreadSummary } from "@/shared/get-even";

export default function Inbox() {
  const router = useRouter();
  const { profile } = useApp();
  const [tab, setTab] = useState<"interests" | "conversations">("interests");
  const inbox = useLive<{ items: InboxItem[] }>("inbox", "/inbox", !!profile);
  const threads = useLive<{ items: ThreadSummary[] }>(
    "threads",
    "/threads",
    !!profile,
  );
  const current = tab === "interests" ? inbox : threads;
  if (!profile)
    return (
      <Screen>
        <Empty
          icon="lock-closed-outline"
          title="Your inbox is private."
          description="Tap Enter on the home screen to continue."
        />
        <Button
          title="Back to home"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  return (
    <Screen>
      <View style={{ paddingTop: 8, gap: 12 }}>
        <Label>YOU HOLD THE NEXT STEP</Label>
        <Title>On your terms.</Title>
        <Body>
          Reply, ignore, or leave it for another day.{"\n"}You don’t owe anyone
          an answer.
        </Body>
      </View>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: C.surface,
          padding: 4,
          borderRadius: 13,
        }}
      >
        {(["interests", "conversations"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: tab === item ? C.raised : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: tab === item ? C.text : C.subtle, fontSize: 13 }}
            >
              {item === "interests" ? "Interests" : "Conversations"}
            </Text>
          </Pressable>
        ))}
      </View>
      {current.isPending ? (
        <ActivityIndicator color={C.accent} />
      ) : current.error ? (
        <>
          <ErrorNote message="Your private inbox couldn’t load." />
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              void current.refetch();
            }}
          />
        </>
      ) : tab === "interests" ? (
        inbox.data?.items.length ? (
          inbox.data.items.map((item) => (
            <Card
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/interest/[id]",
                  params: { id: item.id },
                })
              }
              style={{ gap: 20 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    padding: 11,
                    borderRadius: 13,
                    backgroundColor: C.accentSoft,
                  }}
                >
                  <Icon
                    name={
                      item.mode === "anonymous"
                        ? "eye-off-outline"
                        : "person-outline"
                    }
                    color={C.accent}
                  />
                </View>
                <Label>{relativeDate(item.createdAt)}</Label>
              </View>
              <View style={{ gap: 9 }}>
                <Text
                  style={{ color: C.text, fontSize: 23, letterSpacing: -0.4 }}
                >
                  {item.identity?.name || "Someone you may know"}
                </Text>
                <Body style={{ fontSize: 14 }}>
                  Sent you a {INTENT_SYMBOL[item.intent] ?? item.intent}
                </Body>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Label style={{ color: C.muted }}>
                  {item.mode === "anonymous" ? "ANONYMOUS" : "IDENTITY SHARED"}
                </Label>
                <Icon name="arrow-forward" size={18} color={C.accent} />
              </View>
            </Card>
          ))
        ) : (
          <Empty
            icon="mail-outline"
            title={"Nothing to answer.\nNothing to explain."}
            description="If someone sends you an interest, it appears only here. Opening it never notifies them."
          />
        )
      ) : threads.data?.items.length ? (
        threads.data.items.map((item) => (
          <Card
            key={item.id}
            onPress={() =>
              router.push({ pathname: "/thread/[id]", params: { id: item.id } })
            }
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 15 }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 17,
                  backgroundColor: C.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={
                    item.otherIdentity ? "person-outline" : "chatbubble-outline"
                  }
                  color={C.accent}
                />
              </View>
              <View style={{ flex: 1, gap: 7 }}>
                <Text style={{ color: C.text, fontSize: 16 }}>
                  {item.otherIdentity?.name || "Private conversation"}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}
                >
                  {item.lastMessage || "A conversation on your terms."}
                </Text>
              </View>
              <Icon name="chevron-forward" size={17} />
            </View>
          </Card>
        ))
      ) : (
        <Empty
          icon="chatbubbles-outline"
          title="Only if you choose."
          description="Accept an interest and send a first reply to start a private conversation."
        />
      )}
      <Body style={{ textAlign: "center", color: C.subtle, fontSize: 11 }}>
        No read receipts. No online status. Just you.
      </Body>
    </Screen>
  );
}
