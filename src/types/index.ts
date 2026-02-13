import type { ProviderId } from "@/lib/constants";

export interface VaultKey {
  id: string;
  provider: ProviderId;
  label: string;
  keyPrefix: string;
  isActive: boolean;
  monthlyBudget: number | null;
  currentSpend: number;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface CostSummary {
  today: number;
  todayChange: number;
  week: number;
  weekChange: number;
  month: number;
  monthChange: number;
}

export interface ProviderSpend {
  provider: ProviderId;
  amount: number;
  percentage: number;
}

export interface ActivityItem {
  id: string;
  provider: ProviderId;
  model: string;
  agent: string;
  tokens: number;
  cost: number;
  timestamp: Date;
}
