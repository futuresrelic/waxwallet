'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { SORT_OPTIONS, type AssetFilters, type SortOption } from '@/lib/types';

interface FilterPanelProps {
  filters: AssetFilters;
  onChange: (filters: Partial<AssetFilters>) => void;
  collections: Array<{ collection: { collection_name: string; name: string }; assets: number }>;
  schemas: Array<{ schema_name: string }>;
  onClear: () => void;
  /** Server-backed rarity facets with counts — shown when non-empty */
  rarityFacets?: { value: string; count: number }[];
  rarityScanned?: number;
  rarityCapped?: boolean;
}

export function FilterPanel({ filters, onChange, collections, schemas, onClear, rarityFacets = [], rarityScanned, rarityCapped }: FilterPanelProps) {
  const [searchValue, setSearchValue] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search changes
  useEffect(() => {
    setSearchValue(filters.search);
  }, [filters.search]);

  const handleSearch = useCallback(
    (val: string) => {
      setSearchValue(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ search: val, page: 1 });
      }, 400);
    },
    [onChange],
  );

  const toggleCollection = (name: string) => {
    const next = filters.collections.includes(name)
      ? filters.collections.filter((c) => c !== name)
      : [...filters.collections, name];
    onChange({ collections: next, schemas: [], page: 1 });
  };

  const toggleSchema = (name: string) => {
    const next = filters.schemas.includes(name)
      ? filters.schemas.filter((s) => s !== name)
      : [...filters.schemas, name];
    onChange({ schemas: next, page: 1 });
  };

  const hasActiveFilters =
    filters.search ||
    filters.collections.length > 0 ||
    filters.schemas.length > 0 ||
    filters.templateId ||
    filters.showBurned ||
    filters.mediaType !== 'all' ||
    !!filters.rarity;

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <Input
        placeholder="Search by name..."
        value={searchValue}
        onChange={(e) => handleSearch(e.target.value)}
        leftIcon={<Search className="w-4 h-4" />}
      />

      {/* Sort */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">Sort</label>
        <div className="relative">
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value as SortOption, page: 1 })}
            className="w-full appearance-none bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {/* Media type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">Media Type</label>
        <div className="flex gap-2">
          {(['all', 'image', 'video'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ mediaType: t, page: 1 })}
              className={cn(
                'flex-1 text-sm py-1.5 rounded-lg border transition-colors',
                filters.mediaType === t
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white',
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Burned toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">Show Burned</label>
        <button
          onClick={() => onChange({ showBurned: !filters.showBurned, page: 1 })}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors',
            filters.showBurned ? 'bg-amber-500' : 'bg-zinc-700',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              filters.showBurned ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      {/* Collections */}
      {collections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">
            Collections ({collections.length})
          </label>
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
            {collections.map(({ collection, assets }) => (
              <button
                key={collection.collection_name}
                onClick={() => toggleCollection(collection.collection_name)}
                className={cn(
                  'flex items-center justify-between text-sm px-3 py-1.5 rounded-lg border transition-colors text-left',
                  filters.collections.includes(collection.collection_name)
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:text-white hover:bg-zinc-800',
                )}
              >
                <span className="truncate flex-1">{collection.name || collection.collection_name}</span>
                <span className="text-xs text-zinc-500 ml-2 shrink-0">{assets}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Schemas (narrows based on selected collections) */}
      {schemas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">Schemas</label>
          <div className="flex flex-wrap gap-1.5">
            {schemas.map(({ schema_name }) => (
              <button
                key={schema_name}
                onClick={() => toggleSchema(schema_name)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  filters.schemas.includes(schema_name)
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white',
                )}
              >
                {schema_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template ID */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">Template ID</label>
        <Input
          placeholder="e.g. 12345"
          value={filters.templateId}
          onChange={(e) => onChange({ templateId: e.target.value, page: 1 })}
        />
      </div>

      {/* Rarity — server-backed facet counts */}
      {rarityFacets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">Rarity</label>
          <div className="flex flex-wrap gap-1.5">
            {rarityFacets.map(({ value, count }) => (
              <button
                key={value}
                onClick={() => onChange({ rarity: filters.rarity === value ? undefined : value, page: 1 })}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  filters.rarity === value
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white',
                )}
              >
                {value} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
          {rarityCapped && rarityScanned && (
            <p className="text-[10px] text-zinc-600">Sampled from first {rarityScanned.toLocaleString()} assets</p>
          )}
        </div>
      )}

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
          <X className="w-3.5 h-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
