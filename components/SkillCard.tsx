import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { SkillListItem } from "@/types/skill";
import { useIsFavorite } from "@/lib/favorites";

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function SkillCard({ skill }: { skill: SkillListItem }) {
  const [favorited, toggle] = useIsFavorite(skill.id);

  return (
    <Link href={`/skill/${skill.id}`} asChild>
      <Pressable className="mb-3 rounded-2xl border border-border-subtle bg-bg-card p-4 active:opacity-70">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-semibold text-text">
              {skill.name}
            </Text>
            <Text className="mt-0.5 text-xs text-text-subtle">
              by {skill.author}
            </Text>
          </View>
          <Pressable
            hitSlop={12}
            onPress={(e) => {
              e.stopPropagation();
              toggle();
            }}
          >
            <Ionicons
              name={favorited ? "heart" : "heart-outline"}
              size={22}
              color={favorited ? "#D97757" : "#6B6B78"}
            />
          </Pressable>
        </View>

        <Text
          className="mt-2 text-sm leading-5 text-text-muted"
          numberOfLines={2}
        >
          {skill.description}
        </Text>

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                className="rounded-full bg-bg-elevated px-2 py-0.5"
              >
                <Text className="text-[11px] text-text-muted">#{tag}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row items-center">
            <Ionicons name="download-outline" size={13} color="#6B6B78" />
            <Text className="ml-1 text-[11px] text-text-subtle">
              {formatCount(skill.install_count)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
