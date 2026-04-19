import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SearchBar } from "@/components/SearchBar";
import { SkillCard } from "@/components/SkillCard";
import { HotSkillCard } from "@/components/HotSkillCard";
import { SkillListSkeleton } from "@/components/SkillCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fetchHotSkills, fetchHomeStats, searchSkills, type HomeStats } from "@/lib/skills";
import type { SkillListItem } from "@/types/skill";

function timeAgoShort(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function StatCard({ icon, value, label, accent }: {
  icon: string;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-border-subtle bg-bg-card px-4 py-3">
      <View className="flex-row items-center gap-1.5 mb-1">
        <Ionicons name={icon as any} size={13} color={accent ? "#8AE6A6" : "#D97757"} />
        <Text className={`text-[11px] font-medium ${accent ? "text-green-400" : "text-text-subtle"}`}>
          {label}
        </Text>
      </View>
      <Text className="text-xl font-bold text-text">{value}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [hotSkills, setHotSkills] = useState<SkillListItem[]>([]);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [results, setResults] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchHotSkills(20),
      fetchHomeStats(),
    ]).then(([hot, s]) => {
      setHotSkills(hot);
      setStats(s);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => {
      let cancelled = false;
      searchSkills(query).then((r) => { if (!cancelled) setResults(r); });
      return () => { cancelled = true; };
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const showingSearch = query.trim().length > 0;

  const banner = useMemo(() => (
    <View className="mb-5">
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-text">Skiller</Text>
          <Text className="text-xs text-text-subtle mt-0.5">发现优质 Claude 技能</Text>
        </View>
        {stats?.lastSyncAt && (
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <Text className="text-[11px] text-text-subtle">
              {timeAgoShort(stats.lastSyncAt)}更新
            </Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View className="flex-row gap-3 mb-4">
        <StatCard
          icon="apps-outline"
          value={stats ? stats.total.toLocaleString() : "—"}
          label="技能总数"
        />
        <StatCard
          icon="flash-outline"
          value={stats ? (stats.newToday > 0 ? `+${stats.newToday}` : "0") : "—"}
          label="今日新增"
          accent={!!stats && stats.newToday > 0}
        />
      </View>

      {/* Search */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="搜索技能、标签、作者"
      />
    </View>
  ), [stats, query]);

  const hotSection = useMemo(() => (
    <View className="mb-2">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="flame-outline" size={16} color="#D97757" />
          <Text className="text-base font-bold text-text">热门技能</Text>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/explore")}
          className="flex-row items-center gap-0.5 active:opacity-60"
        >
          <Text className="text-xs text-text-subtle">更多</Text>
          <Ionicons name="chevron-forward" size={13} color="#6B6B78" />
        </Pressable>
      </View>
      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[...Array(4)].map((_, i) => (
            <View key={i} className="mr-2.5 h-44 w-[160px] rounded-2xl bg-bg-elevated" />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {hotSkills.map((skill, i) => (
            <HotSkillCard key={skill.id} skill={skill} rank={i + 1} />
          ))}
        </ScrollView>
      )}
    </View>
  ), [hotSkills, loading]);

if (showingSearch) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
        <FlatList
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <View className="mb-4">
              {banner}
              <Text className="text-sm text-text-muted">
                找到 {results.length} 个关于 "{query}" 的结果
              </Text>
            </View>
          }
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SkillCard skill={item} />}
          ListEmptyComponent={
            <EmptyState icon="search-outline" title="没有匹配结果" subtitle="试试其他关键词" />
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {banner}
        {hotSection}
      </ScrollView>
    </SafeAreaView>
  );
}
