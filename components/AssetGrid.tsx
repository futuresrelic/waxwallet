'use client';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { AssetCard } from './AssetCard';
import { PageSpinner, Spinner } from './ui/Spinner';
import { Button } from './ui/Button';
import type { AssetData, TemplateLink } from '@/lib/types';

interface AssetGridProps {
  assets: AssetData[];
  isLoading: boolean;
  /** true while a background refetch is happening (page already displayed) */
  isFetching: boolean;
  error: string | null;
  page: number;
  /** true when the current page returned a full batch — there may be a next page */
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  /** template_id → TemplateLink[] map for link decoration (optional) */
  templateLinksMap?: Map<string, TemplateLink[]>;
}

export function AssetGrid({
  assets,
  isLoading,
  isFetching,
  error,
  page,
  hasNextPage,
  onPageChange,
  templateLinksMap,
}: AssetGridProps) {
  if (isLoading) return <PageSpinner />;

  // Defensive guard: if the API returned a non-array (shape mismatch / cache corruption)
  // show a recoverable error instead of crashing with "l.map is not a function".
  if (!Array.isArray(assets)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <div>
          <p className="text-white font-medium">Assets data invalid — try refresh</p>
          <p className="text-sm text-zinc-400 mt-1">Unexpected response shape from server</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <div>
          <p className="text-white font-medium">Failed to load assets</p>
          <p className="text-sm text-zinc-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
        <p className="text-zinc-400 text-lg">No assets found</p>
        <p className="text-zinc-600 text-sm">Try adjusting your filters or search term</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {assets.map((asset) => (
          <AssetCard
            key={asset.asset_id}
            asset={asset}
            templateLinks={
              templateLinksMap && asset.template?.template_id
                ? templateLinksMap.get(asset.template.template_id)
                : undefined
            }
          />
        ))}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Button>
        <span className="flex items-center gap-2 text-sm text-zinc-400">
          {isFetching && <Spinner size="sm" />}
          Page {page} · {assets.length} asset{assets.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
