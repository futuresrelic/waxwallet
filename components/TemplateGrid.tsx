'use client';
import { ChevronLeft, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { TemplateCard } from './TemplateCard';
import { PageSpinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { STACK_SORT_OPTIONS, type TemplateStack, type TemplateLink, type StackMeta, type StackSortOption } from '@/lib/types';

interface TemplateGridProps {
  stacks: TemplateStack[];
  isLoading: boolean;
  error: string | null;
  meta: StackMeta | null;
  page: number;
  sort: StackSortOption;
  onPageChange: (page: number) => void;
  onSortChange: (sort: StackSortOption) => void;
  templateLinksMap: Map<string, TemplateLink>;
}

export function TemplateGrid({
  stacks,
  isLoading,
  error,
  meta,
  page,
  sort,
  onPageChange,
  onSortChange,
  templateLinksMap,
}: TemplateGridProps) {
  if (isLoading) return <PageSpinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <div>
          <p className="text-white font-medium">Failed to load template stacks</p>
          <p className="text-sm text-zinc-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (stacks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
        <p className="text-zinc-400 text-lg">No templates found</p>
        <p className="text-zinc-600 text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  const hasMore = meta
    ? (page - 1) * (meta.limit ?? 20) + stacks.length < meta.total
    : false;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: count + capped warning + sort */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">
            {meta?.total ?? stacks.length} unique template{meta?.total !== 1 ? 's' : ''}
          </span>
          {meta?.capped && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Info className="w-3 h-3" />
              Large wallet — showing first {meta.totalFetched} assets
            </span>
          )}
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as StackSortOption)}
            className="appearance-none bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
          >
            {STACK_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {stacks.map((stack) => (
          <TemplateCard
            key={stack.template_id}
            stack={stack}
            templateLink={templateLinksMap.get(stack.template_id)}
          />
        ))}
      </div>

      {/* Pagination */}
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
        <span className="text-sm text-zinc-400">
          Page {page} · {stacks.length} template{stacks.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
