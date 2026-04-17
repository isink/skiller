import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categoryName, categoryIcon } from "@/lib/categories";
import { ActivityIndicator, FlatList, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkillCard } from "@/components/SkillCard";
import { CategoryChip } from "@/components/CategoryChip";
import { SkillListSkeleton } from "@/components/SkillCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  fetchCategories,
  fetchSkillsByCategory,
  fetchAllSkills,
  fetchCategoryCounts,
} from "@/lib/skills";
import type { Category, SkillListItem } from "@/types/skill";

const ALL_SLUG = "__all__";
const PAGE_SIZE = 50;

export default function ExploreScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string>(ALL_SLUG);
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchCategoryCounts()]).then(([c, cnt]) => {
      setCategories(c);
      setCounts(cnt);
    });
  }, []);

  const loadPage = useCallback(async (slug: string, offset: number) => {
    if (slug === ALL_SLUG) return fetchAllSkills(offset, PAGE_SIZE);
    return fetchSkillsByCategory(slug, offset, PAGE_SIZE);
  }, []);

  // Reset and load first page when active tab changes
  useEffect(() => {
    setLoading(true);
    setSkills([]);
    setHasMore(true);
    offsetRef.current = 0;
    loadingMoreRef.current = false;
    loadPage(active, 0).then((page) => {
      setSkills(page);
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current = page.length;
      setLoading(false);
    });
  }, [active, loadPage]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    loadPage(active, offsetRef.current).then((page) => {
      setSkills((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const fresh = page.filter((s) => !existingIds.has(s.id));
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
              active={c.slug === active}
              onPress={() => setActive(c.slug)}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [categories, counts, active, totalCount],
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={header}
        data={skills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SkillCard skill={item} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
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
    </SafeAreaView>
  );
}
