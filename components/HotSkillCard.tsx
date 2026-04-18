import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { SkillListItem } from "@/types/skill";
import { categoryName, categoryIcon } from "@/lib/categories";

const CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
  official: { bg: "#2A1E14", accent: "#D97757" },
  code:     { bg: "#111C2A", accent: "#5B9BD5" },
  devops:   { bg: "#141F14", accent: "#5EC97A" },
  data:     { bg: "#1E1428", accent: "#9B6FD4" },
  design:   { bg: "#28141E", accent: "#D46F9B" },
  docs:     { bg: "#141F1F", accent: "#3DBDBD" },
  office:   { bg: "#1F1F14", accent: "#BDBD3D" },
  research: { bg: "#141C28", accent: "#5B9BD5" },
  misc:     { bg: "#1A1A1A", accent: "#6B6B78" },
};

function formatStars(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function HotSkillCard({ skill, rank }: { skill: SkillListItem; rank: number }) {
  const { bg, accent } = CATEGORY_COLORS[skill.category] ?? CATEGORY_COLORS.misc;
  const stars = formatStars(skill.github_stars);

  return (
    <Link href={`/skill/${skill.id}`} asChild>
      <Pressable
        style={{ width: 160, backgroundColor: bg }}
        className="mr-2.5 rounded-2xl border border-white/8 p-3.5 active:opacity-70"
      >
        {/* Top row: rank + stars */}
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[10px] font-bold" style={{ color: `${accent}99` }}>
            #{rank}
          </Text>
          {stars && (
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="star" size={9} color="#F5C842" />
              <Text className="text-[10px] text-white/40">{stars}</Text>
            </View>
          )}
        </View>

        {/* Icon */}
        <View
          className="mb-2.5 h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}22` }}
        >
          <Ionicons name={categoryIcon(skill.category) as any} size={16} color={accent} />
        </View>

        {/* Name */}
        <Text className="text-[13px] font-semibold text-white/90" numberOfLines={1}>
          {skill.name}
        </Text>

        {/* Category */}
        <Text className="mt-0.5 text-[10px] font-medium" style={{ color: accent }} numberOfLines={1}>
          {categoryName(skill.category)}
        </Text>

        {/* Description */}
        <Text className="mt-1.5 text-[11px] leading-[15px] text-white/40" numberOfLines={3}>
          {skill.description_zh ?? skill.description}
        </Text>
      </Pressable>
    </Link>
  );
}
