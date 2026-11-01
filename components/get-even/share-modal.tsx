import React, { useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BRAND, LOWKEY_THEME as C } from "@/constants/branding";
import { Body, Button, Card, Icon, Label, Mark, Note, Title } from "./ui";

export const APP_SHARE_URL = "https://lowkeyhookups.app";
export const APP_SHARE_MESSAGE = `${BRAND.tagline}\n\nJoin ${BRAND.name} to see if that tension goes anywhere, 100% privately: ${APP_SHARE_URL}`;

export async function quickShareApp() {
  try {
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.share
    ) {
      await navigator.share({
        title: BRAND.name,
        text: `${BRAND.tagline} Join ${BRAND.name} privately.`,
        url: APP_SHARE_URL,
      });
      return true;
    }
    const result = await Share.share(
      Platform.OS === "ios"
        ? {
            title: BRAND.name,
            message: `${BRAND.tagline}\nJoin ${BRAND.name}:`,
            url: APP_SHARE_URL,
          }
        : {
            title: BRAND.name,
            message: APP_SHARE_MESSAGE,
          },
      {
        dialogTitle: `Share ${BRAND.name} with friends`,
      },
    );
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

export function ShareModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleNativeShare = async () => {
    await quickShareApp();
  };

  const handleSMS = () => {
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${separator}body=${encodeURIComponent(APP_SHARE_MESSAGE)}`;
    void Linking.openURL(url).catch(() => {
      void handleNativeShare();
    });
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(APP_SHARE_MESSAGE)}`;
    void Linking.openURL(url).catch(() => {
      void handleNativeShare();
    });
  };

  const handleCopy = async () => {
    try {
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(APP_SHARE_URL);
      } else {
        await Share.share({ message: APP_SHARE_URL });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={shareStyles.overlay}>
        <ScrollView
          style={[shareStyles.modal, { maxHeight: "90%" }]}
          contentContainerStyle={{ gap: 20, paddingBottom: 25 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Mark size={28} />
              <Label style={{ color: C.accent }}>SPREAD THE WORD</Label>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close share"
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: C.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" size={18} color={C.muted} />
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            <Title small>Share with{"\n"}friends.</Title>
            <Body style={{ fontSize: 14 }}>
              Invite someone to join. They’ll never know if you sent an interest
              unless they send one back to you.
            </Body>
          </View>

          <Card
            style={{
              backgroundColor: C.accentSoft,
              borderColor: C.accentBorder,
              padding: 16,
              gap: 10,
            }}
          >
            <Label style={{ color: C.accentText }}>INVITE PREVIEW</Label>
            <Text
              style={{
                color: C.text,
                fontSize: 16,
                fontWeight: "600",
                fontStyle: "italic",
              }}
            >
              “{BRAND.tagline}”
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: C.surface,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Text
                style={{ color: C.muted, fontSize: 13, flex: 1 }}
                numberOfLines={1}
              >
                {APP_SHARE_URL}
              </Text>
              <Pressable
                onPress={handleCopy}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: copied ? C.accent : C.raised,
                }}
              >
                <Text
                  style={{
                    color: copied ? C.onAccent : C.accentText,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {copied ? "COPIED! 💋" : "COPY LINK"}
                </Text>
              </Pressable>
            </View>
          </Card>

          <View style={{ gap: 10 }}>
            <Button
              title="Share via device (AirDrop, Messages, etc.)"
              icon="share-social-outline"
              onPress={handleNativeShare}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSMS}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 16,
                  backgroundColor: C.surface,
                  borderWidth: 1,
                  borderColor: C.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Icon name="chatbubble-outline" size={18} color={C.accent} />
                <Text
                  style={{ color: C.text, fontSize: 13, fontWeight: "600" }}
                >
                  SMS
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleWhatsApp}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 16,
                  backgroundColor: C.surface,
                  borderWidth: 1,
                  borderColor: C.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Icon name="logo-whatsapp" size={18} color={C.accent} />
                <Text
                  style={{ color: C.text, fontSize: 13, fontWeight: "600" }}
                >
                  WhatsApp
                </Text>
              </Pressable>
            </View>
          </View>

          <Note>
            Discreet & private: Sharing the app link is completely general. It
            never reveals your identity, number, or who you have sent signals
            to.
          </Note>

          <Button title="Done" variant="quiet" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const shareStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,.82)",
  },
  modal: {
    width: "100%",
    maxWidth: 440,
    padding: 24,
    borderRadius: 24,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.accentBorder,
    gap: 18,
  },
});
