// ─── RAM Analyzer Orchestrator ────────────────────────────────────────────────
// Runs all RAM analyzers in parallel; never throws (returns partial results).

import type { AnalyzerResult, TableQueryFn } from '../types';
import { analyzeCoreEosioTables }    from './coreEosio';
import { analyzeAtomicMarketTables } from './atomicMarket';
import { analyzeAtomicAssetsTables } from './atomicAssets';

export async function runAllRamAnalyzers(
  account: string,
  query: TableQueryFn,
): Promise<AnalyzerResult[]> {
  const settled = await Promise.allSettled([
    analyzeCoreEosioTables(account, query),
    analyzeAtomicMarketTables(account, query),
    analyzeAtomicAssetsTables(account, query),
  ]);

  const ids = ['ram_core_eosio', 'ram_atomicmarket', 'ram_atomicassets'];
  const titles = ['Core EOSIO Tables', 'AtomicMarket Listings & Offers', 'AtomicAssets P2P Offers'];

  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      id: ids[i],
      title: titles[i],
      severity: 'info' as const,
      confidence: 'inferred' as const,
      rows: [],
      error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
    };
  });
}
