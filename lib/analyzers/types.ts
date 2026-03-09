// ─── Shared types for the WAX Resource Inspector analyzer system ─────────────

export type AnalyzerSeverity = 'ok' | 'info' | 'warning' | 'critical';
export type AnalyzerConfidence = 'confirmed' | 'likely' | 'inferred';

export interface AnalyzerRow {
  label: string;
  value: string | number;
  detail?: string;
}

export interface AnalyzerResult {
  id: string;
  title: string;
  description?: string;
  severity: AnalyzerSeverity;
  confidence: AnalyzerConfidence;
  rows: AnalyzerRow[];
  notes?: string;
  error?: string;
}

export interface Recommendation {
  id: string;
  severity: AnalyzerSeverity;
  text: string;
  detail?: string;
  action?: string;
}

// ── WAX chain types ───────────────────────────────────────────────────────────

export interface WaxResourceLimit {
  used: number;
  available: number;
  max: number;
}

export interface WaxAccount {
  account_name: string;
  head_block_time?: string;
  cpu_limit: WaxResourceLimit;
  net_limit: WaxResourceLimit;
  ram_quota: number;
  ram_usage: number;
  cpu_weight: number;
  net_weight: number;
  self_delegated_bandwidth?: {
    from: string;
    to: string;
    net_weight: string;
    cpu_weight: string;
  };
  total_resources?: {
    owner: string;
    net_weight: string;
    cpu_weight: string;
    ram_bytes: number;
  };
  refund_request?: {
    owner: string;
    request_time: string;
    net_amount: string;
    cpu_amount: string;
  };
  rex_info?: unknown;
}

export interface HyperionAction {
  timestamp: string;
  block_num: number;
  trx_id: string;
  act: {
    account: string;
    name: string;
    authorization?: Array<{ actor: string; permission: string }>;
    data?: Record<string, unknown>;
  };
  cpu_usage_us?: number;
  net_usage_words?: number;
}

/** Function signature for querying a WAX on-chain table (passed to RAM analyzers). */
export type TableQueryFn = (params: {
  code: string;
  scope: string;
  table: string;
  index_position?: string;
  key_type?: string;
  lower_bound?: string;
  upper_bound?: string;
  limit?: number;
}) => Promise<unknown[]>;
