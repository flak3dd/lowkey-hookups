import { Text, View } from "react-native";
import {
  Body,
  C,
  Card,
  Icon,
  Label,
  Mark,
  Note,
  Screen,
  Title,
} from "@/components/get-even/ui";
import { DISCRETION_PILLARS } from "@/constants/app-info";
import { BRAND } from "@/constants/branding";

export default function Privacy() {
  return (
    <Screen back title="Discretion, explained">
      <Mark size={45} />
      <Label>NOT A DIRECTORY. NOT A PUBLIC PROFILE.</Label>
      <Title>Small circle.{"\n"}Clear boundaries.</Title>
      <Body>
        Your interest stays out of public view. The recipient controls whether
        the conversation begins.
      </Body>
      <View style={{ gap: 4, paddingTop: 8 }}>
        <Text
          style={{
            color: C.text,
            fontSize: 24,
            fontWeight: "700",
            letterSpacing: -0.6,
          }}
        >
          The 6 Pillars of Discretion
        </Text>
        <Body style={{ fontSize: 14 }}>
          Clear limits on what is shared, signalled, and surfaced.
        </Body>
      </View>
      {DISCRETION_PILLARS.map((pillar, index) => (
        <View
          key={pillar.title}
          style={{
            gap: 12,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Text
              style={{
                color: C.accent,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.8,
                width: 22,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Icon name={pillar.icon} color={C.accent} size={20} />
            <Text
              style={{
                color: C.text,
                fontSize: 18,
                fontWeight: "600",
                letterSpacing: -0.3,
                flex: 1,
              }}
            >
              {pillar.title}
            </Text>
          </View>
          <Body style={{ fontSize: 14, paddingLeft: 34 }}>{pillar.text}</Body>
        </View>
      ))}
      <Card style={{ borderColor: C.border, gap: 17 }}>
        <Label style={{ color: C.muted }}>
          WHAT THIS BETA DOES NOT PROMISE
        </Label>
        <Body style={{ color: C.text, fontSize: 14 }}>
          Phone numbers are verified via SMS one-time code to confirm that each
          person controls that number. Your number remains private and is never
          shown publicly.
        </Body>
        <Body style={{ fontSize: 14 }}>
          If a number has multiple registrations, routing is suppressed rather
          than choosing a recipient. A later signup never receives a previously
          undeliverable probe.
        </Body>
        <Body style={{ color: C.text, fontSize: 14 }}>
          Server-managed encryption is not end-to-end encryption. The service
          can decrypt stored content and knows account/routing metadata.
          “Anonymous” means hidden from the recipient, not from the operator.
        </Body>
        <Body style={{ fontSize: 14 }}>
          Private access does not prevent screenshots, sharing outside the app,
          or someone accessing an unlocked device. The 18+ check is an
          attestation, not verified age.
        </Body>
      </Card>
      <Note warning>
        Do not use this beta for sensitive information. Reviewed endpoint
        encryption, stronger identity binding and operational safety are
        required before a public sensitive-data launch.
      </Note>
      <View style={{ gap: 15 }}>
        <Label>YOUR CONTROLS</Label>
        <Body style={{ fontSize: 14 }}>
          Optional contact batching keeps imported labels and your working
          address-book list on the device. Only explicitly reviewed numbers are
          submitted after confirmation. Samples cannot be sent. There is no
          pre-reply mutual-match count: a batch count describes your
          submissions, not who has an account or expressed interest.
        </Body>
        <Body style={{ fontSize: 14 }}>
          Block or report directly from an interest or conversation. Reports
          include content only when you choose it. Wipe pending interests,
          delete {BRAND.name} data, or sign out from Private.
        </Body>
        <Body style={{ fontSize: 14 }}>
          Deletion removes controlled live records, not independent copies or
          screenshots. Minimal safety records may remain. Removing an outbox
          entry is not a recall. Unaccepted probes expire after 30 days.
        </Body>
        <Body style={{ fontSize: 14 }}>
          Remote push is not connected in this build. The inbox refreshes
          in-app; there are no read, delivery, typing, or online indicators.
        </Body>
      </View>
      <Body style={{ textAlign: "center", fontSize: 11, color: C.subtle }}>
        {BRAND.name} · Private by design.
      </Body>
    </Screen>
  );
}
