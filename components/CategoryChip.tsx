import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  label: string;
  icon?: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
};

export function CategoryChip({ label, icon, count, active, onPress }: Props) {
  const iconColor = active ? "#F5A07A" : "#6B6B78";
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 flex-row items-center rounded-full border px-3.5 py-1.5 ${
        active
          ? "border-brand bg-brand/20"
          : "border-border-subtle bg-bg-elevated"
      }`}
    >
      {icon ? (
        <Ionicons
          name={icon as any}
          size={12}
          color={iconColor}
          style={{ marginRight: 4 }}
        />
      ) : null}
      <Text
        className={`text-xs font-medium ${
          active ? "text-brand-light" : "text-text-muted"
        }`}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View
          className={`ml-1.5 rounded-full px-1.5 py-0.5 ${
            active ? "bg-brand/30" : "bg-bg-card"
          }`}
        >
          <Text
            className={`text-[10px] font-semibold ${
              active ? "text-brand-light" : "text-text-subtle"
            }`}
          >
            {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
