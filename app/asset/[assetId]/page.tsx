'use client';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Flame } from 'lucide-react';
import { MediaViewer } from '@/components/MediaViewer';
import { AttributeList, RawJson } from '@/components/AttributeList';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { getAssetMedia, getAssetName, type AssetData } from '@/lib/types';
import { formatMint, formatTimestamp } from '@/lib/utils';
import { useState } from 'react';

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`text-zinc-500 hover:text-white transition-colors ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

async function fetchAsset(assetId: string): Promise<AssetData> {
  const res = await fetch(`/api/asset/${assetId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Asset not found');
  return json.data as AssetData;
}

export default function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const router = useRouter();

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => fetchAsset(assetId),
  });

  if (isLoading) return <PageSpinner />;

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-red-400 text-lg">Failed to load asset</p>
        <p className="text-zinc-500 text-sm">{String(error)}</p>
        <Button variant="secondary" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  const { url, type } = getAssetMedia(asset);
  const name = getAssetName(asset);
  const mint = formatMint(asset.template_mint);
  const isBurned = !!asset.burned_by_account;

  const mergedData = {
    ...asset.immutable_data,
    ...asset.mutable_data,
    ...asset.data,
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Media */}
        <div className="flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-square">
            <MediaViewer url={url} type={type} name={name} fill />
            {isBurned && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Flame className="w-10 h-10 text-red-400" />
                  <span className="text-red-400 font-bold">Burned</span>
                </div>
              </div>
            )}
          </div>

          {/* Asset ID */}
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-xs text-zinc-500">Asset ID</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">{assetId}</span>
              <CopyButton text={assetId} />
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col gap-4">
          {/* Name + badges */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 flex-wrap">
              {isBurned && <Badge variant="red">Burned</Badge>}
              {mint && <Badge variant="amber">Mint {mint}</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-white">{name}</h1>
            <Link
              href={`/wallet/${asset.owner}`}
              className="text-sm text-amber-400 hover:text-amber-300 font-mono"
            >
              @{asset.owner}
            </Link>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Collection', value: asset.collection.name || asset.collection.collection_name, link: null },
              { label: 'Schema', value: asset.schema.schema_name, link: null },
              { label: 'Template', value: asset.template?.template_id ? `#${asset.template.template_id}` : '—', link: null },
              { label: 'Max Supply', value: asset.template?.max_supply === '0' ? '∞' : (asset.template?.max_supply ?? '—'), link: null },
              { label: 'Issued Supply', value: asset.template?.issued_supply ?? '—', link: null },
              { label: 'Minted', value: formatTimestamp(asset.minted_at_time), link: null },
              { label: 'Transferred', value: formatTimestamp(asset.transferred_at_time), link: null },
              { label: 'Transferable', value: asset.is_transferable ? 'Yes' : 'No', link: null },
              { label: 'Burnable', value: asset.is_burnable ? 'Yes' : 'No', link: null },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                <span className="text-xs text-zinc-500">{label}</span>
                <span className="text-sm text-white font-medium truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* Backed tokens */}
          {asset.backed_tokens?.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 mb-2">Backed Tokens</p>
              {asset.backed_tokens.map((t) => (
                <p key={t.token_symbol} className="text-sm text-white">
                  {t.amount} {t.token_symbol}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attributes */}
      <div className="flex flex-col gap-3">
        {Object.keys(mergedData).length > 0 && (
          <AttributeList data={mergedData} title="Attributes" defaultOpen />
        )}
        {asset.template?.immutable_data && Object.keys(asset.template.immutable_data).length > 0 && (
          <AttributeList data={asset.template.immutable_data} title="Template Attributes" defaultOpen={false} />
        )}
        {asset.mutable_data && Object.keys(asset.mutable_data).length > 0 && (
          <AttributeList data={asset.mutable_data} title="Mutable Data" defaultOpen={false} />
        )}
        <RawJson data={asset} title="Raw Asset Data" />
      </div>
    </div>
  );
}
