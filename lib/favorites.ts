import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "iskill.favorites.v1";

// In-memory cache so reads stay synchronous once hydrated.
let cached: string[] | null = null;
let hydrating: Promise<void> | null = null;

type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();

function hydrate(): Promise<void> {
  if (cached !== null) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) {
        cached = [];
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        cached = Array.isArray(parsed) ? parsed : [];
      } catch {
        cached = [];
      }
    })
    .catch(() => {
      cached = [];
    });
  return hydrating;
}

function notify() {
  if (cached === null) return;
  const snapshot = [...cached];
  listeners.forEach((l) => l(snapshot));
}

export async function toggleFavorite(id: string): Promise<void> {
  await hydrate();
  const current = cached ?? [];
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  cached = next;
  notify();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: state is already updated in memory.
  }
}

export function useFavoriteIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => cached ?? []);

  useEffect(() => {
    let mounted = true;
    hydrate().then(() => {
      if (mounted && cached) setIds([...cached]);
    });
    const listener: Listener = (next) => {
      if (mounted) setIds(next);
    };
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  return ids;
}

export function useIsFavorite(id: string): [boolean, () => void] {
  const ids = useFavoriteIds();
  const toggle = useCallback(() => {
    void toggleFavorite(id);
  }, [id]);
  return [ids.includes(id), toggle];
}
