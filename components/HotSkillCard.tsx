import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { SkillListItem } from "@/types/skill";
import { categoryName, categoryIcon } from "@/lib/categories";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  official: { bg: "#3D2E1E", text: "#F5A07A", icon: "#D97757" },
  code:     { bg: "#1A2535", text: "#7EB8F7", icon: "#5B9BD5" },
  devops:   { bg: "#1E2A1E", text: "#8AE6A6", icon: "#5EC97A" },
  data:     { bg: "#2A1E35", text: "#C4A8F0", icon: "#9B6FD4" },
  design:   { bg: "#35201E", text: "#F0A8C4", icon: "#D46F9B" },
  docs:     { bg: "#1E2A2A", text: "#7EE0E0", icon: "#3DBDBD" },
  office:   { bg: "#2A2A1E", text: "#E0D87E", icon: "#BDBD3D" },
  research: { bg: "#1E2535", text: "#7EB8F7", icon: "#5B9BD5" },
  misc:     { bg: "#252525", text: "#A0A0A8", icon: "#6B6B78" },
};

function formatStars(n: number | null): string | null {
  if (n === null || n === undefined) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function HotSkillCard({ skill, rank }: { skill: SkillListItem; rank: number }) {
  const colors = CATEGORY_COLORS[skill.category] ?? CATEGORY_COLORS.misc;
  const stars = formatStars(skill.github_stars);
  const desc = skill.description_zh ?? skill.description;

  return (
    <Link href={`/skill/${skill.id}`} asChild>
      <Pressable
        style={{ width: 220 }}
        className="mr-3 rounded-2xl border border-border-subtle p-4 active:opacity-70"
        // inline style so backgroundColor supports dynamic value
        // (NativeWind arbitrary values require extra config)
      >
        <View
          style={{ backgroundColor: colors.bg }}
          className="absolute inset-0 rounded-2xl"
        />

        {/* Rank badge */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="rounded-full bg-white/10 px-2 py-0.5">
            <Text className="text-[11px] font-bold text-white/60">#{rank}</Text>
          </View>
          {stars && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={11} color="#F5C842" />
              <Text className="text-[11px] text-white/60">{stars}</Text>
            </View>
          )}
        </View>

        {/* Category icon */}
        <View
          className="mb-3 h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${colors.icon}25` }}
        >
          <Ionicons name={categoryIcon(skill.category) as any} size={20} color={colors.icon} />
        </View>

        {/* Name */}
        <Text className="text-sm font-bold text-white" numberOfLines={1}>
          {skill.name}
        </Text>

        {/* Category label */}
        <Text style={{ color: colors.text }} className="mt-0.5 text-[11px] font-medium">
          {categoryName(skill.category)}
        </Text>

        {/* Description */}
        <Text className="mt-2 text-xs leading-4 text-white/50" numberOfLines={3}>
          {desc}
        </Text>
      </Pressable>
    </Link>
  );
}
