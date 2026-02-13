import { db } from "@/server/db";
import { activityLog } from "@/server/db/schema";

/**
 * Fire-and-forget activity logger. Never throws.
 */
export function logActivity(
  userId: string,
  type: string,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>
): void {
  db.insert(activityLog)
    .values({
      userId,
      type,
      title,
      description: description ?? null,
      metadata: metadata ?? {},
    })
    .then(() => {})
    .catch(() => {
      // Swallow errors — activity logging must never break calling mutations
    });
}
