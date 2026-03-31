import { NextRequest, NextResponse } from "next/server";
import { authenticateProxyRequest, ProxyAuthError } from "@/server/services/proxy-auth";
import { db } from "@/server/db";
import { vaultKeys } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Max-Age": "86400",
};

/** Models available per provider */
const PROVIDER_MODELS: Record<string, { id: string; created: number }[]> = {
  openai: [
    { id: "gpt-4o", created: 1715367049 },
    { id: "gpt-4o-mini", created: 1721172741 },
    { id: "gpt-4-turbo", created: 1712601677 },
    { id: "gpt-4", created: 1687882411 },
    { id: "gpt-3.5-turbo", created: 1677610602 },
    { id: "o1", created: 1734134400 },
    { id: "o1-mini", created: 1725408000 },
    { id: "o3-mini", created: 1738195200 },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5-20250929", created: 1727568000 },
    { id: "claude-haiku-4-5-20251001", created: 1727740800 },
    { id: "claude-3-5-sonnet-20241022", created: 1729555200 },
    { id: "claude-3-haiku-20240307", created: 1709769600 },
    { id: "claude-3-opus-20240229", created: 1709164800 },
  ],
  google: [
    { id: "gemini-2.0-flash", created: 1733961600 },
    { id: "gemini-1.5-pro", created: 1715299200 },
    { id: "gemini-1.5-flash", created: 1715299200 },
    { id: "gemini-pro", created: 1702425600 },
  ],
  nebius: [
    { id: "deepseek-ai/DeepSeek-R1-0528", created: 1738195200 },
    { id: "meta-llama/Llama-3.1-70B-Instruct", created: 1721692800 },
    { id: "meta-llama/Llama-3.1-8B-Instruct", created: 1721692800 },
    { id: "mistralai/Mixtral-8x22B-Instruct-v0.1", created: 1713312000 },
  ],
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/models — OpenAI-compatible models list.
 * Returns all models available based on the user's active vault keys.
 */
async function handleListModels(request: NextRequest) {
  try {
    // Authenticate
    let authResult;
    try {
      authResult = await authenticateProxyRequest(request);
    } catch (err) {
      if (err instanceof ProxyAuthError) {
        return NextResponse.json(
          { error: { message: err.message, type: "authentication_error" } },
          { status: err.statusCode, headers: CORS_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { message: "Authentication failed", type: "server_error" } },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const { userId } = authResult;

    // Find all active providers for this user
    const keys = await db
      .select({ provider: vaultKeys.provider })
      .from(vaultKeys)
      .where(and(eq(vaultKeys.userId, userId), eq(vaultKeys.isActive, true)));

    const activeProviders = new Set(keys.map((k) => k.provider));

    // Collect all models from active providers
    const models: { id: string; object: string; created: number; owned_by: string }[] = [];
    for (const provider of activeProviders) {
      const providerModels = PROVIDER_MODELS[provider] ?? [];
      for (const m of providerModels) {
        models.push({
          id: m.id,
          object: "model",
          created: m.created,
          owned_by: provider,
        });
      }
    }

    return NextResponse.json(
      { object: "list", data: models },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: { message: "Internal error", type: "server_error", details: err instanceof Error ? err.message : String(err) } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const GET = handleListModels;
