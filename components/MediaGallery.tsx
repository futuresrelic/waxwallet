'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Play, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IPFS_GATEWAYS, type MediaItem } from '@/lib/types';

interface MediaGalleryProps {
  items: MediaItem[];
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveGateway(url: string, gwIdx: number): string {
  for (const gw of IPFS_GATEWAYS) {
    if (url.startsWith(gw)) {
      return `${IPFS_GATEWAYS[gwIdx]}${url.slice(gw.length)}`;
    }
  }
  return url;
}

// ─── Single-item viewers ──────────────────────────────────────────────────────

function MainImage({ url, name }: { url: string; name: string }) {
  const [gwIdx, setGwIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const src = resolveGateway(url, gwIdx);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50 text-zinc-500 text-xs">
        Failed to load image
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      fill
      className="object-contain"
      unoptimized
      onError={() => {
        if (gwIdx < IPFS_GATEWAYS.length - 1) setGwIdx((g) => g + 1);
        else setFailed(true);
      }}
    />
  );
}

function MainVideo({ url, posterUrl }: { url: string; posterUrl?: string }) {
  const [gwIdx, setGwIdx] = useState(0);
  const src = resolveGateway(url, gwIdx);
  return (
    <video
      key={src}
      className="w-full h-full object-contain"
      src={src}
      poster={posterUrl}
      controls
      autoPlay
      loop
      muted
      playsInline
      onError={() => {
        if (gwIdx < IPFS_GATEWAYS.length - 1) setGwIdx((g) => g + 1);
      }}
    />
  );
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function Thumb({ item, active, onClick }: { item: MediaItem; active: boolean; onClick: () => void }) {
  const [gwIdx, setGwIdx] = useState(0);
  const src = resolveGateway(item.url, gwIdx);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors',
        active ? 'border-amber-500' : 'border-zinc-700 hover:border-zinc-500',
      )}
    >
      {item.type === 'video' ? (
        <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
          <Play className="w-5 h-5 text-white" />
        </div>
      ) : (
        <Image
          src={src}
          alt={item.field}
          fill
          className="object-cover"
          unoptimized
          loading="lazy"
          onError={() => {
            if (gwIdx < IPFS_GATEWAYS.length - 1) setGwIdx((g) => g + 1);
          }}
        />
      )}
    </button>
  );
}

// ─── Copy URL button ──────────────────────────────────────────────────────────

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy media URL"
      className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-zinc-400 hover:text-white transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

export function MediaGallery({ items, name }: MediaGalleryProps) {
  const [selected, setSelected] = useState(0);

  if (items.length === 0) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-square flex items-center justify-center text-zinc-600">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  const current = items[Math.min(selected, items.length - 1)];

  // Use the first image in the gallery as video poster
  const firstImage = items.find((i) => i.type === 'image');

  return (
    <div className="flex flex-col gap-3">
      {/* Main viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-square">
        {current.type === 'video' ? (
          <MainVideo url={current.url} posterUrl={firstImage?.url} />
        ) : (
          <MainImage url={current.url} name={name} />
        )}
        <CopyUrlButton url={current.url} />
      </div>

      {/* Thumbnail strip — only rendered when there are multiple items */}
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <Thumb key={`${item.field}-${i}`} item={item} active={i === selected} onClick={() => setSelected(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
