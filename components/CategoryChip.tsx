import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function CategoryChip({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-3.5 py-1.5 ${
        active
          ? "border-brand bg-brand/20"
          : "border-border-subtle bg-bg-elevated"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-brand-light" : "text-text-muted"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
