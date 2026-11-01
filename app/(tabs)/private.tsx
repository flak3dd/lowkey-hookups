import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Body,
  Button,
  C,
  Card,
  Confirm,
  Empty,
  ErrorNote,
  Icon,
  Label,
  Note,
  Row,
  Screen,
  ShareModal,
  Title,
} from "@/components/get-even/ui";
import {
  errorText,
  prettyPhone,
  request,
  useApp,
} from "@/lib/get-even/provider";
import { BRAND } from "@/constants/branding";
import { intentLabel } from "@/shared/get-even";

export default function Private() {
  const router = useRouter();
  const { profile, logout, refreshAll } = useApp();
  const [shareModal, setShareModal] = useState(false);
  const [action, setAction] = useState<"wipe" | "delete" | "logout" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = async () => {
    setBusy(true);
    setError(null);
    try {
      if (action === "logout") await logout();
      else {
        await request(action === "delete" ? "/profile" : "/inbox", "DELETE");
        await refreshAll();
      }
      setAction(null);
      if (action === "delete" || action === "logout") router.replace("/(tabs)");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!profile)
    return (
      <Screen>
        <Empty
          icon="person-outline"
          title="Only you can set this up."
          description="Tap Enter on the home screen to add your name-and-number record."
        />
        <Button
          title="Open my space"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 8 }}>
        <Label>YOUR DETAILS. YOUR CHOICE.</Label>
        <Title>Private,{"\n"}by default.</Title>
        <Body>This isn’t a profile other people can find.</Body>
      </View>
      <Card>
        <View style={{ flexDirection: "row", gap: 17, alignItems: "center" }}>
          {profile.photos[0] ? (
            <Image
              source={{ uri: profile.photos[0] }}
              style={{ width: 66, height: 82, borderRadius: 16 }}
            />
          ) : (
            <View
              style={{
                width: 66,
                height: 75,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: C.accentSoft,
              }}
            >
              <Icon name="person-outline" color={C.accent} size={29} />
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: C.text, fontSize: 23 }}>{profile.name}</Text>
            <Body style={{ fontSize: 13 }}>{prettyPhone(profile.phone)}</Body>
            {profile.hereTo ? (
              <Label style={{ color: C.accent }}>
                I’M HERE TO: {profile.hereTo.toUpperCase()}
              </Label>
            ) : null}
          </View>
          <Icon name="eye-off-outline" color={C.subtle} size={17} />
        </View>
        <Button
          title="Edit my private setup"
          variant="secondary"
          onPress={() => router.push("/setup")}
        />
      </Card>
      <Note>
        Your name and photos only appear with a named send or when you
        explicitly reveal them in a conversation.
      </Note>
      <View>
        <Label>DISCRETION & CONTROL</Label>
        <Row
          icon="share-social-outline"
          title="Share app with friends"
          detail="Spread the word while keeping your identity 100% private."
          onPress={() => setShareModal(true)}
        />
        <Row
          icon="information-circle-outline"
          title="App info"
          detail="The 3-Step Journey, explained."
          onPress={() => router.push("/app-info")}
        />
        <Row
          icon="shield-outline"
          title="How privacy works"
          detail="Read what’s hidden—and what isn’t."
          onPress={() => router.push("/privacy")}
        />
        <Row
          icon="hand-left-outline"
          title="Blocked people"
          detail="Anonymous blocks work without revealing identity."
          onPress={() => router.push("/blocked")}
        />
        <Row
          icon="notifications-off-outline"
          title="In-app inbox only"
          detail="Remote push isn’t connected. Open the app to refresh."
        />
      </View>
      <View>
        <Label>YOUR DATA</Label>
        <Row
          icon="trash-outline"
          title="Wipe my inbox"
          detail="Remove the interests currently in your inbox."
          onPress={() => {
            setError(null);
            setAction("wipe");
          }}
        />
        <Row
          icon="close-circle-outline"
          title={`Delete ${BRAND.name} data`}
          detail="Removes your setup and content from the service."
          danger
          onPress={() => {
            setError(null);
            setAction("delete");
          }}
        />
        <Row
          icon="log-out-outline"
          title="Leave this space"
          onPress={() => {
            setError(null);
            setAction("logout");
          }}
        />
      </View>
      <Body style={{ fontSize: 11, lineHeight: 18, color: C.subtle }}>
        Private beta · No verified-number or verified-age claim. Server-managed
        encryption, not end-to-end encryption. The service can decrypt stored
        content.
      </Body>
      <Confirm
        visible={!!action}
        title={
          action === "delete"
            ? "Leave a little less behind."
            : action === "wipe"
              ? "Clear this inbox?"
              : "Leave this space for good?"
        }
        description={
          action === "delete"
            ? `Your ${BRAND.name} setup and controlled content will be removed. This does not erase screenshots and independent copies. Minimal safety/block records may remain.`
            : action === "wipe"
              ? "Current pending interests will be removed from your view. Senders won’t receive an update. This does not erase accepted conversations."
              : "There’s no sign-in, so this phone is the only key to your space. Leaving revokes it and you won’t be able to get back in."
        }
        confirm={
          action === "delete"
            ? `Delete my ${BRAND.name} data`
            : action === "wipe"
              ? "Wipe privately"
              : "Leave this space"
        }
        danger
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          void complete();
        }}
      >
        <ErrorNote message={error} />
      </Confirm>
      <ShareModal
        visible={shareModal}
        onClose={() => setShareModal(false)}
      />
    </Screen>
  );
}
