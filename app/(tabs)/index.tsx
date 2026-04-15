import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "@/components/SearchBar";
import { SkillCard } from "@/components/SkillCard";
import { EmptyState } from "@/components/EmptyState";
import { fetchFeaturedSkills, searchSkills } from "@/lib/skills";
import type { SkillListItem } from "@/types/skill";

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<SkillListItem[]>([]);
  const [results, setResults] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedSkills()
      .then(setFeatured)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchSkills(query).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const showingSearch = query.trim().length > 0;
  const data = useMemo(
    () => (showingSearch ? results : featured),
    [showingSearch, results, featured],
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View className="mb-4">
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="搜索技能、标签、作者"
            />
            {!showingSearch ? (
              <Text className="mt-5 text-lg font-bold text-text">
                精选技能
              </Text>
            ) : (
              <Text className="mt-5 text-sm text-text-muted">
                找到 {results.length} 个关于 &quot;{query}&quot; 的结果
              </Text>
            )}
          </View>
        }
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SkillCard skill={item} />}
        ListEmptyComponent={
          loading ? (
            <View className="py-16">
              <ActivityIndicator color="#D97757" />
            </View>
          ) : showingSearch ? (
            <EmptyState
              icon="search-outline"
              title="没有匹配结果"
              subtitle="试试其他关键词"
            />
          ) : (
            <EmptyState
              title="暂无技能"
              subtitle="精选技能将在这里显示"
            />
          )
        }
      />
    </SafeAreaView>
  );
}
