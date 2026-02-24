'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, ExternalLink, SlidersHorizontal, X } from 'lucide-react';
import { AssetGrid } from '@/components/AssetGrid';
import { FilterPanel } from '@/components/FilterPanel';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { DEFAULT_FILTERS, type AssetFilters, type AssetData } from '@/lib/types';
import { buildQueryString } from '@/lib/utils';

interface WalletPageProps {
  params: Promise<{ account: string }>;
}

async function fetchAssets(account: string, filters: AssetFilters): Promise<AssetData[]> {
  const qs = buildQueryString({
    owner: account,
    collection_name: filters.collections.join(',') || undefined,
    schema_name: filters.schemas.join(',') || undefined,
    template_id: filters.templateId || undefined,
    match: filters.search || undefined,
    sort: filters.sortBy,
    page: filters.page,
    limit: filters.limit,
    burned: filters.showBurned ? 'true' : undefined,
  });
  const res = await fetch(`/api/assets?${qs}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Failed to fetch assets');
  return json.data as AssetData[];
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

// Parse filters from URL search params
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
  const page = Number(sp.get('page'));
  if (page > 0) out.page = page;
  const media = sp.get('media');
  if (media === 'image' || media === 'video') out.mediaType = media;
  const burned = sp.get('burned');
  if (burned === 'true') out.showBurned = true;
  return out;
}

// Build URL search params from filters
function filtersToSearch(filters: AssetFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.search) sp.set('q', filters.search);
  if (filters.collections.length) sp.set('c', filters.collections.join(','));
  if (filters.schemas.length) sp.set('s', filters.schemas.join(','));
  if (filters.templateId) sp.set('t', filters.templateId);
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) sp.set('sort', filters.sortBy);
  if (filters.page > 1) sp.set('page', String(filters.page));
  if (filters.mediaType !== 'all') sp.set('media', filters.mediaType);
  if (filters.showBurned) sp.set('burned', 'true');
  return sp;
}

export default function WalletPage({ params }: WalletPageProps) {
  const { account } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<AssetFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...parseFiltersFromSearch(searchParams),
  }));
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync filters to URL
  useEffect(() => {
    const sp = filtersToSearch(filters);
    const qs = sp.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [filters, pathname, router]);

  const handleFiltersChange = useCallback((partial: Partial<AssetFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  // Fetch collections for filter panel
  const { data: collections = [] } = useQuery({
    queryKey: ['collections', account],
    queryFn: () => fetchCollections(account),
    staleTime: 60_000,
  });

  // Fetch schemas based on selected collections
  const { data: schemas = [] } = useQuery({
    queryKey: ['schemas', filters.collections],
    queryFn: () => fetchSchemas(filters.collections),
    enabled: filters.collections.length > 0,
    staleTime: 60_000,
  });

  // Fetch assets
  const {
    data: assets = [],
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['assets', account, filters],
    queryFn: () => fetchAssets(account, filters),
    staleTime: 15_000,
  });

  // Filter by media type client-side (API doesn't support this filter directly)
  const displayAssets =
    filters.mediaType === 'all'
      ? assets
      : assets.filter((a) => {
          const data = { ...a.immutable_data, ...a.mutable_data, ...a.data, ...(a.template?.immutable_data ?? {}) };
          if (filters.mediaType === 'video') return !!(data.video || data.backimg_video);
          if (filters.mediaType === 'image') return !!(data.img || data.image || data.thumbnail) && !(data.video);
          return true;
        });

  const hasMore = assets.length >= filters.limit;
  const totalShown = (filters.page - 1) * filters.limit + displayAssets.length;

  const copyAccount = () => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
                {isFetching && <Spinner size="sm" className="inline mr-1.5" />}
                Showing {displayAssets.length} assets · Page {filters.page}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="md:hidden"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
          <a
            href={`https://wax.atomichub.io/profile/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-3.5 h-3.5" />
              AtomicHub
            </Button>
          </a>
        </div>
      </div>

      {/* Collection chips */}
      {collections.length > 0 && filters.collections.length === 0 && (
        <div className="flex gap-2 flex-wrap">
          {collections.slice(0, 8).map(({ collection, assets: count }) => (
            <button
              key={collection.collection_name}
              onClick={() => handleFiltersChange({ collections: [collection.collection_name], page: 1 })}
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
        {/* Filter sidebar - desktop */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-20">
            <FilterPanel
              filters={filters}
              onChange={handleFiltersChange}
              collections={collections}
              schemas={schemas}
              onClear={handleClearFilters}
            />
          </div>
        </aside>

        {/* Mobile filter panel */}
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
              <FilterPanel
                filters={filters}
                onChange={(f) => { handleFiltersChange(f); }}
                collections={collections}
                schemas={schemas}
                onClear={handleClearFilters}
              />
            </div>
          </div>
        )}

        {/* Asset grid */}
        <div className="flex-1 min-w-0">
          <AssetGrid
            assets={displayAssets}
            isLoading={isLoading}
            error={error instanceof Error ? error.message : null}
            filters={filters}
            onPageChange={(p) => handleFiltersChange({ page: p })}
            hasMore={hasMore}
          />
        </div>
      </div>
    </div>
  );
}
