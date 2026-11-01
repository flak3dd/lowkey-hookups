import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
  Screen,
  Title,
} from "@/components/get-even/ui";
import {
  errorText,
  relativeDate,
  request,
  useApp,
  useLive,
} from "@/lib/get-even/provider";
import { BlockItem } from "@/shared/get-even";

export default function Blocked() {
  const { profile, refreshAll } = useApp();
  const list = useLive<{ items: BlockItem[] }>("blocks", "/blocks", !!profile);
  const [selected, setSelected] = useState<BlockItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unblock = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/blocks/${selected.id}`, "DELETE");
      await refreshAll();
      setSelected(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen back title="Your boundaries">
      <Label>NO EXPLANATION NEEDED</Label>
      <Title small>Doors you’ve closed.</Title>
      <Body>
        Blocking never reveals an anonymous sender’s identity. It works against
        their account in either identity mode.
      </Body>
      {list.isPending ? (
        <ActivityIndicator color={C.accent} />
      ) : list.error ? (
        <>
          <ErrorNote message="Your block list couldn’t load." />
          <Button
            title="Retry"
            onPress={() => {
              void list.refetch();
            }}
          />
        </>
      ) : list.data?.items.length ? (
        list.data.items.map((item) => (
          <Card key={item.id}>
            <View
              style={{ flexDirection: "row", gap: 15, alignItems: "center" }}
            >
              <Icon name="hand-left-outline" color={C.accent} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: C.text, fontSize: 15 }}>
                  {item.label}
                </Text>
                <Label>BLOCKED {relativeDate(item.createdAt)}</Label>
              </View>
            </View>
            <Button
              title="Unblock"
              variant="secondary"
              onPress={() => {
                setError(null);
                setSelected(item);
              }}
            />
          </Card>
        ))
      ) : (
        <Empty
          icon="hand-left-outline"
          title="No blocked accounts."
          description="If an interest doesn’t feel right, block it from your inbox or conversation. Your decision stays private."
        />
      )}
      <Confirm
        visible={!!selected}
        title="Open this door again?"
        description="Future interests or messages from this account may reach you again. This does not restore deleted content or notify them."
        confirm="Unblock account"
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => {
          void unblock();
        }}
      >
        <ErrorNote message={error} />
      </Confirm>
    </Screen>
  );
}
