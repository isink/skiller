import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkillCard } from "@/components/SkillCard";
import { EmptyState } from "@/components/EmptyState";
import { useFavoriteIds } from "@/lib/favorites";
import { fetchSkillById } from "@/lib/skills";
import type { Skill } from "@/types/skill";

export default function FavoritesScreen() {
  const ids = useFavoriteIds();
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([...ids].reverse().map((id) => fetchSkillById(id))).then((results) => {
      if (cancelled) return;
      setSkills(results.filter((s): s is Skill => s !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-bg">
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        data={skills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SkillCard skill={item} showInstall />}
        ListEmptyComponent={
          <View className="mt-12">
            <EmptyState
              icon="heart-outline"
              title="还没有收藏"
              subtitle="点击技能卡片上的心形图标即可收藏"
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
