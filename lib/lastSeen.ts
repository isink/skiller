import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "skiller.explore.lastSeenAt";

export async function getLastSeenAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function updateLastSeenAt(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, new Date().toISOString());
  } catch {}
}
