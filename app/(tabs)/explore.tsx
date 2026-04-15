import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkillCard } from "@/components/SkillCard";
import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { fetchCategories, fetchSkillsByCategory } from "@/lib/skills";
import type { Category, SkillListItem } from "@/types/skill";

export default function ExploreScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories().then((c) => {
      setCategories(c);
      if (c.length > 0) setActive(c[0].slug);
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    fetchSkillsByCategory(active)
      .then(setSkills)
      .finally(() => setLoading(false));
  }, [active]);

  const header = useMemo(
    () => (
      <View className="mb-2">
        <Text className="mb-3 text-lg font-bold text-text">分类</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              active={c.slug === active}
              onPress={() => setActive(c.slug)}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [categories, active],
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={header}
        data={skills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SkillCard skill={item} />}
        ListEmptyComponent={
          loading ? (
            <View className="py-16">
              <ActivityIndicator color="#D97757" />
            </View>
          ) : (
            <EmptyState
              icon="grid-outline"
              title="该分类暂无技能"
            />
          )
        }
      />
    </SafeAreaView>
  );
}
