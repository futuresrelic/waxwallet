'use client';
import { ExternalLink } from 'lucide-react';
import { MediaViewer } from './MediaViewer';
import { Badge } from './ui/Badge';
import { cn } from '@/lib/utils';
import type { TemplateStack, TemplateLink } from '@/lib/types';

interface TemplateCardProps {
  stack: TemplateStack;
  /** Admin-configured template links for this template_id (optional). */
  templateLinks?: TemplateLink[];
  className?: string;
}

export function TemplateCard({ stack, templateLinks, className }: TemplateCardProps) {
  const supplyLabel = stack.max_supply === '0' ? '∞' : stack.max_supply;

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/80 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200',
        className,
      )}
    >
      {/* Quantity badge – top-right corner */}
      <div className="absolute top-2 right-2 z-10">
        <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold font-mono">
          ×{stack.count}
        </span>
      </div>

      {/* Media */}
      <div className="relative aspect-square overflow-hidden bg-zinc-800/50">
        <MediaViewer
          url={stack.image_url}
          type={stack.image_type}
          name={stack.name}
          fill
          className="group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <p className="text-sm font-medium text-white truncate" title={stack.name}>
          {stack.name}
        </p>
        <p className="text-xs text-zinc-400 truncate">{stack.collection_display_name}</p>
        <div className="flex items-center gap-1 flex-wrap mt-1">
          <Badge variant="default">{stack.schema_name}</Badge>
          <Badge variant="default">T#{stack.template_id}</Badge>
          <Badge variant="amber">{supplyLabel} supply</Badge>
        </div>

        {/* Template links – admin-configured, open in new tab */}
        {templateLinks && templateLinks.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {templateLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:underline"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                {link.label || 'View'}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
