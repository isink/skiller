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
    Promise.all(ids.map((id) => fetchSkillById(id))).then((results) => {
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
        renderItem={({ item }) => <SkillCard skill={item} />}
        ListEmptyComponent={
          <View className="mt-12">
            <EmptyState
              icon="heart-outline"
              title="No favorites yet"
              subtitle="Tap the heart on any skill to save it here."
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
