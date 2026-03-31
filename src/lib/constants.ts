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
  nebius: {
    name: "Nebius AI",
    color: "#5B2EFF",
    prefix: "",
    icon: "cloud",
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
  { label: "Workflows", href: "/workflows", icon: "git-fork" },
  { label: "Activity", href: "/activity", icon: "activity" },
  { label: "Settings", href: "/settings", icon: "settings" },
] as const;

// Activity type icons are rendered as JSX in the UI.
// Using simple SVG path data here to avoid importing React in a shared constants file.
// Each type maps to: label (display name), color (hex), and an SVG icon element.
export const ACTIVITY_TYPES: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  key_created: {
    label: "Key Added",
    color: "#00FF88",
    icon: "\u{1F511}", // Key emoji as placeholder — replaced with SVG in actual rendering
  },
  key_revealed: {
    label: "Key Revealed",
    color: "#06B6D4",
    icon: "\u{1F441}",
  },
  key_deleted: {
    label: "Key Deleted",
    color: "#EF4444",
    icon: "\u{1F5D1}",
  },
  key_toggled: {
    label: "Key Toggled",
    color: "#F59E0B",
    icon: "\u{1F504}",
  },
  agent_submitted: {
    label: "Agent",
    color: "#8B5CF6",
    icon: "\u{1F916}",
  },
  review_submitted: {
    label: "Review",
    color: "#F59E0B",
    icon: "\u{2B50}",
  },
  workflow_created: {
    label: "Workflow",
    color: "#00FF88",
    icon: "\u{1F527}",
  },
  workflow_forked: {
    label: "Fork",
    color: "#06B6D4",
    icon: "\u{1F500}",
  },
  workflow_starred: {
    label: "Star",
    color: "#F59E0B",
    icon: "\u{2B50}",
  },
  killswitch_single: {
    label: "Kill Switch",
    color: "#EF4444",
    icon: "\u{26A0}",
  },
  killswitch_all: {
    label: "Kill All",
    color: "#EF4444",
    icon: "\u{1F6A8}",
  },
  proxy_token_created: {
    label: "Proxy Token",
    color: "#06B6D4",
    icon: "\u{1F510}",
  },
  proxy_session_killed: {
    label: "Session Killed",
    color: "#EF4444",
    icon: "\u{1F6AB}",
  },
  proxy_sessions_bulk_killed: {
    label: "Sessions Purged",
    color: "#EF4444",
    icon: "\u{1F4A5}",
  },
  proxy_session_limits_updated: {
    label: "Limits Updated",
    color: "#F59E0B",
    icon: "\u{1F6E1}",
  },
  proxy_request: {
    label: "Proxy Request",
    color: "#8B5CF6",
    icon: "\u{1F310}",
  },
  rate_limit_hit: {
    label: "Rate Limited",
    color: "#F59E0B",
    icon: "\u{26A0}",
  },
  budget_exceeded: {
    label: "Budget Hit",
    color: "#EF4444",
    icon: "\u{1F4B0}",
  },
  default: {
    label: "Activity",
    color: "#888888",
    icon: "\u{1F4CB}",
  },
};
