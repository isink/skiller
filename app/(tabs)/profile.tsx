import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { isSupabaseConfigured } from "@/lib/supabase";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View className="mt-6">
      <Text className="mb-2 px-1 text-xs uppercase tracking-widest text-text-subtle">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-card">
        {rows.map((row, i) => (
          <Pressable
            key={row.title}
            onPress={row.onPress}
            className={`flex-row items-center px-4 py-3.5 active:bg-bg-elevated ${
              i > 0 ? "border-t border-border-subtle" : ""
            }`}
          >
            <Ionicons name={row.icon} size={20} color="#D97757" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-text">{row.title}</Text>
              {row.subtitle ? (
                <Text className="mt-0.5 text-xs text-text-subtle">
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            {row.onPress ? (
              <Ionicons name="chevron-forward" size={16} color="#6B6B78" />
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="items-center py-6">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand/20">
            <Ionicons name="sparkles" size={28} color="#D97757" />
          </View>
          <Text className="mt-3 text-xl font-bold text-text">Iskill</Text>
          <Text className="mt-1 text-xs text-text-subtle">
            发现并安装 Claude AI 技能
          </Text>
        </View>

        <Section
          title="数据"
          rows={[
            {
              icon: isSupabaseConfigured ? "cloud-done" : "cloud-offline",
              title: isSupabaseConfigured ? "已连接 Supabase" : "离线示例数据",
              subtitle: isSupabaseConfigured
                ? "技能数据实时同步自 Supabase"
                : "设置 EXPO_PUBLIC_SUPABASE_URL 以启用在线模式",
            },
          ]}
        />

        <Section
          title="社区"
          rows={[
            {
              icon: "logo-github",
              title: "Anthropic 官方技能库",
              subtitle: "github.com/anthropics/skills",
              onPress: () =>
                Linking.openURL("https://github.com/anthropics/skills"),
            },
            {
              icon: "book",
              title: "Claude Skills 文档",
              onPress: () =>
                Linking.openURL(
                  "https://docs.anthropic.com/claude/docs/skills",
                ),
            },
          ]}
        />

        <Section
          title="关于"
          rows={[
            {
              icon: "information-circle",
              title: "版本",
              subtitle: version,
            },
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
