import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Body,
  Button,
  C,
  Card,
  Empty,
  ErrorNote,
  Field,
  Icon,
  Label,
  Note,
  Screen,
  Title,
} from "@/components/get-even/ui";
import { errorText, request, useApp, useLive } from "@/lib/get-even/provider";
import type { CandidateResponse } from "@/shared/get-even";

function timeRemaining(lockedUntil: string | null, now: number) {
  if (!lockedUntil) return null;
  const ms = new Date(lockedUntil).getTime() - now;
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.ceil((ms % 3_600_000) / 60_000);
  return hours > 0
    ? `Try again in about ${hours}h ${minutes}m.`
    : `Try again in about ${minutes}m.`;
}

function GuessProgress({ remaining }: { remaining: number }) {
  return (
    <View accessibilityLabel={`${remaining} guesses remaining`} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[0, 1].map((slot) => (
          <View
            key={slot}
            style={{
              flex: 1,
              height: 7,
              borderRadius: 4,
              backgroundColor: slot < remaining ? C.accent : C.border,
            }}
          />
        ))}
      </View>
      <Label style={{ color: remaining ? C.accent : C.muted }}>
        {remaining} OF 2 GUESSES REMAINING
      </Label>
    </View>
  );
}

export default function Candidate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, refreshAll } = useApp();
  const live = useLive<CandidateResponse>(
    `candidate-${id}`,
    `/candidates/${id}`,
    !!profile,
  );
  const candidate = live.data?.candidate;
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function submitGuess() {
    const value = phone.trim().replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(value)) {
      setError("Enter the person’s number with its country code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await request<CandidateResponse>(
        `/candidates/${id}/guess`,
        "POST",
        { phone: value },
      );
      setPhone("");
      await live.refetch();
      await refreshAll();
      if (result.candidate.threadId) {
        router.replace({
          pathname: "/thread/[id]",
          params: { id: result.candidate.threadId },
        });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (live.isPending) {
    return (
      <Screen back title="Anonymous candidate">
        <ActivityIndicator color={C.accent} />
      </Screen>
    );
  }

  if (!candidate) {
    return (
      <Screen back title="Anonymous candidate">
        <Empty
          icon="eye-off-outline"
          title="Candidate unavailable."
          description="It may have expired, been blocked, or already closed."
        />
        <Button
          title="Back to inbox"
          onPress={() => router.replace("/(tabs)/inbox")}
        />
      </Screen>
    );
  }

  const lock = timeRemaining(candidate.lockedUntil, now);
  const unlocked = Boolean(candidate.threadId);
  const locked = Boolean(lock) && !unlocked;

  return (
    <Screen back title="Anonymous candidate">
      <View style={{ gap: 12, paddingTop: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: C.accentSoft,
              borderWidth: 1,
              borderColor: C.accentBorder,
            }}
          >
            <Icon
              name={unlocked ? "lock-open-outline" : "eye-off-outline"}
              color={C.accent}
              size={24}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Label>MUTUAL PROBE</Label>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: "600" }}>
              Two guesses. One possibility.
            </Text>
          </View>
        </View>
      </View>

      <Card style={{ gap: 18, marginTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Label>YOUR PRIVATE CHANCE</Label>
          <Label style={{ color: locked ? C.muted : C.accent }}>
            {unlocked ? "UNLOCKED" : locked ? "PAUSED" : "OPEN"}
          </Label>
        </View>
        <Body>
          Both of you sent an anonymous probe. Guess the person’s verified number
          without exposing who you are.
        </Body>
        {!unlocked && <GuessProgress remaining={candidate.guessesRemaining} />}
      </Card>

      {candidate.otherGuessedCorrectly && !unlocked && (
        <Note>
          <Text style={{ fontWeight: "700", color: C.accentText }}>GREEN LIGHT. </Text>
          They recognized you and are waiting for your correct guess.
        </Note>
      )}

      {unlocked ? (
        <Card style={{ gap: 14, borderColor: C.accentBorder }}>
          <Label style={{ color: C.accent }}>CHAT UNLOCKED</Label>
          <Title small>Both of you guessed correctly.</Title>
          <Body>Names are now revealed in the private conversation.</Body>
          <Button
            title="Open revealed chat"
            icon="arrow-forward"
            onPress={() =>
              router.replace({
                pathname: "/thread/[id]",
                params: { id: candidate.threadId as string },
              })
            }
          />
        </Card>
      ) : locked ? (
        <Card style={{ gap: 14, borderColor: C.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="lock-closed-outline" color={C.muted} />
            <Label style={{ color: C.muted }}>TWO INCORRECT GUESSES</Label>
          </View>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "600" }}>
            This candidate is paused for 24 hours.
          </Text>
          <Body>{lock}</Body>
          <Button title="Guessing paused" variant="secondary" disabled onPress={() => undefined} />
        </Card>
      ) : (
        <View style={{ gap: 14 }}>
          <Field
            label="WHO DO YOU THINK IT IS?"
            placeholder="+61 412 345 678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setError(null);
            }}
            editable={!busy}
            helper="Use the number you believe belongs to the person."
          />
          <Button
            title="Make anonymous guess"
            icon="arrow-forward"
            loading={busy}
            onPress={() => void submitGuess()}
          />
        </View>
      )}

      <ErrorNote message={error} />
      <Body style={{ textAlign: "center", color: C.subtle, fontSize: 11 }}>
        Chat unlocks only after both people guess correctly. Nothing is posted
        publicly, and no online status is shown.
      </Body>
    </Screen>
  );
}
