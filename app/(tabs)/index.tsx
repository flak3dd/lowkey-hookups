import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Brand,
  Body,
  Button,
  C,
  Card,
  ErrorNote,
  Field,
  Icon,
  Label,
  Mark,
  Screen,
  ShareModal,
  Title,
} from "@/components/get-even/ui";
import {
  prettyPhone,
  relativeDate,
  useApp,
  useLive,
} from "@/lib/get-even/provider";
import { intentLabel, Receipt } from "@/shared/get-even";
import { BRAND } from "@/constants/branding";

export default function Home() {
  const router = useRouter();
  const { user, profile, loading, error, login, refresh } = useApp();
  const [opening, setOpening] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [shareModal, setShareModal] = useState(false);
  const sent = useLive<{ items: Receipt[] }>("sent", "/sent", !!profile);
  useEffect(() => {
    if (user && !profile && !loading) router.replace("/setup");
  }, [user, profile, loading, router]);
  if (!profile)
    return (
      <Screen>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 5,
          }}
        >
          <Brand />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: C.accent,
              }}
            />
            <Label>18+ ONLY</Label>
          </View>
        </View>
        <View style={{ paddingTop: 12, gap: 20 }}>
          <Label style={{ color: C.accent }}>
            {BRAND.name.toUpperCase()} · PRIVATE BY DESIGN
          </Label>
          <Title small>
            For that sexual tension,{"\n"}
            <Text style={{ color: C.accent }}>
              that’s never been acted on.
            </Text>
          </Title>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "600" }}>
            Keep it lowkey.
          </Text>
          <Text
            style={{
              color: C.text,
              fontSize: 17,
              lineHeight: 26,
              fontStyle: "italic",
              borderLeftWidth: 2,
              borderLeftColor: C.accent,
              paddingLeft: 14,
            }}
          >
            Are you forever thinking about that stare down you had, the one you
            swear spoke 1000 words, but is off limits?
          </Text>
          <Body style={{ maxWidth: 330 }}>
            A private way to share a little interest. The next step is always
            theirs.
          </Body>
        </View>
        <View
          style={{
            marginVertical: 8,
            paddingVertical: 26,
            flexDirection: "row",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: C.border,
            justifyContent: "space-between",
          }}
        >
          <View style={{ gap: 12 }}>
            <Icon name="eye-off-outline" color={C.accent} />
            <Text style={{ color: C.text, fontSize: 13 }}>
              No public profile.
            </Text>
            <Body style={{ fontSize: 12 }}>No one to browse.</Body>
          </View>
          <View style={{ width: 1, backgroundColor: C.border }} />
          <View style={{ gap: 12 }}>
            <Icon name="hand-left-outline" color={C.accent} />
            <Text style={{ color: C.text, fontSize: 13 }}>
              No pressure to reply.
            </Text>
            <Body style={{ fontSize: 12 }}>Silence stays private.</Body>
          </View>
        </View>
        <View style={{ gap: 14 }}>
          <Button
            title={loading ? "Entering…" : "Enter"}
            loading={loading || opening}
            icon="arrow-forward"
            onPress={() => {
              setOpening(true);
              void login().finally(() => setOpening(false));
            }}
          />
          <Body style={{ textAlign: "center", fontSize: 12, lineHeight: 19 }}>
            Private by design. Just a name and verified mobile number. Fast SMS
            verification.
          </Body>
          <ErrorNote message={error} />
          {error && (
            <Button
              title="Retry connection"
              variant="quiet"
              onPress={() => {
                void refresh();
              }}
            />
          )}
        </View>
        <Button
          title="Share LOWKEY with friends"
          variant="secondary"
          icon="share-social-outline"
          onPress={() => setShareModal(true)}
        />
        <Button
          title="App info · The 3-Step Journey"
          variant="secondary"
          icon="information-circle-outline"
          onPress={() => router.push("/app-info")}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/privacy")}
          style={{ paddingVertical: 12, alignSelf: "center" }}
        >
          <Text
            style={{
              color: C.subtle,
              fontSize: 12,
              textDecorationLine: "underline",
            }}
          >
            What private does—and doesn’t—mean
          </Text>
        </Pressable>
        <ShareModal
          visible={shareModal}
          onClose={() => setShareModal(false)}
        />
      </Screen>
    );
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Brand />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share app with friends"
            onPress={() => setShareModal(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 14,
              backgroundColor: C.accentSoft,
              borderColor: C.accentBorder,
              borderWidth: 1,
            }}
          >
            <Icon name="share-social-outline" color={C.accent} size={13} />
            <Text
              style={{ color: C.accentText, fontSize: 11, fontWeight: "600" }}
            >
              Share
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Icon name="lock-closed-outline" color={C.subtle} size={12} />
            <Label>ONLY YOU</Label>
          </View>
        </View>
      </View>
      <View style={{ gap: 14, paddingTop: 9 }}>
        <Title>
          When they off limits,{"\n"}
          <Text style={{ color: C.accent }}>but you feel that fire</Text>
        </Title>
        <Body>
          No way to know if they have the app, or if they ignore your signal..
          Unless they respond.. And well, if they respond, there’s not much more
          that needs to be said..
        </Body>
      </View>
      <Card
        style={{
          backgroundColor: C.accentSoft,
          borderColor: C.accentBorder,
          padding: 24,
          gap: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Mark size={38} />
          <Label
            style={{ color: C.accentText, flexShrink: 1, textAlign: "right" }}
          >
            THE ANSWER TO YOUR QUESTIONS JUST 1 CLICK AWAY
          </Label>
        </View>
        <Text
          style={{
            color: C.text,
            fontSize: 28,
            lineHeight: 34,
            letterSpacing: -0.6,
          }}
        >
          To send someone your intent
        </Text>
        <Body style={{ color: C.accentText, fontSize: 14 }}>
          Select a contact from your phone or enter their mobile number.
        </Body>

        <View style={{ gap: 14 }}>
          <Field
            label="THEIR MOBILE NUMBER"
            placeholder="+61 412 345 678"
            keyboardType="phone-pad"
            value={targetPhone}
            onChangeText={setTargetPhone}
            maxLength={24}
          />
          <Button
            title="Send"
            icon="arrow-forward"
            onPress={() =>
              router.push({
                pathname: "/compose",
                params: targetPhone.trim() ? { phone: targetPhone.trim() } : {},
              })
            }
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginVertical: 4,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text style={{ color: C.subtle, fontSize: 10, fontWeight: "700" }}>
              OR
            </Text>
          </View>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>

        <Button
          title="Select contacts"
          variant="secondary"
          icon="people-outline"
          onPress={() => router.push("/mass-probe")}
        />
      </Card>
      <View style={{ gap: 17 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Label>YOUR SENT INTERESTS</Label>
          <Text style={{ color: C.subtle, fontSize: 10 }}>
            Visible only to you
          </Text>
        </View>
        {sent.isPending ? (
          <ActivityIndicator color={C.accent} />
        ) : sent.error ? (
          <>
            <ErrorNote message="Your Sent history couldn’t load." />
            <Button
              title="Retry"
              variant="quiet"
              onPress={() => {
                void sent.refetch();
              }}
            />
          </>
        ) : sent.data?.items.length ? (
          sent.data.items.slice(0, 6).map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                padding: 16,
                borderRadius: 16,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: C.accentSoft,
                  borderColor: C.accentBorder,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={
                    item.mode === "anonymous"
                      ? "eye-off-outline"
                      : "person-outline"
                  }
                  color={C.accent}
                  size={20}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }}>
                  {prettyPhone(item.targetPhone)}
                </Text>
                <Text style={{ color: C.subtle, fontSize: 12 }}>
                  💋 · {item.mode === "anonymous" ? "Anonymous" : "Named"} ·{" "}
                  {relativeDate(item.createdAt)}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: C.accentSoft,
                }}
              >
                <Text style={{ color: C.accentText, fontSize: 11, fontWeight: "600" }}>
                  Sent
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Card style={{ paddingVertical: 24 }}>
            <Body style={{ fontSize: 14 }}>
              Nothing sent yet. The timing is yours.
            </Body>
          </Card>
        )}
      </View>
      <Button
        title="Share LOWKEY with friends"
        variant="secondary"
        icon="share-social-outline"
        onPress={() => setShareModal(true)}
      />
      <Button
        title="App info · The 3-Step Journey"
        variant="secondary"
        icon="information-circle-outline"
        onPress={() => router.push("/app-info")}
      />
      <Pressable
        onPress={() => router.push("/privacy")}
        accessibilityRole="button"
      >
        <Body style={{ fontSize: 11, lineHeight: 17, color: C.subtle }}>
          Private beta · Numbers verified via SMS. Server-managed encryption,
          not end-to-end. Know the limits →
        </Body>
      </Pressable>
      <ShareModal
        visible={shareModal}
        onClose={() => setShareModal(false)}
      />
    </Screen>
  );
}
