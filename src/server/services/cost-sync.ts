// DEPRECATED: Cost sync is no longer needed.
// Costs are now tracked in real-time via proxyLogs from the proxy gateway.
// This file is kept as a stub to prevent broken imports.

export async function syncCostsForUser(_userId: string): Promise<void> {
  // No-op — real costs come from proxyLogs
}

export async function syncAllUserCosts(): Promise<{ synced: number }> {
  return { synced: 0 };
}
