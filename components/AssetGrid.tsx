'use client';
import { AssetCard } from './AssetCard';
import { PageSpinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import type { AssetData, AssetFilters } from '@/lib/types';

interface AssetGridProps {
  assets: AssetData[];
  isLoading: boolean;
  error: string | null;
  filters: AssetFilters;
  onPageChange: (page: number) => void;
  hasMore: boolean;
}

export function AssetGrid({ assets, isLoading, error, filters, onPageChange, hasMore }: AssetGridProps) {
  if (isLoading) return <PageSpinner />;

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
    <div className="flex flex-col gap-6">
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {assets.map((asset) => (
          <AssetCard key={asset.asset_id} asset={asset} />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={filters.page <= 1}
          onClick={() => onPageChange(filters.page - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Button>
        <span className="text-sm text-zinc-400">
          Page {filters.page} · {assets.length} assets
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(filters.page + 1)}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
