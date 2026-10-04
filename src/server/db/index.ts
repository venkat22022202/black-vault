import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Neon URLs use Neon's HTTP driver (serverless-friendly). Any other Postgres
 * (local, Docker, RDS, Supabase…) uses node-postgres. Override with
 * DATABASE_DRIVER=neon|pg.
 */
function shouldUseNeonDriver(url: string): boolean {
  const driver = process.env.DATABASE_DRIVER;
  if (driver === "neon") return true;
  if (driver === "pg") return false;
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Please add it to your .env.local file."
    );
  }
  if (shouldUseNeonDriver(url)) {
    return drizzle(neon(url), { schema });
  }
  // The app only uses the query builder shared by both drivers (no
  // driver-specific transactions/batches), so expose one type to callers.
  return drizzlePg(new Pool({ connectionString: url, max: 10 }), {
    schema,
  }) as unknown as ReturnType<typeof drizzle<typeof schema>>;
}

// Lazy singleton - only connects when first accessed
let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

// For backwards compatibility - use getter
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = ReturnType<typeof createDb>;
