import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, Icon } from "@/components/get-even/ui";
import { useApp } from "@/lib/get-even/provider";
import { Platform } from "react-native";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const bottom = Platform.OS === "web" ? 18 : Math.max(insets.bottom, 12);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.subtle,
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.6, marginTop: 5 },
        tabBarStyle: {
          display: profile ? "flex" : "none",
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          paddingTop: 12,
          paddingBottom: bottom,
          height: 64 + bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Icon name="square-outline" color={color} size={21} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => (
            <Icon name="mail-outline" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="private"
        options={{
          title: "Private",
          tabBarIcon: ({ color }) => (
            <Icon name="person-circle-outline" color={color} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}
