import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SkillCard } from "./SkillCard";
import type { SkillListItem } from "@/types/skill";
import type { RepoGroupSummary } from "@/lib/skills";
import { fetchSkillsInRepo } from "@/lib/skills";

function formatStars(n: number | null): string {
  if (n == null || n <= 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

function formatAuthor(author: string): string {
  if (author === "anthropics") return "Anthropic";
  if (author === "community") return "社区";
  return author;
}

export function RepoGroupCard({ group }: { group: RepoGroupSummary }) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<SkillListItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !skills && !loading) {
      setLoading(true);
      try {
        const data = await fetchSkillsInRepo(group.repo);
        setSkills(data);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View className="mb-3">
      <Pressable
        onPress={toggle}
        className="flex-row items-center justify-between rounded-2xl border border-border-subtle bg-bg-card px-4 py-3 active:opacity-70"
      >
        <View className="flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="logo-github" size={14} color="#6B6B78" />
            <Text className="flex-shrink text-sm font-semibold text-text" numberOfLines={1}>
              {group.repo}
            </Text>
          </View>
          <View className="mt-0.5 flex-row items-center gap-1">
            {group.stars != null && group.stars > 0 && (
              <>
                <Ionicons name="star" size={11} color="#F5B400" />
                <Text className="text-xs text-text-subtle">{formatStars(group.stars)}</Text>
                <Text className="text-xs text-text-subtle">·</Text>
              </>
            )}
            <Text className="text-xs text-text-subtle">
              {formatAuthor(group.author)} · {group.skill_count} 个 skill
            </Text>
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#6B6B78" />
      </Pressable>

      {open && (
        <View className="mt-2 pl-3">
          {loading && (
            <View className="py-4">
              <ActivityIndicator color="#D97757" />
            </View>
          )}
          {skills?.map((s) => <SkillCard key={s.id} skill={s} />)}
        </View>
      )}
    </View>
  );
}
