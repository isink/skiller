import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = "sparkles-outline", title, subtitle }: Props) {
  return (
    <View className="items-center justify-center px-8 py-16">
      <Ionicons name={icon} size={42} color="#3A3A48" />
      <Text className="mt-3 text-base font-semibold text-text-muted">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-center text-sm text-text-subtle">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
