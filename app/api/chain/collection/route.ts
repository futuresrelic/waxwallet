// ─── Collection analysis API route ───────────────────────────────────────────
// Fetches collection metadata, schemas, and template/asset counts from the
// AtomicAssets endpoint pool, then runs collection analyzers.

import { NextRequest, NextResponse } from 'next/server';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import { pickEndpoint } from '@/lib/endpoint-pool';
import {
  analyzeOwnership,
  analyzeSchemasAndTemplates,
  analyzeMintedAssets,
} from '@/lib/analyzers/collection';
import type {
  CollectionMeta, SchemaInfo, TemplateInfo,
} from '@/lib/analyzers/collection';
import type { AnalyzerResult } from '@/lib/analyzers/types';

export const runtime = 'nodejs';
const COLLECTION_TTL = 60; // seconds

// ── AtomicAssets helpers ──────────────────────────────────────────────────────

async function fetchAA<T>(ep: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ep}/atomicassets/v1/${path}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; data?: T };
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const name    = req.nextUrl.searchParams.get('name');
  const account = req.nextUrl.searchParams.get('account') ?? '';
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

  if (!name) {
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  }

  const cacheKey = buildCacheKey('chain:collection', { name, account });

  if (!refresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) return NextResponse.json({ success: true, data: cached, cached: true });
  }

  const ep = pickEndpoint();

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const [collectionRaw, schemasRaw, templatesPage1, assetsPage1, mintedPage1] = await Promise.all([
    fetchAA<CollectionMeta>(ep, `collections/${encodeURIComponent(name)}`),
    fetchAA<SchemaInfo[]>(ep, `schemas?collection_name=${encodeURIComponent(name)}&limit=1000`),
    fetchAA<TemplateInfo[]>(ep, `templates?collection_name=${encodeURIComponent(name)}&limit=1000&page=1`),
    // Total asset count (first page, limit=1 — just checking existence)
    fetchAA<unknown[]>(ep, `assets?collection_name=${encodeURIComponent(name)}&limit=1000&page=1`),
    // Assets minted by this account (authorized_minter filter)
    account
      ? fetchAA<unknown[]>(ep, `assets?collection_name=${encodeURIComponent(name)}&authorized_minter=${encodeURIComponent(account)}&limit=1000&page=1`)
      : Promise.resolve(null),
  ]);

  if (!collectionRaw) {
    return NextResponse.json(
      { success: false, error: `Collection "${name}" not found or AtomicAssets unavailable.` },
      { status: 404 },
    );
  }

  const schemas    = schemasRaw ?? [];
  const templates  = templatesPage1 ?? [];
  const assets     = assetsPage1 ?? [];
  const minted     = mintedPage1;  // null if no account specified

  const schemaCount   = schemas.length;
  const templateCount = templates.length; // may be capped at 1000
  const assetCount    = assets.length;    // first-page count
  const mintedCount   = minted !== null ? minted.length : null;

  // ── Run analyzers ─────────────────────────────────────────────────────────
  const results: AnalyzerResult[] = [];

  // 1. Ownership / roles
  const ownershipResult = analyzeOwnership(collectionRaw, account);
  const role = ownershipResult.role;
  results.push(ownershipResult);

  // 2. Schemas & templates
  results.push(
    analyzeSchemasAndTemplates(
      schemas,
      templates as TemplateInfo[],
      schemaCount,
      templateCount,
      role,
    ),
  );

  // 3. Minted assets
  results.push(
    analyzeMintedAssets(name, {
      totalInCollection: assetCount,
      mintedByAccount: mintedCount,
      canDetermineRamPayer: mintedCount !== null,
    }, role),
  );

  const payload = {
    collection: collectionRaw,
    account: account || null,
    role,
    schemaCount,
    templateCount,
    assetCount,
    mintedCount,
    analyzers: results,
    endpoint: ep,
  };

  await cacheSet(cacheKey, payload, COLLECTION_TTL);
  return NextResponse.json({ success: true, data: payload, cached: false });
}
