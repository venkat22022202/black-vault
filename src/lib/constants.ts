export const PROVIDERS = {
  openai: {
    name: "OpenAI",
    color: "#10A37F",
    prefix: "sk-",
    icon: "brain",
  },
  anthropic: {
    name: "Anthropic",
    color: "#D4A574",
    prefix: "sk-ant-",
    icon: "sparkles",
  },
  google: {
    name: "Google AI",
    color: "#4285F4",
    prefix: "AIza",
    icon: "globe",
  },
  replicate: {
    name: "Replicate",
    color: "#FFFFFF",
    prefix: "r8_",
    icon: "repeat",
  },
  groq: {
    name: "Groq",
    color: "#F55036",
    prefix: "gsk_",
    icon: "zap",
  },
  together: {
    name: "Together AI",
    color: "#6366F1",
    prefix: "",
    icon: "users",
  },
  mistral: {
    name: "Mistral",
    color: "#FF7000",
    prefix: "",
    icon: "wind",
  },
  elevenlabs: {
    name: "ElevenLabs",
    color: "#6C63FF",
    prefix: "",
    icon: "mic",
  },
  other: {
    name: "Other",
    color: "#888888",
    prefix: "",
    icon: "key",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export const PROVIDER_LIST = Object.entries(PROVIDERS).map(([id, data]) => ({
  id: id as ProviderId,
  ...data,
}));

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Vault", href: "/vault", icon: "lock" },
  { label: "Agents", href: "/agents", icon: "bot" },
  { label: "Settings", href: "/settings", icon: "settings" },
] as const;
