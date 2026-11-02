import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Body, Button, C, Empty, ErrorNote, Field, Label, Note, Screen, Title } from "@/components/get-even/ui";
import { errorText, request, useApp, useLive } from "@/lib/get-even/provider";
import type { CandidateResponse } from "@/shared/get-even";

function remaining(lockedUntil: string | null) {
  if (!lockedUntil) return null;
  const ms = new Date(lockedUntil).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / 3600000);
  return `Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
}

export default function Candidate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, refreshAll } = useApp();
  const live = useLive<CandidateResponse>(`candidate-${id}`, `/candidates/${id}`, !!profile);
  const candidate = live.data?.candidate;
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = remaining(candidate?.lockedUntil ?? null);

  async function submitGuess() {
    const value = phone.trim().replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(value)) {
      setError("Enter the person’s number with its country code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await request<CandidateResponse>(`/candidates/${id}/guess`, "POST", { phone: value });
      setPhone("");
      await live.refetch();
      await refreshAll();
      if (result.candidate.threadId) router.replace({ pathname: "/thread/[id]", params: { id: result.candidate.threadId } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (live.isPending) return <Screen back title="Anonymous candidate"><ActivityIndicator color={C.accent} /></Screen>;
  if (!candidate) return <Screen back title="Anonymous candidate"><Empty icon="eye-off-outline" title="Candidate unavailable." description="It may have expired, been blocked, or already closed." /><Button title="Back to inbox" onPress={() => router.replace("/(tabs)/inbox")} /></Screen>;

  return <Screen back title="Anonymous candidate">
    <Label>MUTUAL PROBE</Label>
    <Title small>Two guesses. One possibility.</Title>
    <Body>Both of you sent an anonymous probe. You have {candidate.guessesRemaining} guess{candidate.guessesRemaining === 1 ? "" : "es"} remaining.</Body>
    {candidate.otherGuessedCorrectly && <Note>Green light: they recognized you and are waiting for your correct guess.</Note>}
    {candidate.threadId ? <Button title="Open revealed chat" onPress={() => router.replace({ pathname: "/thread/[id]", params: { id: candidate.threadId as string } })} /> : lock ? <Note warning>Two incorrect guesses lock this candidate for 24 hours. {lock}</Note> : <View style={{ gap: 12 }}>
      <Field label="WHO DO YOU THINK IT IS?" placeholder="+61 412 345 678" keyboardType="phone-pad" value={phone} onChangeText={setPhone} editable={!busy && candidate.guessesRemaining > 0} />
      <Button title="Make anonymous guess" loading={busy} onPress={() => void submitGuess()} disabled={candidate.guessesRemaining === 0} />
    </View>}
    <ErrorNote message={error} />
    <Text style={{ color: C.subtle, fontSize: 12, lineHeight: 18, textAlign: "center" }}>Chat unlocks only after both people guess correctly. Once unlocked, both names are shown in the chat.</Text>
  </Screen>;
}
