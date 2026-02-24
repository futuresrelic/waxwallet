'use client';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { MediaViewer } from './MediaViewer';
import { Badge } from './ui/Badge';
import { cn, formatMint } from '@/lib/utils';
import { getAssetMedia, getAssetName, type AssetData, type TemplateLink } from '@/lib/types';

interface AssetCardProps {
  asset: AssetData;
  /** Template link configured by admin for this asset's template_id (optional). */
  templateLink?: TemplateLink;
  className?: string;
}

export function AssetCard({ asset, templateLink, className }: AssetCardProps) {
  const { url, type } = getAssetMedia(asset);
  const name = getAssetName(asset);
  const mint = formatMint(asset.template_mint);
  const isBurned = !!asset.burned_by_account;

  return (
    <Link href={`/asset/${asset.asset_id}`}>
      <div
        className={cn(
          'group relative flex flex-col rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/80 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200 cursor-pointer',
          isBurned && 'opacity-60',
          className,
        )}
      >
        {/* Media thumbnail */}
        <div className="relative aspect-square overflow-hidden bg-zinc-800/50">
          <MediaViewer url={url} type={type} name={name} fill className="group-hover:scale-105 transition-transform duration-300" />
          {isBurned && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Badge variant="red">Burned</Badge>
            </div>
          )}
          {mint && (
            <div className="absolute bottom-2 left-2">
              <span className="text-xs bg-black/70 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                {mint}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col gap-1">
          <p className="text-sm font-medium text-white truncate" title={name}>
            {name}
          </p>
          <p className="text-xs text-zinc-400 truncate">
            {asset.collection.name || asset.collection.collection_name}
          </p>
          <div className="flex items-center gap-1 flex-wrap mt-1">
            <Badge variant="default">{asset.schema.schema_name}</Badge>
            {asset.template?.template_id && (
              <Badge variant="default">T#{asset.template.template_id}</Badge>
            )}
          </div>

          {/* Template link – admin-configured, opens in new tab */}
          {templateLink && (
            <a
              href={templateLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:underline"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              {templateLink.label || 'View'}
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}
