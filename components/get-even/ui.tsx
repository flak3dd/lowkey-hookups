import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import type { ColorValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import {
  INTENTS,
  INTENT_SYMBOL,
  Identity,
  Intent,
  intentLabel,
} from "@/shared/get-even";
import { BRAND, LOWKEY_THEME } from "@/constants/branding";

export const C = LOWKEY_THEME;
export function Icon({
  name,
  size = 22,
  color = C.muted,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: ColorValue | null;
}) {
  type IoniconColor = React.ComponentProps<typeof Ionicons>["color"];
  return (
    <Ionicons
      name={name}
      size={size}
      color={(color ?? C.muted) as IoniconColor}
    />
  );
}
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <ExpoImage
      source={require("@/assets/images/lowkey-lips.png")}
      accessibilityLabel={BRAND.name}
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}
export function Brand() {
  return (
    <ExpoImage
      source={require("@/assets/images/lowkey-wordmark.png")}
      accessibilityLabel={BRAND.name}
      contentFit="contain"
      style={{ width: 188, height: 43, flexShrink: 1 }}
    />
  );
}
export function DesireMotif({ compact = false }: { compact?: boolean }) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: compact ? 92 : 130,
        height: compact ? 92 : 130,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 80,
          borderWidth: 1,
          borderColor: C.accentBorder,
          backgroundColor: C.accentSoft,
        }}
      />
      <View
        style={{
          position: "absolute",
          inset: 10,
          borderRadius: 70,
          borderWidth: 1,
          borderColor: C.border,
        }}
      />
      <Mark size={compact ? 64 : 94} />
    </View>
  );
}
export function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <Text style={[s.label, style]}>{children}</Text>;
}
export function Body({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <Text style={[s.body, style]}>{children}</Text>;
}
export function Title({
  children,
  small = false,
}: {
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Text style={[s.title, small && { fontSize: 34, lineHeight: 40 }]}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "quiet";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const foreground =
    variant === "primary"
      ? C.onAccent
      : variant === "danger"
        ? C.danger
        : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "primary"
          ? { backgroundColor: C.accent }
          : variant === "quiet"
            ? { backgroundColor: "transparent" }
            : {
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: variant === "danger" ? C.border : C.accentBorder,
              },
        (loading || disabled) && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          <Text style={[s.buttonText, { color: foreground }]}>{title}</Text>
          {icon && <Icon name={icon} color={foreground} size={20} />}
        </>
      )}
    </Pressable>
  );
}
export function Screen({
  children,
  back = false,
  title,
  footer,
  scroll = true,
}: {
  children: React.ReactNode;
  back?: boolean;
  title?: string;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const router = useRouter();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.safe}>
      <KeyboardAvoidingView
        style={s.shell}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {(back || title) && (
          <View style={s.nav}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/(tabs)")
                }
                style={s.back}
              >
                <Icon name="arrow-back" color={C.text} />
              </Pressable>
            ) : (
              <Brand />
            )}
            <Text style={s.navTitle}>{title}</Text>
            {back && <View style={{ width: 40 }} />}
          </View>
        )}
        {scroll ? (
          <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[s.content, { flex: 1 }]}>{children}</View>
        )}
        {footer && <View style={s.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={[s.card, style]}>{children}</View>
  );
}
export function Field({
  label,
  helper,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string; helper?: string }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Label style={focused ? { color: C.accent } : undefined}>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={C.subtle}
        selectionColor={C.accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          s.input,
          focused && { borderColor: C.accent, backgroundColor: C.surface },
          props.multiline && { minHeight: 108, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {helper && <Body style={{ fontSize: 12, lineHeight: 18 }}>{helper}</Body>}
    </View>
  );
}
export function Note({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <View
      style={[
        s.note,
        warning && { borderLeftColor: C.subtle, backgroundColor: C.surface },
      ]}
    >
      <Icon
        name={warning ? "information-circle-outline" : "eye-off-outline"}
        size={19}
        color={warning ? C.muted : C.accent}
      />
      <Body
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 20,
          color: warning ? C.muted : C.accentText,
        }}
      >
        {children}
      </Body>
    </View>
  );
}
export function ErrorNote({ message }: { message?: string | null }) {
  return message ? (
    <Text accessibilityRole="alert" style={s.error}>
      {message}
    </Text>
  ) : null;
}
export function IntentChips({
  value,
  onChange,
}: {
  value: Intent;
  onChange: (value: Intent) => void;
}) {
  return (
    <View style={s.chips}>
      {INTENTS.map((intent) => (
        <Pressable
          key={intent}
          accessibilityRole="button"
          accessibilityLabel={intent}
          accessibilityState={{ selected: value === intent }}
          onPress={() => onChange(intent)}
          style={[s.chip, value === intent && s.selectedChip]}
        >
          <Text style={{ fontSize: 30, lineHeight: 36 }}>
            {INTENT_SYMBOL[intent]}
          </Text>
          <Text
            style={{
              color: value === intent ? C.accent : C.muted,
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {intent}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function IdentityCard({
  identity,
  intent,
  anonymous = false,
}: {
  identity?: Identity | null;
  intent?: Intent;
  anonymous?: boolean;
}) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {identity?.photos?.[0] && !anonymous ? (
        <Image
          source={{ uri: identity.photos[0] }}
          style={{ width: "100%", height: 230 }}
          resizeMode="cover"
        />
      ) : (
        <View style={s.identityArt}>
          <View style={s.identityCircle}>
            <Icon
              name={anonymous ? "eye-off-outline" : "person-outline"}
              size={32}
              color={C.accent}
            />
          </View>
        </View>
      )}
      <View style={{ padding: 22, gap: 10 }}>
        <Label>
          {anonymous ? "IDENTITY KEPT PRIVATE" : "SHARED JUST HERE"}
        </Label>
        <Text style={{ color: C.text, fontSize: 26, fontWeight: "500" }}>
          {anonymous
            ? "Someone you may know"
            : identity?.name || "Private identity"}
        </Text>
        {identity?.hereTo && !anonymous ? (
          <Body style={{ color: C.accentText, fontSize: 14 }}>
            I’m here to: {identity.hereTo}
          </Body>
        ) : (
          <Body>
            {anonymous
              ? "No name or photos shared."
              : identity
                ? "Identity revealed in this conversation."
                : "No name or photos shared."}
          </Body>
        )}
        {identity && !anonymous && identity.photos.length > 1 && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {identity.photos.slice(1).map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={{ width: 62, height: 78, borderRadius: 8 }}
              />
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}
export function Empty({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={28} color={C.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Body style={{ textAlign: "center", maxWidth: 300 }}>{description}</Body>
    </View>
  );
}
export function Row({
  icon,
  title,
  detail,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={s.row}
    >
      <Icon name={icon} color={danger ? C.danger : C.muted} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: danger ? C.danger : C.text, fontSize: 15 }}>
          {title}
        </Text>
        {detail && (
          <Text style={{ color: C.subtle, fontSize: 12, lineHeight: 17 }}>
            {detail}
          </Text>
        )}
      </View>
      {onPress && <Icon name="chevron-forward" size={17} color={C.subtle} />}
    </Pressable>
  );
}
export function Confirm({
  visible,
  title,
  description,
  confirm = "Confirm",
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
  children,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirm?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <ScrollView
          style={[s.modal, { maxHeight: "90%" }]}
          contentContainerStyle={{ gap: 20, paddingBottom: 25 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Label>YOUR CHOICE</Label>
          <Title small>{title}</Title>
          <Body>{description}</Body>
          {children}
          <Button
            title={confirm}
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onPress={onConfirm}
          />
          <Button
            title="Cancel"
            variant="quiet"
            disabled={busy}
            onPress={onCancel}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  shell: { flex: 1, width: "100%", maxWidth: 580, alignSelf: "center" },
  content: {
    paddingHorizontal: 25,
    paddingTop: 22,
    paddingBottom: 35,
    gap: 25,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  wordmark: {
    color: C.text,
    letterSpacing: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    color: C.text,
    fontSize: 46,
    lineHeight: 51,
    letterSpacing: -1.8,
    fontWeight: "700",
  },
  label: {
    color: C.subtle,
    fontSize: 10,
    letterSpacing: 1.9,
    fontWeight: "600",
  },
  body: { color: C.muted, fontSize: 15, lineHeight: 24 },
  button: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 21,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.1 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderTopColor: C.accentBorder,
    borderRadius: 24,
    padding: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 3,
  },
  nav: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navTitle: { color: C.muted, fontSize: 13, flexShrink: 1 },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: C.surface,
  },
  footer: {
    padding: 22,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 12,
    backgroundColor: C.bg,
  },
  input: {
    color: C.text,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    padding: 17,
    fontSize: 16,
  },
  note: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 17,
    backgroundColor: C.accentSoft,
    borderRadius: 16,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
  },
  error: { color: C.danger, fontSize: 13, lineHeight: 20 },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  selectedChip: { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
  identityArt: {
    height: 142,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  identityCircle: {
    width: 77,
    height: 77,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: C.accentBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: { alignItems: "center", paddingVertical: 37, gap: 18 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  emptyTitle: {
    color: C.text,
    textAlign: "center",
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  row: {
    paddingVertical: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  overlay: {
    flex: 1,
    padding: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,.78)",
  },
  modal: {
    width: "100%",
    maxWidth: 430,
    padding: 25,
    borderRadius: 23,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    gap: 20,
  },
});

export { ShareModal, quickShareApp } from "./share-modal";

