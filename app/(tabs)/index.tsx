import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SearchBar } from "@/components/SearchBar";
import { SkillCard } from "@/components/SkillCard";
import { HotSkillCard } from "@/components/HotSkillCard";
import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import {
  fetchHotSkills,
  fetchHomeStats,
  fetchNewSkills,
  fetchCategories,
  fetchCategoryCounts,
  searchSkills,
  type HomeStats,
} from "@/lib/skills";
import { categoryName, categoryIcon } from "@/lib/categories";
import type { Category, SkillListItem } from "@/types/skill";

function timeAgoShort(dateStr: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function StatCard({ icon, value, label, accent, fullWidth }: {
  icon: string;
  value: string;
  label: string;
  accent?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <View className={`${fullWidth ? "w-full" : "flex-1"} rounded-2xl border border-border-subtle bg-bg-card px-4 py-3`}>
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
  const [newSkills, setNewSkills] = useState<SkillListItem[]>([]);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadHome = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    Promise.all([
      fetchHotSkills(20),
      fetchHomeStats(),
      fetchNewSkills(10),
      fetchCategories(),
      fetchCategoryCounts(),
    ])
      .then(([hot, s, newer, cats, cnt]) => {
        setHotSkills(hot);
        setStats(s);
        setNewSkills(newer);
        setCategories(cats);
        setCounts(cnt);
      })
      .catch(() => setLoadError(true))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => { loadHome(); }, [loadHome]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchSkills(query).then((r) => { if (!cancelled) setResults(r); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const showingSearch = query.trim().length > 0;

  const banner = useMemo(() => {
    const hasNewToday = !!stats && stats.newToday > 0;
    return (
      <View className="mb-5">
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

        <View className="flex-row gap-3 mb-4">
          <StatCard
            icon="apps-outline"
            value={stats ? stats.total.toLocaleString() : "—"}
            label="技能总数"
            fullWidth={!hasNewToday}
          />
          {hasNewToday && (
            <StatCard
              icon="flash-outline"
              value={`+${stats!.newToday}`}
              label="今日新增"
              accent
            />
          )}
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="搜索技能、标签、作者"
        />
      </View>
    );
  }, [stats, query]);

  const categoriesSection = useMemo(() => {
    const visible = categories.filter((c) => (counts[c.slug] ?? 0) > 0);
    if (visible.length === 0) return null;
    return (
      <View className="mb-5">
        <View className="mb-3 flex-row items-center gap-1.5">
          <Ionicons name="grid-outline" size={16} color="#D97757" />
          <Text className="text-base font-bold text-text">分类浏览</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {visible.map((c) => (
            <CategoryChip
              key={c.id}
              label={categoryName(c.slug)}
              icon={categoryIcon(c.slug)}
              count={counts[c.slug]}
              onPress={() =>
                router.push({ pathname: "/(tabs)/explore", params: { category: c.slug } })
              }
            />
          ))}
        </ScrollView>
      </View>
    );
  }, [categories, counts]);

  const hotSection = useMemo(() => (
    <View className="mb-5">
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
      ) : loadError ? (
        <View className="items-center rounded-2xl border border-border-subtle bg-bg-card px-4 py-6">
          <Ionicons name="cloud-offline-outline" size={28} color="#9A9AA8" />
          <Text className="mt-2 text-sm text-text-muted">加载失败，请检查网络</Text>
          <Pressable
            onPress={() => loadHome()}
            className="mt-3 flex-row items-center gap-1 rounded-full bg-brand px-4 py-2 active:opacity-70"
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">重试</Text>
          </Pressable>
        </View>
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
  ), [hotSkills, loading, loadError, loadHome]);

  const newSection = useMemo(() => {
    if (loading || newSkills.length === 0) return null;
    return (
      <View className="mb-2">
        <View className="mb-3 flex-row items-center gap-1.5">
          <Ionicons name="sparkles-outline" size={16} color="#D97757" />
          <Text className="text-base font-bold text-text">最新上架</Text>
        </View>
        {newSkills.map((s) => <SkillCard key={s.id} skill={s} />)}
      </View>
    );
  }, [newSkills, loading]);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHome(true)}
            tintColor="#D97757"
          />
        }
      >
        {banner}
        {categoriesSection}
        {hotSection}
        {newSection}
      </ScrollView>
    </SafeAreaView>
  );
}
