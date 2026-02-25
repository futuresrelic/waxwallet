'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Copy, Check, ExternalLink, SlidersHorizontal, X, LayoutGrid, Layers } from 'lucide-react';
import { AssetGrid } from '@/components/AssetGrid';
import { TemplateGrid } from '@/components/TemplateGrid';
import { FilterPanel } from '@/components/FilterPanel';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  DEFAULT_FILTERS,
  STACK_SORT_OPTIONS,
  type AssetFilters,
  type AssetData,
  type TemplateStack,
  type TemplateLink,
  type StackMeta,
  type StackSortOption,
} from '@/lib/types';
import { buildQueryString } from '@/lib/utils';

// Suppress unused-import lint warning — ExternalLink used in asset detail links (other files import this indirectly)
void ExternalLink;

interface WalletPageProps {
  params: Promise<{ account: string }>;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchAssetsPage(account: string, filters: AssetFilters, page: number): Promise<AssetData[]> {
  // Build attribute params as a.{key}=value entries
  const attrParams = Object.fromEntries(
    Object.entries(filters.attributes ?? {}).map(([k, v]) => [`a.${k}`, v]),
  );
  const qs = buildQueryString({
    owner: account,
    collection_name: filters.collections.join(',') || undefined,
    schema_name: filters.schemas.join(',') || undefined,
    template_id: filters.templateId || undefined,
    match: filters.search || undefined,
    sort: filters.sortBy,
    page,
    limit: filters.limit,
    burned: filters.showBurned ? 'true' : undefined,
    ...attrParams,
  });
  const res = await fetch(`/api/assets?${qs}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Failed to fetch assets');
  return json.data as AssetData[];
}

interface FacetsResponse {
  attributes: Record<string, Record<string, number>>;
  schemas: Record<string, number>;
  scanned: number;
  capped: boolean;
}

async function fetchFacets(
  account: string,
  collections: string[],
  schemas: string[],
): Promise<FacetsResponse> {
  const qs = buildQueryString({
    owner: account,
    collection_name: collections.join(',') || undefined,
    schema_name: schemas.join(',') || undefined,
  });
  const res = await fetch(`/api/facets?${qs}`);
  const json = await res.json();
  if (!json.success) return { attributes: {}, schemas: {}, scanned: 0, capped: false };
  return json.data as FacetsResponse;
}

async function fetchStack(
  account: string,
  filters: AssetFilters,
  sort: StackSortOption,
  page: number,
  scanAll: boolean,
): Promise<{ data: TemplateStack[]; meta: StackMeta }> {
  const qs = buildQueryString({
    owner: account,
    collection_name: filters.collections.join(',') || undefined,
    schema_name: filters.schemas.join(',') || undefined,
    sort,
    page,
    limit: 20,
    scan_pages: scanAll ? 10 : 3,
  });
  const res = await fetch(`/api/stack?${qs}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Failed to fetch template stacks');
  return { data: json.data as TemplateStack[], meta: json.meta as StackMeta };
}

async function fetchCollections(account: string) {
  const res = await fetch(`/api/collections?owner=${account}`);
  const json = await res.json();
  return (json.data?.collections ?? []) as Array<{
    collection: { collection_name: string; name: string };
    assets: number;
  }>;
}

async function fetchSchemas(collectionNames: string[]) {
  if (collectionNames.length === 0) return [];
  const results = await Promise.all(
    collectionNames.map((c) =>
      fetch(`/api/schemas?collection_name=${c}`)
        .then((r) => r.json())
        .then((j) => (j.data ?? []) as Array<{ schema_name: string }>),
    ),
  );
  const seen = new Set<string>();
  return results.flat().filter((s) => {
    if (seen.has(s.schema_name)) return false;
    seen.add(s.schema_name);
    return true;
  });
}

async function fetchTemplateLinks(): Promise<TemplateLink[]> {
  const res = await fetch('/api/template-links');
  const json = await res.json();
  return (json.data ?? []) as TemplateLink[];
}

// ─── URL parsing helpers ──────────────────────────────────────────────────────

function parseFiltersFromSearch(sp: URLSearchParams): Partial<AssetFilters> {
  const out: Partial<AssetFilters> = {};
  const search = sp.get('q');
  if (search !== null) out.search = search;
  const cols = sp.get('c');
  if (cols) out.collections = cols.split(',').filter(Boolean);
  const schemas = sp.get('s');
  if (schemas) out.schemas = schemas.split(',').filter(Boolean);
  const tid = sp.get('t');
  if (tid) out.templateId = tid;
  const sort = sp.get('sort');
  if (sort) out.sortBy = sort as AssetFilters['sortBy'];
  const media = sp.get('media');
  if (media === 'image' || media === 'video') out.mediaType = media;
  const burned = sp.get('burned');
  if (burned === 'true') out.showBurned = true;

  // Dynamic attribute filters encoded as a.{key}={value} URL params
  const attributes: Record<string, string> = {};
  for (const [key, value] of sp.entries()) {
    if (key.startsWith('a.') && value) attributes[key.slice(2)] = value;
  }
  if (Object.keys(attributes).length > 0) out.attributes = attributes;

  return out;
}

function filtersToSearch(
  filters: AssetFilters,
  viewMode: 'grid' | 'stack',
  stackSort: StackSortOption,
  stackPage: number,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.search) sp.set('q', filters.search);
  if (filters.collections.length) sp.set('c', filters.collections.join(','));
  if (filters.schemas.length) sp.set('s', filters.schemas.join(','));
  if (filters.templateId) sp.set('t', filters.templateId);
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) sp.set('sort', filters.sortBy);
  if (filters.mediaType !== 'all') sp.set('media', filters.mediaType);
  if (filters.showBurned) sp.set('burned', 'true');
  // Encode dynamic attributes as a.{key}={value}
  for (const [key, value] of Object.entries(filters.attributes ?? {})) {
    if (value) sp.set(`a.${key}`, value);
  }
  if (viewMode === 'stack') sp.set('view', 'stack');
  if (viewMode === 'stack' && stackSort !== 'count:desc') sp.set('ssort', stackSort);
  if (viewMode === 'stack' && stackPage > 1) sp.set('spage', String(stackPage));
  return sp;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WalletPage({ params }: WalletPageProps) {
  const { account } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<AssetFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...parseFiltersFromSearch(searchParams),
  }));
  const [viewMode, setViewMode] = useState<'grid' | 'stack'>(() =>
    searchParams.get('view') === 'stack' ? 'stack' : 'grid',
  );
  const [stackSort, setStackSort] = useState<StackSortOption>(() => {
    const s = searchParams.get('ssort');
    return STACK_SORT_OPTIONS.some((o) => o.value === s) ? (s as StackSortOption) : 'count:desc';
  });
  const [stackPage, setStackPage] = useState(() => Math.max(1, Number(searchParams.get('spage') ?? 1)));
  const [stackScanAll, setStackScanAll] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync all state to URL (page number not synced for grid — uses infinite scroll)
  useEffect(() => {
    const sp = filtersToSearch(filters, viewMode, stackSort, stackPage);
    const qs = sp.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [filters, viewMode, stackSort, stackPage, pathname, router]);

  const handleFiltersChange = useCallback((partial: Partial<AssetFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const handleViewToggle = useCallback((mode: 'grid' | 'stack') => {
    setViewMode(mode);
    if (mode === 'stack') { setStackPage(1); setStackScanAll(false); }
  }, []);

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', account],
    queryFn: () => fetchCollections(account),
    staleTime: 60_000,
  });

  const { data: schemas = [] } = useQuery({
    queryKey: ['schemas', filters.collections],
    queryFn: () => fetchSchemas(filters.collections),
    enabled: filters.collections.length > 0,
    staleTime: 60_000,
  });

  // Infinite-scroll asset query (grid view)
  // Page number is managed by the infinite query, not filters.page
  const infiniteKey = useMemo(
    () => ({
      owner: account,
      search: filters.search,
      collections: filters.collections,
      schemas: filters.schemas,
      templateId: filters.templateId,
      showBurned: filters.showBurned,
      sortBy: filters.sortBy,
      limit: filters.limit,
      attributes: filters.attributes,
    }),
    [filters, account],
  );

  const {
    data: assetsData,
    isLoading: assetsLoading,
    error: assetsError,
    isFetching: assetsFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['assets-infinite', infiniteKey],
    queryFn: ({ pageParam }) => fetchAssetsPage(account, filters, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= filters.limit ? allPages.length + 1 : undefined,
    enabled: viewMode === 'grid',
    staleTime: 15_000,
  });

  // Flatten all pages into a single array
  const allAssets = useMemo(() => assetsData?.pages.flat() ?? [], [assetsData]);

  // Stack-view aggregated templates
  const {
    data: stackResult,
    isLoading: stackLoading,
    error: stackError,
    isFetching: stackFetching,
  } = useQuery({
    queryKey: ['stack', account, filters.collections, filters.schemas, stackSort, stackPage, stackScanAll],
    queryFn: () => fetchStack(account, filters, stackSort, stackPage, stackScanAll),
    enabled: viewMode === 'stack',
    staleTime: 60_000,
    // Auto-poll every 3s while the server is indexing the full wallet in the background
    refetchInterval: (query) => (query.state.data?.meta.indexing ? 3_000 : false),
  });

  // Dynamic attribute facets (server-backed counts)
  const { data: facetsData } = useQuery({
    queryKey: ['facets', account, filters.collections, filters.schemas],
    queryFn: () => fetchFacets(account, filters.collections, filters.schemas),
    staleTime: 60_000,
  });

  // Template links (both views)
  const { data: templateLinksRaw = [] } = useQuery({
    queryKey: ['templateLinks'],
    queryFn: fetchTemplateLinks,
    staleTime: 300_000,
  });

  // Group template links by template_id to support multiple links per template
  const templateLinksMap = useMemo(() => {
    const map = new Map<string, TemplateLink[]>();
    for (const link of templateLinksRaw) {
      const existing = map.get(link.template_id) ?? [];
      existing.push(link);
      map.set(link.template_id, existing);
    }
    return map;
  }, [templateLinksRaw]);

  // ── Client-side filters applied to loaded assets ──────────────────────────
  // (media type filter is client-only; attribute filters are server-filtered via a.{key}=value params)
  const displayAssets = useMemo(() => {
    if (filters.mediaType === 'all') return allAssets;
    return allAssets.filter((a) => {
      const data = { ...a.immutable_data, ...a.mutable_data, ...a.data, ...(a.template?.immutable_data ?? {}) };
      if (filters.mediaType === 'video') return !!(data.video || data.backimg_video);
      if (filters.mediaType === 'image') return !!(data.img || data.image || data.thumbnail) && !(data.video);
      return true;
    });
  }, [allAssets, filters.mediaType]);

  const isLoading = viewMode === 'grid' ? assetsLoading : stackLoading;
  const isFetching = viewMode === 'grid' ? assetsFetching : stackFetching;

  const copyAccount = () => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const filterPanelProps = {
    filters,
    onChange: handleFiltersChange,
    collections,
    schemas,
    attributeFacets: facetsData?.attributes,
    facetsScanned: facetsData?.scanned,
    facetsCapped: facetsData?.capped,
    schemaCounts: facetsData?.schemas,
    onClear: handleClearFilters,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white font-mono">{account}</h1>
            <button onClick={copyAccount} className="text-zinc-500 hover:text-white transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-sm text-zinc-400">
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" /> Loading...
              </span>
            ) : (
              <>
                {isFetching && !isFetchingNextPage && <Spinner size="sm" className="inline mr-1.5" />}
                {viewMode === 'grid'
                  ? `${displayAssets.length} assets loaded${hasNextPage ? ' · scroll for more' : ''}`
                  : `${stackResult?.meta.total ?? 0} unique templates`}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden">
            <button
              onClick={() => handleViewToggle('grid')}
              title="Asset grid view"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Assets</span>
            </button>
            <button
              onClick={() => handleViewToggle('stack')}
              title="Stack by template"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-zinc-700 ${
                viewMode === 'stack'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Templates</span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="md:hidden"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Collection quick-chips (only in grid view, no active collection filters) */}
      {viewMode === 'grid' && collections.length > 0 && filters.collections.length === 0 && (
        <div className="flex gap-2 flex-wrap">
          {collections.slice(0, 8).map(({ collection, assets: count }) => (
            <button
              key={collection.collection_name}
              onClick={() => handleFiltersChange({ collections: [collection.collection_name] })}
              className="text-xs px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:border-amber-500/40 hover:text-amber-400 transition-colors"
            >
              {collection.name || collection.collection_name}
              <span className="ml-1.5 text-zinc-500">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Layout */}
      <div className="flex gap-6">
        {/* Filter sidebar – desktop */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-20">
            <FilterPanel {...filterPanelProps} />
          </div>
        </aside>

        {/* Mobile filter drawer */}
        {showFilterPanel && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilterPanel(false)} />
            <div className="absolute right-0 top-0 h-full w-80 max-w-full bg-zinc-950 border-l border-zinc-800 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Filters</h3>
                <button onClick={() => setShowFilterPanel(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <FilterPanel {...filterPanelProps} onChange={(f) => { handleFiltersChange(f); }} />
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {viewMode === 'grid' ? (
            <AssetGrid
              assets={displayAssets}
              isLoading={assetsLoading}
              error={assetsError instanceof Error ? assetsError.message : null}
              hasMore={hasNextPage ?? false}
              isFetchingMore={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              templateLinksMap={templateLinksMap}
            />
          ) : (
            <TemplateGrid
              stacks={stackResult?.data ?? []}
              isLoading={stackLoading}
              error={stackError instanceof Error ? stackError.message : null}
              meta={stackResult?.meta ?? null}
              page={stackPage}
              sort={stackSort}
              onPageChange={setStackPage}
              onSortChange={(s) => { setStackSort(s); setStackPage(1); }}
              templateLinksMap={templateLinksMap}
              onLoadAll={() => { setStackScanAll(true); setStackPage(1); }}
              isLoadingAll={stackScanAll && stackFetching}
            />
          )}
        </div>
      </div>
    </div>
  );
}
