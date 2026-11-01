import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Brand,
  Body,
  Button,
  C,
  Card,
  Label,
  Note,
  Screen,
  ShareModal,
  Title,
} from "@/components/get-even/ui";
import { BRAND } from "@/constants/branding";
import { APP_JOURNEY, JOURNEY_VISIBILITY_NOTE } from "@/constants/app-info";

export default function AppInfo() {
  const router = useRouter();
  const [shareModal, setShareModal] = useState(false);
  return (
    <Screen back title="App info">
      <Brand />
      <View style={{ gap: 13 }}>
        <Label style={{ color: C.accent }}>SIGNUP.SEND.WAIT.</Label>
        <Title>The 3-Step{"\n"}Journey</Title>
        <Body>
          A complete 3 step flow with 100% discretion and maximum intention
        </Body>
      </View>
      <View style={{ gap: 14 }}>
        {APP_JOURNEY.map((step) => (
          <Card key={step.number}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: C.accentSoft,
                  borderWidth: 1,
                  borderColor: C.accentBorder,
                }}
              >
                <Text
                  style={{ color: C.accent, fontSize: 15, fontWeight: "700" }}
                >
                  {step.number}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Label>STEP {step.number}</Label>
                <Text
                  style={{ color: C.text, fontSize: 21, fontWeight: "600" }}
                >
                  {step.title}
                </Text>
              </View>
            </View>
            <Body style={{ fontSize: 14 }}>{step.text}</Body>
          </Card>
        ))}
      </View>
      <Note warning>{JOURNEY_VISIBILITY_NOTE}</Note>
      <Card
        style={{ backgroundColor: C.accentSoft, borderColor: C.accentBorder }}
      >
        <Label style={{ color: C.accentText }}>KNOW WHAT PRIVATE MEANS</Label>
        <Body style={{ color: C.accentText, fontSize: 14 }}>
          No public directory and no hidden response tracking. Read the six
          pillars, your controls, and the beta's identity and encryption limits.
        </Body>
        <Button
          title="The 6 Pillars of Discretion"
          icon="arrow-forward"
          onPress={() => router.push("/privacy")}
        />
      </Card>
      <Button
        title="Share LOWKEY with friends"
        variant="secondary"
        icon="share-social-outline"
        onPress={() => setShareModal(true)}
      />
      <Body style={{ fontSize: 11, lineHeight: 18, color: C.subtle }}>
        Adults 18+ · Numbers and age are self-declared. This is server-managed
        encryption, not end-to-end encryption. The service can decrypt stored
        content.
      </Body>
      <ShareModal
        visible={shareModal}
        onClose={() => setShareModal(false)}
      />
    </Screen>
  );
}
