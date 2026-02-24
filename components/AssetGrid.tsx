'use client';
import { useEffect, useRef } from 'react';
import { AssetCard } from './AssetCard';
import { PageSpinner, Spinner } from './ui/Spinner';
import { AlertTriangle } from 'lucide-react';
import type { AssetData, TemplateLink } from '@/lib/types';

interface AssetGridProps {
  assets: AssetData[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  /** template_id → TemplateLink[] map for link decoration (optional) */
  templateLinksMap?: Map<string, TemplateLink[]>;
}

export function AssetGrid({
  assets,
  isLoading,
  error,
  hasMore,
  isFetchingMore,
  onLoadMore,
  templateLinksMap,
}: AssetGridProps) {
  // Intersection-observer sentinel at the bottom of the grid
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '300px' }, // start loading before user reaches bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, onLoadMore]);

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

      {/* Infinite-scroll sentinel + status */}
      <div ref={sentinelRef} className="flex items-center justify-center py-4 min-h-[48px]">
        {isFetchingMore && (
          <span className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner size="sm" /> Loading more…
          </span>
        )}
        {!hasMore && assets.length > 0 && (
          <p className="text-xs text-zinc-600">All {assets.length} assets loaded</p>
        )}
      </div>
    </div>
  );
}
