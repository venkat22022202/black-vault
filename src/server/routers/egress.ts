import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { vaultKeys, proxySessions, proxyLogs } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { encryptApiKey } from "@/server/services/encryption";
import { maskApiKey } from "@/lib/utils";
import { randomUUID } from "crypto";
import { logActivity } from "@/server/services/activity";
import { checkRateLimit } from "@/server/services/ratelimit";
import { invalidateProxySessionsForKey } from "@/server/services/proxy-auth";
import { parseHttpTarget } from "@/server/services/egress-target";

const METHOD = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

/**
 * Egress firewall targets — brokered HTTP credentials stored as vault keys with
 * provider="http". The secret is encrypted; where/how it may be used lives in
 * the key's metadata. See docs/design/0003-egress-firewall.md.
 */
export const egressRouter = router({
  listTargets: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(vaultKeys)
      .where(and(eq(vaultKeys.userId, ctx.dbUserId), eq(vaultKeys.provider, "http")))
      .orderBy(desc(vaultKeys.createdAt));

    return rows.map((k) => {
      const target = parseHttpTarget(k.metadata);
      return {
        id: k.id,
        label: k.label,
        keyPrefix: k.keyPrefix ?? "****",
        isActive: k.isActive,
        baseUrl: target?.baseUrl ?? "",
        authScheme: target?.auth.scheme ?? "bearer",
        authName: target?.auth.name ?? null,
        policy: target?.policy ?? null,
        createdAt: k.createdAt,
      };
    });
  }),

  createTarget: protectedProcedure
    .input(
      z.object({
        label: z.string().min(1).max(100),
        baseUrl: z.string().url().refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
          message: "Base URL must be http(s)",
        }),
        secret: z.string().min(1),
        authScheme: z.enum(["bearer", "header", "query"]).default("bearer"),
        authName: z.string().min(1).max(100).optional(),
        allowedMethods: z.array(METHOD).max(8).optional(),
        allowedPaths: z.array(z.string().min(1).max(300)).max(50).optional(),
        blockedPaths: z.array(z.string().min(1).max(300)).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkRateLimit("vaultCreate", ctx.dbUserId);

      if ((input.authScheme === "header" || input.authScheme === "query") && !input.authName) {
        throw new Error(`A header/query name is required for the ${input.authScheme} scheme`);
      }

      const policy: Record<string, unknown> = {};
      if (input.allowedMethods?.length) policy.allowedMethods = input.allowedMethods;
      if (input.allowedPaths?.length) policy.allowedPaths = input.allowedPaths;
      if (input.blockedPaths?.length) policy.blockedPaths = input.blockedPaths;

      const metadata: Record<string, unknown> = {
        baseUrl: input.baseUrl.replace(/\/+$/, ""),
        auth: { scheme: input.authScheme, ...(input.authName ? { name: input.authName } : {}) },
        ...(Object.keys(policy).length ? { policy } : {}),
      };

      const keyId = randomUUID();
      const { encrypted, iv } = encryptApiKey(input.secret, ctx.dbUserId, keyId);

      const [key] = await db
        .insert(vaultKeys)
        .values({
          id: keyId,
          userId: ctx.dbUserId,
          provider: "http",
          label: input.label,
          encryptedKey: encrypted,
          iv,
          keyPrefix: maskApiKey(input.secret),
          metadata,
        })
        .returning();

      logActivity(
        ctx.dbUserId,
        "key_created",
        `Created egress target: ${input.label}`,
        `Brokered credential for ${metadata.baseUrl}`,
        { keyId: key.id, baseUrl: metadata.baseUrl }
      );

      return { id: key.id, label: key.label };
    }),

  deleteTarget: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ label: vaultKeys.label })
        .from(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.id),
            eq(vaultKeys.userId, ctx.dbUserId),
            eq(vaultKeys.provider, "http")
          )
        )
        .limit(1);
      if (!key) throw new Error("Target not found");

      await invalidateProxySessionsForKey(input.id);
      await db.delete(vaultKeys).where(and(eq(vaultKeys.id, input.id), eq(vaultKeys.userId, ctx.dbUserId)));

      logActivity(ctx.dbUserId, "key_deleted", `Deleted egress target: ${key.label}`, undefined, {});
      return { success: true };
    }),

  /** Recent egress attempts (allowed + blocked) for the live audit feed. */
  getLogs: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      const logs = await db
        .select({
          id: proxyLogs.id,
          provider: proxyLogs.provider,
          endpoint: proxyLogs.endpoint,
          method: proxyLogs.method,
          statusCode: proxyLogs.statusCode,
          latencyMs: proxyLogs.latencyMs,
          createdAt: proxyLogs.createdAt,
        })
        .from(proxyLogs)
        .innerJoin(proxySessions, eq(proxyLogs.sessionId, proxySessions.id))
        .innerJoin(vaultKeys, eq(proxySessions.vaultKeyId, vaultKeys.id))
        .where(and(eq(vaultKeys.userId, ctx.dbUserId), eq(vaultKeys.provider, "http")))
        .orderBy(desc(proxyLogs.createdAt))
        .limit(input?.limit ?? 40);

      return logs.map((l) => ({
        ...l,
        blocked: l.statusCode === 403,
      }));
    }),
});
