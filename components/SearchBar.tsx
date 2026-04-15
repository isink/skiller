import { TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder }: Props) {
  return (
    <View className="flex-row items-center rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2.5">
      <Ionicons name="search" size={18} color="#6B6B78" />
      <TextInput
        className="ml-2 flex-1 text-base text-text"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "搜索技能"}
        placeholderTextColor="#6B6B78"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );
}
