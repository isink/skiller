import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

function Bone({ className }: { className: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className={`rounded-md bg-bg-elevated ${className}`}
    />
  );
}

export function SkillCardSkeleton() {
  return (
    <View className="mb-3 rounded-2xl border border-border-subtle bg-bg-card p-4">
      {/* Title row */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Bone className="h-4 w-3/4" />
          <Bone className="mt-2 h-3 w-1/3" />
        </View>
        <Bone className="h-6 w-6 rounded-full" />
      </View>

      {/* Description */}
      <Bone className="mt-3 h-3 w-full" />
      <Bone className="mt-1.5 h-3 w-5/6" />

      {/* Bottom row */}
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row gap-1.5">
          <Bone className="h-5 w-16 rounded-full" />
          <Bone className="h-5 w-12 rounded-full" />
          <Bone className="h-5 w-14 rounded-full" />
        </View>
        <Bone className="h-3 w-8" />
      </View>
    </View>
  );
}

export function SkillListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkillCardSkeleton key={i} />
      ))}
    </>
  );
}
