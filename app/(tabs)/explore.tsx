import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categoryName, categoryIcon } from "@/lib/categories";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { SkillCard } from "@/components/SkillCard";
import { RepoGroupCard } from "@/components/RepoGroupCard";
import { CategoryChip } from "@/components/CategoryChip";
import { SkillListSkeleton } from "@/components/SkillCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  fetchCategories,
  fetchSkillsByCategory,
  fetchRepoGroups,
  fetchCategoryCounts,
  fetchNewCountsByCategory,
  type RepoGroupSummary,
} from "@/lib/skills";
import { getLastSeenAt, updateLastSeenAt } from "@/lib/lastSeen";
import type { Category, SkillListItem } from "@/types/skill";

const ALL_SLUG = "__all__";
const PAGE_SIZE = 50;

type Item =
  | { kind: "group"; data: RepoGroupSummary }
  | { kind: "skill"; data: SkillListItem };

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string>(params.category ?? ALL_SLUG);

  useEffect(() => {
    if (params.category && params.category !== active) {
      setActive(params.category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.category]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const genRef = useRef(0);
  const listRef = useRef<FlatList<Item>>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    async function load() {
      const [c, cnt, lastSeen] = await Promise.all([
        fetchCategories(),
        fetchCategoryCounts(),
        getLastSeenAt(),
      ]);
      setCategories(c);
      setCounts(cnt);
      if (lastSeen) {
        const nc = await fetchNewCountsByCategory(lastSeen);
        setNewCounts(nc);
      }
      updateLastSeenAt();
    }
    load();
  }, []);

  const loadPage = useCallback(async (slug: string, offset: number): Promise<Item[]> => {
    if (slug === ALL_SLUG) {
      const groups = await fetchRepoGroups(offset, PAGE_SIZE);
      return groups.map((g) => ({ kind: "group", data: g } as Item));
    }
    const skills = await fetchSkillsByCategory(slug, offset, PAGE_SIZE);
    return skills.map((s) => ({ kind: "skill", data: s } as Item));
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    setLoading(true);
    setItems([]);
    setHasMore(true);
    offsetRef.current = 0;
    loadingMoreRef.current = false;
    loadPage(active, 0).then((page) => {
      if (gen !== genRef.current) return;
      setItems(page);
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current = page.length;
      setLoading(false);
    });
  }, [active, loadPage]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    const gen = genRef.current;
    setLoadingMore(true);
    loadPage(active, offsetRef.current).then((page) => {
      if (gen !== genRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }
      setItems((prev) => {
        const seen = new Set(
          prev.map((x) => (x.kind === "group" ? `g:${x.data.repo}` : `s:${x.data.id}`)),
        );
        const fresh = page.filter(
          (x) => !seen.has(x.kind === "group" ? `g:${x.data.repo}` : `s:${x.data.id}`),
        );
        return [...prev, ...fresh];
      });
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current += page.length;
      loadingMoreRef.current = false;
      setLoadingMore(false);
    });
  }, [active, hasMore, loadPage]);

  const totalCount = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

  const header = useMemo(
    () => (
      <View className="mb-2">
        <Text className="mb-3 text-lg font-bold text-text">分类</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          <CategoryChip
            label="全部"
            count={totalCount || undefined}
            active={active === ALL_SLUG}
            onPress={() => setActive(ALL_SLUG)}
          />
          {categories.filter((c) => counts[c.slug] > 0).map((c) => (
            <CategoryChip
              key={c.id}
              label={categoryName(c.slug)}
              icon={categoryIcon(c.slug)}
              count={counts[c.slug]}
              newCount={newCounts[c.slug]}
              active={c.slug === active}
              onPress={() => setActive(c.slug)}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [categories, counts, active, totalCount, newCounts],
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <FlatList
        ref={listRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={header}
        data={items}
        keyExtractor={(item) =>
          item.kind === "group" ? `g:${item.data.repo}` : `s:${item.data.id}`
        }
        renderItem={({ item }) =>
          item.kind === "group" ? (
            <RepoGroupCard group={item.data} />
          ) : (
            <SkillCard skill={item.data} />
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowTop(y > 600);
        }}
        scrollEventThrottle={200}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4">
              <ActivityIndicator color="#D97757" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <SkillListSkeleton count={6} />
          ) : (
            <EmptyState icon="grid-outline" title="该分类暂无技能" />
          )
        }
      />
      {showTop && (
        <Pressable
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          className="absolute bottom-6 right-4 h-11 w-11 items-center justify-center rounded-full bg-brand shadow-lg active:opacity-70"
        >
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
