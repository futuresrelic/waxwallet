// ─── Collection Schema & Template RAM Analyzer ───────────────────────────────
// Schemas and templates are created by authorized accounts and consume RAM
// that CANNOT be reclaimed (no delete operation exists in AtomicAssets).

import type { AnalyzerResult, CleanupItem } from '../types';

export interface SchemaInfo {
  schema_name: string;
  format: Array<{ name: string; type: string }>;
  created_at_time: string;
}

export interface TemplateInfo {
  template_id: string;
  max_supply: string;
  issued_supply: string;
  is_transferable: boolean;
  is_burnable: boolean;
  created_at_time: string;
}

// Rough RAM estimates based on AtomicAssets contract storage patterns
const BYTES_PER_SCHEMA_BASE   = 500;
const BYTES_PER_SCHEMA_ATTR   = 50;    // per format attribute
const BYTES_PER_TEMPLATE_BASE = 600;
const BYTES_PER_TEMPLATE_DATA = 512;   // average for typical immutable data

// Upper bounds — guards against corrupted/non-numeric API values corrupting estimates
const MAX_SANE_TEMPLATE_COUNT = 10_000_000; // 10M is already extreme
const MAX_SANE_SCHEMA_COUNT   = 100_000;

/** Return n clamped to [0, max] as an integer; 0 if non-finite or negative. */
function clamp(n: number, max: number): number {
  if (!Number.isFinite(n) || isNaN(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
}

export function analyzeSchemasAndTemplates(
  schemas: SchemaInfo[],
  templates: TemplateInfo[],
  schemaCount: number,
  templateCount: number,
  role: { isAuthor: boolean; isAuthorized: boolean },
): AnalyzerResult {
  // Guard against string-concatenated or out-of-range counts from the API
  const safeSchemaCount   = clamp(Number(schemaCount),   MAX_SANE_SCHEMA_COUNT);
  const safeTemplateCount = clamp(Number(templateCount), MAX_SANE_TEMPLATE_COUNT);

  const schemaBytes = schemas.reduce(
    (s, sc) => s + BYTES_PER_SCHEMA_BASE + (sc.format?.length ?? 0) * BYTES_PER_SCHEMA_ATTR,
    0,
  );
  const templateBytes = safeTemplateCount * (BYTES_PER_TEMPLATE_BASE + BYTES_PER_TEMPLATE_DATA);

  const rows: AnalyzerResult['rows'] = [
    {
      label: 'Schemas / Categories',
      value: safeSchemaCount,
      detail: safeSchemaCount > 0
        ? `~${(schemaBytes / 1024).toFixed(1)} KB estimated — schema rows are permanent, cannot be deleted`
        : 'No schemas found',
    },
    {
      label: 'Templates (total)',
      value: safeTemplateCount > 0
        ? safeTemplateCount.toLocaleString()
        : 0,
      detail: safeTemplateCount > 0
        ? `~${(templateBytes / 1024).toFixed(1)} KB estimated — template rows are permanent, cannot be deleted`
        : 'No templates found',
    },
  ];

  // Detail rows for first few schemas
  schemas.slice(0, 5).forEach(sc => {
    rows.push({
      label: `  Schema: ${sc.schema_name}`,
      value: `${sc.format?.length ?? 0} attrs`,
      detail: `~${BYTES_PER_SCHEMA_BASE + (sc.format?.length ?? 0) * BYTES_PER_SCHEMA_ATTR} bytes`,
    });
  });
  if (schemas.length > 5) {
    rows.push({ label: `  … and ${schemas.length - 5} more schemas`, value: '—' });
  }

  const cleanupItems: CleanupItem[] = [];

  if ((role.isAuthor || role.isAuthorized) && (safeSchemaCount > 0 || safeTemplateCount > 0)) {
    if (safeSchemaCount > 0) {
      cleanupItems.push({
        id: 'col_schemas',
        title: `${safeSchemaCount.toLocaleString()} schema${safeSchemaCount > 1 ? 's' : ''} in collection`,
        count: safeSchemaCount,
        estimatedBytes: schemaBytes,
        reclaimable: 'no',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Schemas cannot be deleted in AtomicAssets. This RAM is permanently allocated for the lifetime of the collection. There is no reclaim path.',
        payerNote: 'The authorized account that called createschema is the RAM payer for each schema row.',
        actionLinks: [],
      });
    }

    if (safeTemplateCount > 0) {
      cleanupItems.push({
        id: 'col_templates',
        title: `${safeTemplateCount.toLocaleString()} template${safeTemplateCount > 1 ? 's' : ''} in collection`,
        count: safeTemplateCount,
        estimatedBytes: templateBytes,
        reclaimable: 'no',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Templates cannot be deleted in AtomicAssets. RAM is permanently allocated. The only partial relief is burning all minted assets of a template — this frees the asset rows, NOT the template row itself.',
        payerNote: 'The authorized account that called createtempl is the RAM payer for each template row.',
        actionLinks: [],
      });
    }
  }

  const totalBytes = schemaBytes + templateBytes;
  const severity = totalBytes > 50_000 ? 'warning' : totalBytes > 10_000 ? 'info' : 'ok';

  return {
    id: 'col_schemas_templates',
    title: 'Schemas & Templates',
    description: `${safeSchemaCount.toLocaleString()} schema${safeSchemaCount !== 1 ? 's' : ''}, ${safeTemplateCount.toLocaleString()} template${safeTemplateCount !== 1 ? 's' : ''} — RAM is permanent.`,
    severity,
    confidence: 'likely',
    rows,
    cleanupItems,
    notes: [
      'AtomicAssets does not support deleting schemas or templates — this RAM cannot be reclaimed.',
      totalBytes > 0 ? `Estimated ${(totalBytes / 1024).toFixed(1)} KB permanently allocated.` : null,
    ].filter(Boolean).join(' ') || undefined,
  };
}
