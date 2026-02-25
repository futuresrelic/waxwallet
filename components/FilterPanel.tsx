'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown, LayoutList, LayoutGrid } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Combobox } from './ui/Combobox';
import { cn } from '@/lib/utils';
import { SORT_OPTIONS, type AssetFilters, type SortOption } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: AssetFilters;
  onChange: (filters: Partial<AssetFilters>) => void;
  collections: Array<{ collection: { collection_name: string; name: string }; assets: number }>;
  schemas: Array<{ schema_name: string }>;
  onClear: () => void;
  /** Dynamic attribute facets: fieldName → { value → count }; rendered automatically */
  attributeFacets?: Record<string, Record<string, number>>;
  facetsScanned?: number;
  facetsCapped?: boolean;
  /** Schema asset counts from facets scan — shown next to schema chips */
  schemaCounts?: Record<string, number>;
}

type FilterMode = 'dropdown' | 'chips';

const STORAGE_KEY = 'wax-filter-mode';
function getStoredMode(): FilterMode {
  if (typeof window === 'undefined') return 'dropdown';
  return (localStorage.getItem(STORAGE_KEY) as FilterMode) ?? 'dropdown';
}

// ─── Applied filter chip ──────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full px-2 py-0.5 max-w-full">
      <span className="truncate">{label}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="shrink-0 text-amber-400/70 hover:text-white transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterPanel({
  filters,
  onChange,
  collections,
  schemas,
  onClear,
  attributeFacets = {},
  facetsScanned,
  facetsCapped,
  schemaCounts,
}: FilterPanelProps) {
  const [searchValue, setSearchValue] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter mode: 'dropdown' (default) or 'chips'
  const [mode, setMode] = useState<FilterMode>('dropdown');

  // Hydrate mode from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setMode(getStoredMode());
  }, []);

  const toggleMode = () => {
    const next: FilterMode = mode === 'dropdown' ? 'chips' : 'dropdown';
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

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

  // ── Toggle helpers ───────────────────────────────────────────────────────

  const toggleCollection = (name: string) => {
    const next = safeFilterCols.includes(name)
      ? safeFilterCols.filter(c => c !== name)
      : [...safeFilterCols, name];
    onChange({ collections: next, schemas: [], page: 1 });
  };

  const toggleSchema = (name: string) => {
    const next = safeFilterSchs.includes(name)
      ? safeFilterSchs.filter(s => s !== name)
      : [...safeFilterSchs, name];
    onChange({ schemas: next, page: 1 });
  };

  const toggleAttribute = (key: string, value: string) => {
    const current = filters.attributes ?? {};
    const next = { ...current };
    if (next[key] === value) { delete next[key]; }
    else { next[key] = value; }
    onChange({ attributes: Object.keys(next).length > 0 ? next : undefined, page: 1 });
  };

  // ── Active filter summary (for applied-chips strip) ──────────────────────

  // Defensive normalization: props must be arrays; wrong API shapes degrade gracefully
  const safeCollections = Array.isArray(collections) ? collections : [];
  const safeSchemas     = Array.isArray(schemas)     ? schemas     : [];
  const safeFilterCols  = Array.isArray(filters.collections) ? filters.collections : [];
  const safeFilterSchs  = Array.isArray(filters.schemas)     ? filters.schemas     : [];

  const removeCollection = (c: string) =>
    onChange({ collections: safeFilterCols.filter(x => x !== c), schemas: [], page: 1 });
  const removeSchema = (s: string) =>
    onChange({ schemas: safeFilterSchs.filter(x => x !== s), page: 1 });
  const removeAttribute = (key: string) => {
    const next = { ...(filters.attributes ?? {}) };
    delete next[key];
    onChange({ attributes: Object.keys(next).length > 0 ? next : undefined, page: 1 });
  };

  const activeFilters = [
    ...safeFilterCols.map(c => ({
      key: `col:${c}`,
      label: safeCollections.find(x => x.collection.collection_name === c)?.collection.name || c,
      onRemove: () => removeCollection(c),
    })),
    ...safeFilterSchs.map(s => ({
      key: `sch:${s}`,
      label: s,
      onRemove: () => removeSchema(s),
    })),
    ...Object.entries(filters.attributes ?? {}).map(([k, v]) => ({
      key: `attr:${k}`,
      label: `${k.replace(/_/g, ' ')}: ${v}`,
      onRemove: () => removeAttribute(k),
    })),
    ...(filters.mediaType !== 'all'
      ? [{ key: 'media', label: `Media: ${filters.mediaType}`, onRemove: () => onChange({ mediaType: 'all', page: 1 }) }]
      : []),
    ...(filters.showBurned
      ? [{ key: 'burned', label: 'Burned', onRemove: () => onChange({ showBurned: false, page: 1 }) }]
      : []),
  ];

  const hasActiveFilters = activeFilters.length > 0 || !!filters.search || !!filters.templateId;

  // ── Combobox option builders ─────────────────────────────────────────────

  const collectionOptions = safeCollections.map(({ collection, assets }) => ({
    value: collection.collection_name,
    label: collection.name || collection.collection_name,
    count: assets,
  }));

  const schemaOptions = safeSchemas.map(({ schema_name }) => ({
    value: schema_name,
    label: schema_name,
    count: schemaCounts?.[schema_name],
  }));

  // Guard attributeFacets: each inner value must be an object (Record<string,number>)
  const safeFacets: Record<string, Record<string, number>> =
    attributeFacets && typeof attributeFacets === 'object' ? attributeFacets : {};
  const attributeEntries = Object.entries(safeFacets).filter(
    ([, v]) => v !== null && v !== undefined && typeof v === 'object',
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">

      {/* ── Panel header: title + mode toggle ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Filters</span>
        <button
          onClick={toggleMode}
          title={mode === 'dropdown' ? 'Switch to chip mode' : 'Switch to dropdown mode'}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-1.5 py-1 rounded hover:bg-zinc-800"
        >
          {mode === 'dropdown'
            ? <><LayoutGrid className="w-3.5 h-3.5" /><span>Chips</span></>
            : <><LayoutList className="w-3.5 h-3.5" /><span>Dropdowns</span></>}
        </button>
      </div>

      {/* ── Applied filter summary ── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilters.map(f => (
            <FilterChip key={f.key} label={f.label} onRemove={f.onRemove} />
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={onClear}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors px-1 py-0.5"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Search ── */}
      <Input
        placeholder="Search by name…"
        value={searchValue}
        onChange={e => handleSearch(e.target.value)}
        leftIcon={<Search className="w-4 h-4" />}
      />

      {/* ── Sort ── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">Sort</label>
        <div className="relative">
          <select
            value={filters.sortBy}
            onChange={e => onChange({ sortBy: e.target.value as SortOption, page: 1 })}
            className="w-full appearance-none bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Media type ── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">Media Type</label>
        <div className="flex gap-2">
          {(['all', 'image', 'video'] as const).map(t => (
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

      {/* ── Burned toggle ── */}
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

      {/* ═══════════════════════════════════════════
          DROPDOWN MODE
      ═══════════════════════════════════════════ */}
      {mode === 'dropdown' && (
        <>
          {/* Collections dropdown — always rendered; disabled state when data not yet loaded */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">
              Collections{collectionOptions.length > 0 ? ` (${collectionOptions.length})` : ''}
            </label>
            {collectionOptions.length > 0 ? (
              <Combobox
                options={collectionOptions}
                value={safeFilterCols}
                onChange={vals => onChange({ collections: vals, schemas: [], page: 1 })}
                placeholder="Filter collections…"
                multiple
              />
            ) : (
              <div className="flex items-center w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/40 text-sm text-zinc-600 cursor-not-allowed select-none">
                No collections
              </div>
            )}
          </div>

          {/* Schemas dropdown */}
          {schemaOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wide">Schemas</label>
              <Combobox
                options={schemaOptions}
                value={safeFilterSchs}
                onChange={vals => onChange({ schemas: vals, page: 1 })}
                placeholder="Filter schemas…"
                multiple
              />
            </div>
          )}

          {/* Template ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">Template ID</label>
            <Input
              placeholder="e.g. 12345"
              value={filters.templateId}
              onChange={e => onChange({ templateId: e.target.value, page: 1 })}
            />
          </div>

          {/* Dynamic attribute dropdowns */}
          {attributeEntries.map(([key, valueCounts]) => {
            const opts = Object.entries(valueCounts).map(([v, count]) => ({
              value: v,
              label: v,
              count,
            }));
            const selected = filters.attributes?.[key];
            return (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 uppercase tracking-wide">
                  {key.replace(/_/g, ' ')}
                </label>
                <Combobox
                  options={opts}
                  value={selected ? [selected] : []}
                  onChange={vals => {
                    const current = filters.attributes ?? {};
                    const next = { ...current };
                    if (vals.length === 0) { delete next[key]; }
                    else { next[key] = vals[0]; }
                    onChange({ attributes: Object.keys(next).length > 0 ? next : undefined, page: 1 });
                  }}
                  placeholder={`Any ${key.replace(/_/g, ' ')}…`}
                />
              </div>
            );
          })}
          {facetsCapped && facetsScanned && attributeEntries.length > 0 && (
            <p className="text-[10px] text-zinc-600">
              Attributes sampled from first {facetsScanned.toLocaleString()} assets
            </p>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════
          CHIPS MODE (legacy)
      ═══════════════════════════════════════════ */}
      {mode === 'chips' && (
        <>
          {/* Collections chips — always rendered; empty state when data not yet loaded */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">
              Collections{safeCollections.length > 0 ? ` (${safeCollections.length})` : ''}
            </label>
            {safeCollections.length === 0 ? (
              <p className="text-xs text-zinc-600 italic px-1">No collections</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                {safeCollections.map(({ collection, assets }) => (
                  <button
                    key={collection.collection_name}
                    onClick={() => toggleCollection(collection.collection_name)}
                    className={cn(
                      'flex items-center justify-between text-sm px-3 py-1.5 rounded-lg border transition-colors text-left',
                      safeFilterCols.includes(collection.collection_name)
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:text-white hover:bg-zinc-800',
                    )}
                  >
                    <span className="truncate flex-1">{collection.name || collection.collection_name}</span>
                    <span className="text-xs text-zinc-500 ml-2 shrink-0">{assets}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schema chips */}
          {safeSchemas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 uppercase tracking-wide">Schemas</label>
              <div className="flex flex-wrap gap-1.5">
                {safeSchemas.map(({ schema_name }) => {
                  const count = schemaCounts?.[schema_name];
                  return (
                    <button
                      key={schema_name}
                      onClick={() => toggleSchema(schema_name)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-colors',
                        safeFilterSchs.includes(schema_name)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white',
                      )}
                    >
                      {schema_name}
                      {count !== undefined && <span className="opacity-60 ml-1">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Template ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">Template ID</label>
            <Input
              placeholder="e.g. 12345"
              value={filters.templateId}
              onChange={e => onChange({ templateId: e.target.value, page: 1 })}
            />
          </div>

          {/* Attribute chips */}
          {attributeEntries.map(([key, valueCounts]) => {
            const selected = filters.attributes?.[key];
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-500 uppercase tracking-wide">
                  {key.replace(/_/g, ' ')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(valueCounts).map(([value, count]) => (
                    <button
                      key={value}
                      onClick={() => toggleAttribute(key, value)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-colors',
                        selected === value
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white',
                      )}
                    >
                      {value} <span className="opacity-60">({count})</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {facetsCapped && facetsScanned && attributeEntries.length > 0 && (
            <p className="text-[10px] text-zinc-600">
              Attributes sampled from first {facetsScanned.toLocaleString()} assets
            </p>
          )}
        </>
      )}

      {/* ── Clear all (shown only when no chips strip, i.e. only search/templateId active) ── */}
      {hasActiveFilters && activeFilters.length === 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
          <X className="w-3.5 h-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
