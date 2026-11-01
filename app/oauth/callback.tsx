import { ThemedView } from "@/components/themed-view";
import { startOAuthLogin } from "@/constants/oauth";
import { BRAND } from "@/constants/branding";
import { C } from "@/components/get-even/ui";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type VerifiedUserResponse = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
  }>();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const completeCallback = async () => {
      const code = firstParam(params.code);
      const state = firstParam(params.state);
      const providerError = firstParam(params.error);

      if (providerError || !code || !state) {
        if (active) {
          setStatus("error");
          setErrorMessage("Sign-in was not completed. Please try again.");
        }
        return;
      }

      const verifier = await Auth.consumeOAuthVerifier();
      if (!verifier) {
        if (active) {
          setStatus("error");
          setErrorMessage(
            "This sign-in request has expired. Please start again.",
          );
        }
        return;
      }

      try {
        const result = await Api.exchangeOAuthCode(code, state, verifier);
        await Auth.setSessionToken(result.sessionToken);

        if (result.user && typeof result.user === "object") {
          const user = result.user as Partial<VerifiedUserResponse>;
          if (typeof user.openId === "string") {
            await Auth.setUserInfo({
              id: typeof user.id === "number" ? user.id : 0,
              openId: user.openId,
              name: typeof user.name === "string" ? user.name : null,
              email: typeof user.email === "string" ? user.email : null,
              loginMethod:
                typeof user.loginMethod === "string" ? user.loginMethod : null,
              lastSignedIn: new Date(
                typeof user.lastSignedIn === "string"
                  ? user.lastSignedIn
                  : Date.now(),
              ),
            });
          }
        }

        if (!active) return;
        setStatus("success");
        setTimeout(() => {
          if (active) router.replace("/(tabs)");
        }, 600);
      } catch {
        if (active) {
          setStatus("error");
          setErrorMessage(
            "Secure sign-in could not be completed. Please try again.",
          );
        }
      }
    };

    void completeCallback();
    return () => {
      active = false;
    };
  }, [params.code, params.error, params.state, router]);

  const retry = async () => {
    setStatus("processing");
    setErrorMessage(null);
    try {
      await startOAuthLogin();
    } catch {
      setStatus("error");
      setErrorMessage(
        "Unable to start secure sign-in. Check your connection and try again.",
      );
    }
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: C.bg }}
      edges={["top", "bottom", "left", "right"]}
    >
      <ThemedView
        className="flex-1 items-center justify-center gap-4 p-6"
        style={{ backgroundColor: C.bg }}
      >
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" color={C.accent} />
            <Text
              className="mt-4 text-center text-base leading-6"
              style={{ color: C.text }}
            >
              Completing secure sign-in…
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: C.text }}
            >
              You’re signed in
            </Text>
            <Text
              className="text-center text-base leading-6"
              style={{ color: C.muted }}
            >
              Opening {BRAND.name}…
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: C.text }}
            >
              Sign-in unavailable
            </Text>
            <Text
              className="text-center text-base leading-6"
              style={{ color: C.muted }}
            >
              {errorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-3 rounded-full px-6 py-3"
              style={{ backgroundColor: C.accent }}
              onPress={() => void retry()}
            >
              <Text className="font-semibold" style={{ color: C.onAccent }}>
                Try again
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-full border px-6 py-3"
              style={{ borderColor: C.border }}
              onPress={() => router.replace("/")}
            >
              <Text className="font-semibold" style={{ color: C.text }}>
                Back
              </Text>
            </Pressable>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
