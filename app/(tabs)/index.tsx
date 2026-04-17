import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "@/components/SearchBar";
import { SkillCard } from "@/components/SkillCard";
import { SkillListSkeleton } from "@/components/SkillCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fetchNewSkills, searchSkills } from "@/lib/skills";
import type { SkillListItem } from "@/types/skill";

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [newSkills, setNewSkills] = useState<SkillListItem[]>([]);
  const [results, setResults] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewSkills(20).then(setNewSkills).finally(() => setLoading(false));
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
    return () => { cancelled = true; };
  }, [query]);

  const showingSearch = query.trim().length > 0;
  const data = showingSearch ? results : newSkills;

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
            <Text className="mt-5 text-lg font-bold text-text">
              {showingSearch
                ? `找到 ${results.length} 个关于 "${query}" 的结果`
                : "最近添加"}
            </Text>
          </View>
        }
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SkillCard skill={item} />}
        ListEmptyComponent={
          loading ? (
            <SkillListSkeleton count={5} />
          ) : showingSearch ? (
            <EmptyState icon="search-outline" title="没有匹配结果" subtitle="试试其他关键词" />
          ) : (
            <EmptyState title="暂无新技能" subtitle="近期没有新增技能" />
          )
        }
      />
    </SafeAreaView>
  );
}
