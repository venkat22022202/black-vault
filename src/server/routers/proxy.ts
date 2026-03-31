import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { proxySessions, proxyLogs, vaultKeys } from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateProxyToken } from "@/server/services/proxy-token";
import { invalidateProxySession, invalidateProxySessionsForKey } from "@/server/services/proxy-auth";
import { logActivity } from "@/server/services/activity";

export const proxyRouter = router({
  generateToken: protectedProcedure
    .input(
      z.object({
        vaultKeyId: z.string().uuid(),
        label: z.string().min(1).max(100),
        expiresInHours: z.number().positive().optional(),
        // Rate limit controls
        rateLimitRpm: z.number().int().min(1).max(10000).optional(),
        rateLimitRpd: z.number().int().min(1).max(1000000).optional(),
        maxBudget: z.number().min(0.01).max(100000).optional(),
        allowedModels: z.array(z.string().min(1).max(100)).max(50).optional(),
        allowedIps: z
          .array(z.string().min(7).max(45)) // IPv4 min "1.1.1.1", IPv6 max 45 chars
          .max(50)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify key belongs to user and is active
      const [key] = await db
        .select({
          id: vaultKeys.id,
          provider: vaultKeys.provider,
          isActive: vaultKeys.isActive,
          label: vaultKeys.label,
        })
        .from(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.vaultKeyId),
            eq(vaultKeys.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!key) throw new Error("Vault key not found");
      if (!key.isActive) throw new Error("Vault key is disabled");

      const { token, hash, prefix } = generateProxyToken();

      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 3600 * 1000)
        : null;

      await db.insert(proxySessions).values({
        userId: ctx.dbUserId,
        vaultKeyId: input.vaultKeyId,
        tokenHash: hash,
        tokenPrefix: prefix,
        label: input.label,
        expiresAt,
        rateLimitRpm: input.rateLimitRpm ?? null,
        rateLimitRpd: input.rateLimitRpd ?? null,
        maxBudget: input.maxBudget?.toFixed(4) ?? null,
        allowedModels: input.allowedModels?.length ? input.allowedModels : null,
        allowedIps: input.allowedIps?.length ? input.allowedIps : null,
      });

      const limitParts: string[] = [];
      if (input.rateLimitRpm) limitParts.push(`${input.rateLimitRpm} RPM`);
      if (input.rateLimitRpd) limitParts.push(`${input.rateLimitRpd} RPD`);
      if (input.maxBudget) limitParts.push(`$${input.maxBudget} budget`);
      if (input.allowedModels?.length) limitParts.push(`${input.allowedModels.length} models`);
      if (input.allowedIps?.length) limitParts.push(`${input.allowedIps.length} IPs`);

      logActivity(
        ctx.dbUserId,
        "proxy_token_created",
        `Created proxy token: ${input.label}`,
        `New proxy session for ${key.provider} key "${key.label}"${limitParts.length ? ` [${limitParts.join(", ")}]` : ""}`,
        {
          vaultKeyId: input.vaultKeyId,
          provider: key.provider,
          rateLimitRpm: input.rateLimitRpm,
          rateLimitRpd: input.rateLimitRpd,
          maxBudget: input.maxBudget,
          allowedModels: input.allowedModels,
          allowedIps: input.allowedIps,
        }
      );

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      return {
        token,
        prefix,
        proxyBaseUrl: `${appUrl}/api/proxy/${key.provider}`,
      };
    }),

  updateSessionLimits: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        rateLimitRpm: z.number().int().min(1).max(10000).nullable().optional(),
        rateLimitRpd: z.number().int().min(1).max(1000000).nullable().optional(),
        maxBudget: z.number().min(0.01).max(100000).nullable().optional(),
        allowedModels: z.array(z.string().min(1).max(100)).max(50).nullable().optional(),
        allowedIps: z.array(z.string().min(7).max(45)).max(50).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select({
          id: proxySessions.id,
          tokenHash: proxySessions.tokenHash,
          label: proxySessions.label,
        })
        .from(proxySessions)
        .where(
          and(
            eq(proxySessions.id, input.sessionId),
            eq(proxySessions.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!session) throw new Error("Session not found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.rateLimitRpm !== undefined) updates.rateLimitRpm = input.rateLimitRpm;
      if (input.rateLimitRpd !== undefined) updates.rateLimitRpd = input.rateLimitRpd;
      if (input.maxBudget !== undefined)
        updates.maxBudget = input.maxBudget?.toFixed(4) ?? null;
      if (input.allowedModels !== undefined)
        updates.allowedModels = input.allowedModels?.length ? input.allowedModels : null;
      if (input.allowedIps !== undefined)
        updates.allowedIps = input.allowedIps?.length ? input.allowedIps : null;

      await db
        .update(proxySessions)
        .set(updates)
        .where(eq(proxySessions.id, input.sessionId));

      // Invalidate cache so new limits take effect immediately
      await invalidateProxySession(session.tokenHash);

      logActivity(
        ctx.dbUserId,
        "proxy_session_limits_updated",
        `Updated limits for session: ${session.label}`,
        undefined,
        { sessionId: input.sessionId, ...updates }
      );

      return { success: true };
    }),

  listSessions: protectedProcedure
    .input(
      z
        .object({
          vaultKeyId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(proxySessions.userId, ctx.dbUserId)];
      if (input?.vaultKeyId) {
        conditions.push(eq(proxySessions.vaultKeyId, input.vaultKeyId));
      }

      const sessions = await db
        .select({
          id: proxySessions.id,
          vaultKeyId: proxySessions.vaultKeyId,
          tokenPrefix: proxySessions.tokenPrefix,
          label: proxySessions.label,
          deviceInfo: proxySessions.deviceInfo,
          isActive: proxySessions.isActive,
          lastUsedAt: proxySessions.lastUsedAt,
          expiresAt: proxySessions.expiresAt,
          totalRequests: proxySessions.totalRequests,
          totalTokensUsed: proxySessions.totalTokensUsed,
          totalCost: proxySessions.totalCost,
          rateLimitRpm: proxySessions.rateLimitRpm,
          rateLimitRpd: proxySessions.rateLimitRpd,
          maxBudget: proxySessions.maxBudget,
          allowedModels: proxySessions.allowedModels,
          allowedIps: proxySessions.allowedIps,
          createdAt: proxySessions.createdAt,
          keyProvider: vaultKeys.provider,
          keyLabel: vaultKeys.label,
        })
        .from(proxySessions)
        .innerJoin(vaultKeys, eq(proxySessions.vaultKeyId, vaultKeys.id))
        .where(and(...conditions))
        .orderBy(desc(proxySessions.createdAt));

      return sessions.map((s) => ({
        ...s,
        totalCost: Number(s.totalCost),
        maxBudget: s.maxBudget ? Number(s.maxBudget) : null,
        allowedModels: (s.allowedModels as string[] | null) ?? null,
        allowedIps: (s.allowedIps as string[] | null) ?? null,
        isExpired: s.expiresAt ? new Date(s.expiresAt) < new Date() : false,
      }));
    }),

  killSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select({
          id: proxySessions.id,
          tokenHash: proxySessions.tokenHash,
          label: proxySessions.label,
        })
        .from(proxySessions)
        .where(
          and(
            eq(proxySessions.id, input.sessionId),
            eq(proxySessions.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!session) throw new Error("Session not found");

      await db
        .update(proxySessions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(proxySessions.id, input.sessionId));

      await invalidateProxySession(session.tokenHash);

      logActivity(
        ctx.dbUserId,
        "proxy_session_killed",
        `Killed proxy session: ${session.label}`,
        undefined,
        { sessionId: input.sessionId }
      );

      return { success: true };
    }),

  killAllSessions: protectedProcedure
    .input(
      z
        .object({
          vaultKeyId: z.string().uuid().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const conditions = [
        eq(proxySessions.userId, ctx.dbUserId),
        eq(proxySessions.isActive, true),
      ];
      if (input?.vaultKeyId) {
        conditions.push(eq(proxySessions.vaultKeyId, input.vaultKeyId));
      }

      // Get token hashes for cache invalidation
      const sessions = await db
        .select({ tokenHash: proxySessions.tokenHash })
        .from(proxySessions)
        .where(and(...conditions));

      // Deactivate all
      const result = await db
        .update(proxySessions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: proxySessions.id });

      // Invalidate cache
      await Promise.all(
        sessions.map((s) => invalidateProxySession(s.tokenHash))
      );

      logActivity(
        ctx.dbUserId,
        "proxy_sessions_bulk_killed",
        `Killed ${result.length} proxy sessions`,
        input?.vaultKeyId
          ? `All sessions for vault key revoked`
          : `All proxy sessions revoked`,
        { count: result.length, vaultKeyId: input?.vaultKeyId }
      );

      return { success: true, killedCount: result.length };
    }),

  getSessionLogs: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify session belongs to user
      const [session] = await db
        .select({ id: proxySessions.id })
        .from(proxySessions)
        .where(
          and(
            eq(proxySessions.id, input.sessionId),
            eq(proxySessions.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!session) throw new Error("Session not found");

      const logs = await db
        .select()
        .from(proxyLogs)
        .where(eq(proxyLogs.sessionId, input.sessionId))
        .orderBy(desc(proxyLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return logs.map((l) => ({
        id: l.id,
        provider: l.provider,
        model: l.model,
        endpoint: l.endpoint,
        method: l.method,
        statusCode: l.statusCode,
        inputTokens: l.inputTokens,
        outputTokens: l.outputTokens,
        totalTokens: l.totalTokens,
        estimatedCost: Number(l.estimatedCost),
        latencyMs: l.latencyMs,
        createdAt: l.createdAt,
      }));
    }),

  getKeyUsageSummary: protectedProcedure
    .input(
      z
        .object({
          vaultKeyId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(proxySessions.userId, ctx.dbUserId)];
      if (input?.vaultKeyId) {
        conditions.push(eq(proxySessions.vaultKeyId, input.vaultKeyId));
      }

      const [summary] = await db
        .select({
          totalRequests: sql<number>`coalesce(sum(${proxySessions.totalRequests}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${proxySessions.totalTokensUsed}), 0)`,
          totalCost: sql<number>`coalesce(sum(${proxySessions.totalCost}::numeric), 0)`,
          activeSessions: sql<number>`count(*) filter (where ${proxySessions.isActive} = true)`,
          totalSessions: sql<number>`count(*)`,
        })
        .from(proxySessions)
        .where(and(...conditions));

      return {
        totalRequests: Number(summary?.totalRequests ?? 0),
        totalTokens: Number(summary?.totalTokens ?? 0),
        totalCost: Number(summary?.totalCost ?? 0),
        activeSessions: Number(summary?.activeSessions ?? 0),
        totalSessions: Number(summary?.totalSessions ?? 0),
      };
    }),
});
