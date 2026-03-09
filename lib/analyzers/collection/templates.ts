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
const BYTES_PER_SCHEMA_BASE  = 500;
const BYTES_PER_SCHEMA_ATTR  = 50;   // per format attribute
const BYTES_PER_TEMPLATE_BASE = 600;
const BYTES_PER_TEMPLATE_DATA = 512; // average for typical immutable data

export function analyzeSchemasAndTemplates(
  schemas: SchemaInfo[],
  templates: TemplateInfo[],
  schemaCount: number,
  templateCount: number,
  role: { isAuthor: boolean; isAuthorized: boolean },
): AnalyzerResult {
  const schemaBytes = schemas.reduce(
    (s, sc) => s + BYTES_PER_SCHEMA_BASE + (sc.format?.length ?? 0) * BYTES_PER_SCHEMA_ATTR,
    0,
  );
  const templateBytes = templateCount * (BYTES_PER_TEMPLATE_BASE + BYTES_PER_TEMPLATE_DATA);

  const rows: AnalyzerResult['rows'] = [
    {
      label: 'Schemas',
      value: schemaCount,
      detail: schemaCount > 0
        ? `~${(schemaBytes / 1024).toFixed(1)} KB estimated (schema rows are permanent)`
        : 'No schemas found',
    },
    {
      label: 'Templates',
      value: templateCount > 0 ? `${templateCount}${templateCount >= 1000 ? '+' : ''}` : 0,
      detail: templateCount > 0
        ? `~${(templateBytes / 1024).toFixed(1)} KB estimated (template rows are permanent)`
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

  if ((role.isAuthor || role.isAuthorized) && (schemaCount > 0 || templateCount > 0)) {
    if (schemaCount > 0) {
      cleanupItems.push({
        id: 'col_schemas',
        title: `${schemaCount} schema${schemaCount > 1 ? 's' : ''} in collection`,
        count: schemaCount,
        estimatedBytes: schemaBytes,
        reclaimable: 'no',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Schemas cannot be deleted in AtomicAssets. This RAM is permanently allocated for the lifetime of the collection.',
        payerNote: 'The authorized account that called createschema is the RAM payer.',
        actionLinks: [],
      });
    }

    if (templateCount > 0) {
      cleanupItems.push({
        id: 'col_templates',
        title: `${templateCount}${templateCount >= 1000 ? '+' : ''} template${templateCount > 1 ? 's' : ''} in collection`,
        count: templateCount,
        estimatedBytes: templateBytes,
        reclaimable: 'no',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Templates cannot be deleted in AtomicAssets. RAM is permanent. The only partial relief is burning all minted assets of a template (frees asset rows, not the template row).',
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
    description: `${schemaCount} schema${schemaCount !== 1 ? 's' : ''}, ${templateCount}${templateCount >= 1000 ? '+' : ''} template${templateCount !== 1 ? 's' : ''} — RAM is permanent.`,
    severity,
    confidence: 'likely',
    rows,
    cleanupItems,
    notes: [
      'AtomicAssets does not support deleting schemas or templates.',
      totalBytes > 0 ? `Estimated ${(totalBytes / 1024).toFixed(1)} KB allocated permanently.` : null,
    ].filter(Boolean).join(' ') || undefined,
  };
}
