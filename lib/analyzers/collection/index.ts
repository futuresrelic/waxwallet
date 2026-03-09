// ─── Collection Analyzer Orchestrator ────────────────────────────────────────
// Re-exports collection analyzers. The actual orchestration happens in the
// API route (app/api/chain/collection/route.ts) which has AtomicAssets access.

export { analyzeOwnership }         from './ownership';
export { analyzeSchemasAndTemplates } from './templates';
export { analyzeMintedAssets }      from './mintedAssets';
export type { CollectionMeta, AccountRole } from './ownership';
export type { SchemaInfo, TemplateInfo }     from './templates';
export type { MintedAssetsInfo }             from './mintedAssets';
