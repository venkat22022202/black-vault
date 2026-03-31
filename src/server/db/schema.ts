import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  decimal,
  integer,
  jsonb,
  customType,
  date,
  unique,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value: unknown): Buffer {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === "string") {
      // Neon returns bytea as hex string like \x1a2b3c...
      const hex = value.startsWith("\\x") ? value.slice(2) : value;
      return Buffer.from(hex, "hex");
    }
    return Buffer.from(value as ArrayBuffer);
  },
});

// ============================================
// USERS
// ============================================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").unique().notNull(),
  username: text("username").unique().notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  githubUrl: text("github_url"),
  plan: text("plan").default("free").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// API KEY VAULT
// ============================================
export const vaultKeys = pgTable("vault_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  encryptedKey: bytea("encrypted_key").notNull(),
  iv: bytea("iv").notNull(),
  keyPrefix: text("key_prefix"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  monthlyBudget: decimal("monthly_budget", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  permissions: jsonb("permissions").default(["read", "write"]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// AGENT REGISTRY
// ============================================
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  submittedBy: uuid("submitted_by").references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  category: text("category"),
  provider: text("provider"),
  websiteUrl: text("website_url"),
  githubUrl: text("github_url"),
  logoUrl: text("logo_url"),
  pitch: text("pitch"),
  capabilities: jsonb("capabilities"),
  howItWorks: text("how_it_works"),
  status: text("status").default("approved").notNull(),
  avgCostPerRun: decimal("avg_cost_per_run", { precision: 10, scale: 4 }),
  permissionsRequired: jsonb("permissions_required"),
  trustScore: decimal("trust_score", { precision: 3, scale: 2 }).default("0"),
  totalReviews: integer("total_reviews").default(0).notNull(),
  totalUpvotes: integer("total_upvotes").default(0).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  tags: text("tags").array(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// REVIEWS
// ============================================
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body"),
  pros: text("pros").array(),
  cons: text("cons").array(),
  upvotes: integer("upvotes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// WORKFLOWS
// ============================================
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  config: jsonb("config").notNull(),
  agentsUsed: uuid("agents_used").array(),
  providersUsed: text("providers_used").array(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  totalForks: integer("total_forks").default(0).notNull(),
  totalStars: integer("total_stars").default(0).notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// AGENT VOTES
// ============================================
export const agentVotes = pgTable("agent_votes", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  vote: integer("vote").notNull(), // 1 or -1
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// ACTIVITY LOG
// ============================================
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // key_created, key_revealed, key_deleted, key_toggled, agent_submitted, review_submitted, workflow_created, workflow_forked, workflow_starred, killswitch_single, killswitch_all
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// PROVIDER COST SNAPSHOTS
// ============================================
export const providerCostSnapshots = pgTable("provider_cost_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull(),
  date: date("date").notNull(),
  dailyCost: decimal("daily_cost", { precision: 10, scale: 4 }).notNull(),
  cumulativeCost: decimal("cumulative_cost", { precision: 10, scale: 4 }).notNull(),
  tokenCount: integer("token_count").default(0).notNull(),
  requestCount: integer("request_count").default(0).notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// WORKFLOW STARS
// ============================================
export const workflowStars = pgTable(
  "workflow_stars",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.workflowId)]
);

// ============================================
// PROXY SESSIONS
// ============================================
export const proxySessions = pgTable("proxy_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  vaultKeyId: uuid("vault_key_id")
    .references(() => vaultKeys.id, { onDelete: "cascade" })
    .notNull(),
  tokenHash: text("token_hash").unique().notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  label: text("label").notNull(),
  deviceInfo: jsonb("device_info").default({}),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  totalRequests: integer("total_requests").default(0).notNull(),
  totalTokensUsed: integer("total_tokens_used").default(0).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0").notNull(),
  // Per-session rate limiting & access controls
  rateLimitRpm: integer("rate_limit_rpm"),            // requests per minute (null = use global default)
  rateLimitRpd: integer("rate_limit_rpd"),            // requests per day (null = unlimited)
  maxBudget: decimal("max_budget", { precision: 10, scale: 4 }), // max spend for this session (null = unlimited)
  allowedModels: text("allowed_models").array(),       // restrict to specific models (null = all)
  allowedIps: text("allowed_ips").array(),             // IP allowlist (null = any IP)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// PROXY LOGS
// ============================================
export const proxyLogs = pgTable("proxy_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => proxySessions.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code").notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).default("0").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// NOTIFICATIONS
// ============================================
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  isRead: boolean("is_read").default(false).notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
