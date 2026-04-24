import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import * as Clipboard from "expo-clipboard";
import type { SkillListItem } from "@/types/skill";
import { useIsFavorite } from "@/lib/favorites";
import { incrementInstallCount } from "@/lib/skills";

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}个月前`;
}

function formatAuthor(author: string): string {
  if (author === "anthropics") return "Anthropic";
  if (author === "community") return "社区";
  return author;
}

function formatStars(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export function SkillCard({
  skill,
  showInstall = false,
}: {
  skill: SkillListItem;
  showInstall?: boolean;
}) {
  const [favorited, toggle] = useIsFavorite(skill.id);
  const [copied, setCopied] = useState(false);

  const installCommand = `claude skill install ${skill.slug}`;
  const chips = skill.use_cases.length > 0
    ? skill.use_cases.slice(0, 3)
    : skill.tags.filter((t) => !["claude", "codex", "cursor"].includes(t)).slice(0, 3);

  const handleCopy = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    await Clipboard.setStringAsync(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    incrementInstallCount(skill.id);
  };

  return (
    <Link href={`/skill/${skill.id}`} asChild>
      <Pressable className="mb-3 rounded-2xl border border-border-subtle bg-bg-card p-4 active:opacity-70">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-shrink text-base font-semibold text-text">
                {skill.name}
              </Text>
              {skill.featured && (
                <View className="rounded-full bg-brand/20 px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-brand">官方</Text>
                </View>
              )}
            </View>
            <View className="mt-0.5 flex-row items-center gap-1">
              {skill.github_stars != null && skill.github_stars > 0 && (
                <>
                  <Ionicons name="star" size={11} color="#F5B400" />
                  <Text className="text-xs text-text-subtle">
                    {formatStars(skill.github_stars)}
                  </Text>
                  <Text className="text-xs text-text-subtle">·</Text>
                </>
              )}
              <Text className="text-xs text-text-subtle">
                {formatAuthor(skill.author)} · {timeAgo(skill.published_at ?? skill.created_at)}
              </Text>
            </View>
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
          {skill.description_zh ?? skill.description}
        </Text>

        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {chips.map((chip) => (
            <View
              key={chip}
              className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5"
            >
              <Text className="text-[11px] text-brand">{chip}</Text>
            </View>
          ))}
        </View>

        {showInstall && (
          <Pressable
            onPress={handleCopy}
            className="mt-3 flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated px-3 py-2 active:opacity-70"
          >
            <Text className="flex-1 pr-2 font-mono text-xs text-text-muted" numberOfLines={1}>
              {installCommand}
            </Text>
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={15}
              color={copied ? "#8AE6A6" : "#D97757"}
            />
          </Pressable>
        )}
      </Pressable>
    </Link>
  );
}
