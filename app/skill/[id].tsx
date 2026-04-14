import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Markdown from "react-native-markdown-display";
import { fetchSkillById } from "@/lib/skills";
import { useIsFavorite } from "@/lib/favorites";
import type { Skill } from "@/types/skill";

type AgentId = "claude" | "codex" | "cursor";

const AGENTS: { id: AgentId; label: string; command: (slug: string) => string }[] = [
  { id: "claude", label: "Claude", command: (slug) => `claude skill install ${slug}` },
  { id: "codex",  label: "Codex",  command: (slug) => `codex skill install ${slug}` },
  { id: "cursor", label: "Cursor", command: (slug) => `cursor skill install ${slug}` },
];

function supportedAgents(skill: Skill): AgentId[] {
  const tagSet = new Set(skill.tags);
  // If no agent tags at all, default to Claude only
  const known = AGENTS.map((a) => a.id);
  const found = known.filter((id) => tagSet.has(id));
  return found.length > 0 ? found : ["claude"];
}

export default function SkillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("claude");
  const [favorited, toggleFavorited] = useIsFavorite(id ?? "");

  useEffect(() => {
    if (!id) return;
    fetchSkillById(id)
      .then(setSkill)
      .finally(() => setLoading(false));
  }, [id]);

  const agents = skill ? supportedAgents(skill) : (["claude"] as AgentId[]);
  const activeAgent = agents.includes(selectedAgent) ? selectedAgent : agents[0];
  const activeAgentDef = AGENTS.find((a) => a.id === activeAgent)!;
  const installCommand = skill ? activeAgentDef.command(skill.slug) : "";

  const copy = async () => {
    if (!skill) return;
    await Clipboard.setStringAsync(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#D97757" />
      </View>
    );
  }

  if (!skill) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Ionicons name="alert-circle-outline" size={40} color="#6B6B78" />
        <Text className="mt-3 text-base text-text-muted">Skill not found</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-full border border-border bg-bg-elevated px-4 py-2"
        >
          <Text className="text-sm text-text">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <SafeAreaView edges={["top"]} className="px-5 pt-12">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xs uppercase tracking-widest text-text-subtle">
                {skill.category}
              </Text>
              <Text className="mt-1 text-3xl font-bold text-text">
                {skill.name}
              </Text>
              <Text className="mt-1 text-sm text-text-muted">
                by {skill.author}
              </Text>
            </View>
            <Pressable
              hitSlop={12}
              onPress={toggleFavorited}
              className="rounded-full bg-bg-elevated p-2.5"
            >
              <Ionicons
                name={favorited ? "heart" : "heart-outline"}
                size={22}
                color={favorited ? "#D97757" : "#9A9AA8"}
              />
            </Pressable>
          </View>

          <Text className="mt-4 text-base leading-6 text-text-muted">
            {skill.description}
          </Text>

          {skill.tags.length > 0 ? (
            <View className="mt-4 flex-row flex-wrap">
              {skill.tags.map((tag) => (
                <View
                  key={tag}
                  className="mb-2 mr-2 rounded-full border border-border-subtle bg-bg-elevated px-3 py-1"
                >
                  <Text className="text-[11px] text-text-muted">#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className="mt-5 flex-row items-center gap-3">
            <View className="flex-row items-center">
              <Ionicons name="download-outline" size={14} color="#9A9AA8" />
              <Text className="ml-1 text-xs text-text-muted">
                {skill.install_count.toLocaleString()} installs
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="star" size={14} color="#D97757" />
              <Text className="ml-1 text-xs text-text-muted">
                {skill.score}
              </Text>
            </View>
          </View>

          {/* Agent selector tabs */}
          <View className="mt-5">
            {agents.length > 1 && (
              <View className="mb-2 flex-row rounded-xl border border-border bg-bg-card p-1">
                {agents.map((agentId) => {
                  const def = AGENTS.find((a) => a.id === agentId)!;
                  const active = agentId === activeAgent;
                  return (
                    <Pressable
                      key={agentId}
                      onPress={() => { setSelectedAgent(agentId); setCopied(false); }}
                      className={`flex-1 items-center rounded-lg py-1.5 ${
                        active ? "bg-brand" : ""
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? "text-white" : "text-text-muted"
                        }`}
                      >
                        {def.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              onPress={copy}
              className="flex-row items-center justify-between rounded-xl border border-border bg-bg-card px-4 py-3.5 active:opacity-70"
            >
              <View className="flex-1 pr-3">
                <Text className="text-[11px] uppercase tracking-wider text-text-subtle">
                  Install command
                </Text>
                <Text className="mt-1 font-mono text-sm text-text">
                  {installCommand}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={18}
                  color={copied ? "#8AE6A6" : "#D97757"}
                />
                <Text
                  className={`ml-1 text-xs font-semibold ${
                    copied ? "text-[#8AE6A6]" : "text-brand"
                  }`}
                >
                  {copied ? "Copied" : "Copy"}
                </Text>
              </View>
            </Pressable>
          </View>

          <Pressable
            onPress={() => Linking.openURL(skill.github_url)}
            className="mt-3 flex-row items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 active:opacity-70"
          >
            <Ionicons name="logo-github" size={18} color="#F5F5F7" />
            <Text className="ml-2 text-sm font-medium text-text">
              View on GitHub
            </Text>
          </Pressable>
        </SafeAreaView>

        <View className="mt-8 px-5">
          <Text className="mb-3 text-xs uppercase tracking-widest text-text-subtle">
            SKILL.md
          </Text>
          <View className="rounded-2xl border border-border-subtle bg-bg-card p-4">
            {skill.skill_md_content ? (
              <Markdown style={markdownStyles}>
                {skill.skill_md_content}
              </Markdown>
            ) : (
              <Text className="text-sm italic text-text-subtle">
                No SKILL.md content available yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const markdownStyles = {
  body: { color: "#F5F5F7", fontSize: 14, lineHeight: 21 },
  heading1: {
    color: "#F5F5F7",
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: 4,
    marginBottom: 8,
  },
  heading2: {
    color: "#F5F5F7",
    fontSize: 16,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    color: "#F5F5F7",
    fontSize: 14,
    fontWeight: "700" as const,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: { color: "#D8D8E0", marginTop: 4, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  code_inline: {
    backgroundColor: "#14141B",
    color: "#E8A084",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 13,
  },
  code_block: {
    backgroundColor: "#0B0B0F",
    color: "#F5F5F7",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
  },
  fence: {
    backgroundColor: "#0B0B0F",
    color: "#F5F5F7",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
  },
  link: { color: "#D97757" },
  list_item: { color: "#D8D8E0" },
};
