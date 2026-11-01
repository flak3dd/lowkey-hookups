import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  Body,
  Button,
  C,
  Card,
  ErrorNote,
  Field,
  Icon,
  Label,
  Note,
  Screen,
  Title,
} from "@/components/get-even/ui";
import {
  errorText,
  prettyPhone,
  request,
  useApp,
} from "@/lib/get-even/provider";
import { Profile } from "@/shared/get-even";
import { BRAND } from "@/constants/branding";

type SendVerificationResponse = {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  debugCode?: string;
};

type VerifyResponse = {
  success: boolean;
  verified: boolean;
  verificationToken: string;
};

export default function Setup() {
  const router = useRouter();
  const { user, profile, loading, refreshAll } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hereTo, setHereTo] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SMS Verification state
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(
    null,
  );
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [codeSuccess, setCodeSuccess] = useState(false);

  const filled = useRef(false);

  useEffect(() => {
    if (!filled.current && user) {
      setName(profile?.name || user.name || "");
      setPhone(profile?.phone || "");
      setHereTo(profile?.hereTo || "");
      setPhotos(profile?.photos || []);
      setAge(!!profile);
      filled.current = true;
    }
  }, [profile, user]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const pickPhoto = async () => {
    setError(null);
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Photo access wasn't granted. You can continue without photos.",
        );
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.65,
      });
      if (!result.canceled && result.assets[0]) {
        const image = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 520 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        if (!image.base64 || image.base64.length > 400000)
          throw new Error(
            "That photo is too large. Please choose a smaller image.",
          );
        setPhotos((current) =>
          [...current, `data:image/jpeg;base64,${image.base64}`].slice(0, 4),
        );
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const basic = !profile;
  const normalizedPhone = phone.replace(/[\s()\-]/g, "");
  const isPhoneUnchanged = !!profile && normalizedPhone === profile.phone;

  const validBasics = () => {
    if (name.trim().length < 2) {
      setError("Add the name you want to share, at least two characters.");
      return false;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError(
        "Use your number with its country code, such as +61 412 345 678.",
      );
      return false;
    }
    if (!age) {
      setError(`You must confirm you are at least 18 to use ${BRAND.name}.`);
      return false;
    }
    return true;
  };

  const startPhoneVerification = async () => {
    setError(null);
    if (!validBasics()) return;
    setBusy(true);
    try {
      const res = await request<SendVerificationResponse>(
        "/phone-verification/send",
        "POST",
        { phone: normalizedPhone },
      );
      setDebugCode(res.debugCode ?? null);
      setVerifying(true);
      setCooldown(25);
      setCode("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await request<SendVerificationResponse>(
        "/phone-verification/send",
        "POST",
        { phone: normalizedPhone },
      );
      setDebugCode(res.debugCode ?? null);
      setCooldown(25);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submitVerificationCode = async (codeToSubmit?: string) => {
    const rawCode = (codeToSubmit ?? code).trim().replace(/\D/g, "");
    if (rawCode.length !== 6) {
      setError("Please enter the 6-digit code sent to your phone.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await request<VerifyResponse>(
        "/phone-verification/verify",
        "POST",
        { phone: normalizedPhone, code: rawCode },
      );
      setVerificationToken(res.verificationToken);
      setCodeSuccess(true);
      setVerifying(false);
      setStep(1); // proceed to photos
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleContinueFromStep0 = async () => {
    setError(null);
    if (!validBasics()) return;
    // If phone has not changed from existing profile or is already verified, proceed directly
    if (isPhoneUnchanged || verificationToken) {
      setStep(1);
    } else {
      // Must verify phone via SMS first
      await startPhoneVerification();
    }
  };

  const save = async (tokenOverride?: string) => {
    setError(null);
    if (basic && !validBasics()) return;
    setBusy(true);
    try {
      await request<{ profile: Profile }>("/profile", "PUT", {
        name: name.trim(),
        phone: normalizedPhone,
        intent: "Kiss",
        hereTo: hereTo.trim() || undefined,
        photos,
        ageConfirmed: true,
        verificationToken: tokenOverride ?? verificationToken ?? undefined,
      });
      await refreshAll();
      router.replace("/(tabs)");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!user && !loading)
    return (
      <Screen back title="Private setup">
        <Title small>Create your space first.</Title>
        <Body>
          Your number is a private identifier, not a login credential.
        </Body>
        <Button
          title="Back to start"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );

  // -------------------------------------------------------------
  // VIEW: SMS VERIFICATION STEP
  // -------------------------------------------------------------
  if (verifying) {
    return (
      <Screen
        back
        title="Verify number"
        footer={
          <>
            <ErrorNote message={error} />
            <Button
              title={busy ? "Verifying…" : "Verify code"}
              icon="checkmark-circle-outline"
              loading={busy}
              disabled={code.trim().length !== 6}
              onPress={() => submitVerificationCode()}
            />
            <Button
              title="Change phone number"
              variant="quiet"
              disabled={busy}
              onPress={() => {
                setVerifying(false);
                setError(null);
              }}
            />
          </>
        }
      >
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: C.accent,
              }}
            />
          ))}
        </View>
        <Label style={{ color: C.accent }}>
          STEP 2 OF 2 · PHONE VERIFICATION
        </Label>

        <View style={{ gap: 10 }}>
          <Title>Verify your{"\n"}number.</Title>
          <Body>
            We sent a 6-digit verification code via SMS to{" "}
            <Text style={{ color: C.text, fontWeight: "600" }}>
              {prettyPhone(phone)}
            </Text>
            . Enter it to confirm you own this number.
          </Body>
        </View>

        <Card
          style={{
            backgroundColor: C.surface,
            borderColor: C.border,
            gap: 16,
            paddingVertical: 22,
          }}
        >
          <Label>6-DIGIT SMS CODE</Label>
          <TextInput
            value={code}
            onChangeText={(text) => {
              const cleaned = text.replace(/\D/g, "").slice(0, 6);
              setCode(cleaned);
              setError(null);
              if (cleaned.length === 6) {
                void submitVerificationCode(cleaned);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="• • • • • •"
            placeholderTextColor={C.subtle}
            selectionColor={C.accent}
            autoFocus
            style={{
              backgroundColor: C.bg,
              borderWidth: 1,
              borderColor: code.length === 6 ? C.accent : C.border,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              color: C.text,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
              letterSpacing: 10,
            }}
          />

          {codeSuccess && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <Icon name="checkmark-circle" color={C.accent} size={18} />
              <Text
                style={{ color: C.accent, fontSize: 13, fontWeight: "600" }}
              >
                Number verified! Setting up your space…
              </Text>
            </View>
          )}

          {debugCode && (
            <Pressable
              onPress={() => {
                setCode(debugCode);
                void submitVerificationCode(debugCode);
              }}
              style={{
                backgroundColor: C.accentSoft,
                borderColor: C.accentBorder,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text
                  style={{ color: C.subtle, fontSize: 10, fontWeight: "700" }}
                >
                  TEST / DEV CODE
                </Text>
                <Text
                  style={{ color: C.accent, fontSize: 16, fontWeight: "700" }}
                >
                  {debugCode}
                </Text>
              </View>
              <Text
                style={{
                  color: C.accent,
                  fontSize: 12,
                  fontWeight: "600",
                  textDecorationLine: "underline",
                }}
              >
                Tap to auto-fill
              </Text>
            </Pressable>
          )}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 4,
            }}
          >
            <Text style={{ color: C.subtle, fontSize: 12 }}>
              Didn’t receive the code?
            </Text>
            <Pressable
              onPress={resendCode}
              disabled={cooldown > 0 || busy}
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: cooldown > 0 ? C.subtle : C.accent,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend SMS"}
              </Text>
            </Pressable>
          </View>
        </Card>

        <Note>
          Lowkey hookups uses phone verification to verify that members control
          their number. Your number is never shared publicly or visible in your
          profile.
        </Note>
      </Screen>
    );
  }

  // -------------------------------------------------------------
  // VIEW: MAIN SETUP (Step 0: Info / Step 1: Photos)
  // -------------------------------------------------------------
  return (
    <Screen
      back
      title={profile ? "Edit private setup" : "A private beginning"}
      footer={
        <>
          <ErrorNote message={error} />
          <Button
            title={
              step === 1
                ? "Save private setup"
                : basic
                  ? "Verify number & continue"
                  : isPhoneUnchanged
                    ? "Continue"
                    : "Verify number & continue"
            }
            icon={
              step === 1
                ? "checkmark"
                : basic
                  ? "shield-checkmark-outline"
                  : isPhoneUnchanged
                    ? "arrow-forward"
                    : "shield-checkmark-outline"
            }
            loading={busy || loading}
            onPress={step === 1 ? () => save() : handleContinueFromStep0}
          />
          {step > 0 && (
            <Button
              title="Previous step"
              variant="quiet"
              disabled={busy}
              onPress={() => setStep((current) => current - 1)}
            />
          )}
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: i <= step ? C.accent : C.border,
              }}
            />
          ))}
        </View>
        <Label>
          {basic
            ? `STEP ${step + 1} OF 2 · ${step === 0 ? "BASIC DETAILS" : "PRIVATE PHOTOS"}`
            : `STEP ${step + 1} OF 2 · NEVER A PUBLIC PROFILE`}
        </Label>
      </View>

      {step === 0 ? (
        <>
          <Title>Just a name.{"\n"}Just your number.</Title>
          <Body>
            These stay private until you choose to share your identity in a
            specific conversation.
          </Body>
          <Field
            label="YOUR DISPLAY NAME"
            placeholder="The name they know you by"
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoCapitalize="words"
          />

          <Field
            label="I'M HERE TO: (OPTIONAL)"
            placeholder="e.g. Explore chemistry, hook up, see what happens"
            value={hereTo}
            onChangeText={setHereTo}
            maxLength={140}
            helper="Optional. Let them know what you’re looking for."
          />

          <View style={{ gap: 8 }}>
            <Field
              label="YOUR PHONE NUMBER"
              placeholder="+61 412 345 678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setVerificationToken(null);
              }}
              maxLength={24}
              helper="Include your country code. An SMS verification code will be sent to confirm you own this number."
            />

            {isPhoneUnchanged && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 4,
                }}
              >
                <Icon name="checkmark-circle" color={C.accent} size={15} />
                <Text
                  style={{ color: C.accent, fontSize: 12, fontWeight: "600" }}
                >
                  Verified number
                </Text>
              </View>
            )}

            {profile && !isPhoneUnchanged && normalizedPhone.length > 5 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 4,
                }}
              >
                <Icon name="alert-circle-outline" color={C.muted} size={15} />
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  New number requires SMS verification
                </Text>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: age }}
            onPress={() => setAge(!age)}
            style={{
              flexDirection: "row",
              gap: 13,
              alignItems: "center",
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 25,
                height: 25,
                borderRadius: 7,
                borderWidth: 1,
                borderColor: age ? C.accent : C.subtle,
                backgroundColor: age ? C.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {age && <Icon name="checkmark" size={17} color={C.bg} />}
            </View>
            <Body style={{ color: C.text, fontSize: 14 }}>
              I am at least 18 years old.
            </Body>
          </Pressable>

          <Note>
            {BRAND.name} verifies your number via SMS so only you can send or
            receive interests for your phone number. Your number is never
            shared publicly.
          </Note>
        </>
      ) : (
        <>
          <Title>A little more{"\n"}of you.</Title>
          <Body>
            Up to four photos, kept out of public view. They appear only with a
            named send or a confirmed reveal.
          </Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {photos.map((uri, i) => (
              <View key={i} style={{ width: "46%", aspectRatio: 0.8 }}>
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%", borderRadius: 17 }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  onPress={() =>
                    setPhotos(photos.filter((_, index) => index !== i))
                  }
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 29,
                    height: 29,
                    borderRadius: 15,
                    backgroundColor: C.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="close" size={17} />
                </Pressable>
              </View>
            ))}
            {photos.length < 4 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add private photo"
                disabled={busy}
                onPress={() => {
                  void pickPhoto();
                }}
                style={{
                  width: "46%",
                  aspectRatio: 0.8,
                  borderRadius: 17,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: C.border,
                  backgroundColor: C.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 13,
                }}
              >
                <Icon name="add" color={C.accent} size={28} />
                <Body style={{ fontSize: 12 }}>Add a photo</Body>
              </Pressable>
            )}
          </View>
          <Body style={{ fontSize: 12 }}>
            Photos are optional. Nothing is uploaded until you save.
          </Body>
          <Note warning>
            Private beta: server-managed encryption, not end-to-end encryption.
            The service can decrypt stored content.
          </Note>
        </>
      )}
    </Screen>
  );
}
