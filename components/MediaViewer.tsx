'use client';
import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { IPFS_GATEWAYS } from '@/lib/types';

interface MediaViewerProps {
  url: string | null;
  type: 'image' | 'video' | 'none';
  name: string;
  className?: string;
  fill?: boolean;
}

export function MediaViewer({ url, type, name, className, fill = false }: MediaViewerProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  function resolveWithGateway(rawUrl: string, gIdx: number): string {
    // If url already has a gateway prefix from gateway 0, swap it
    for (const gw of IPFS_GATEWAYS) {
      if (rawUrl.startsWith(gw)) {
        const hash = rawUrl.slice(gw.length);
        return `${IPFS_GATEWAYS[gIdx]}${hash}`;
      }
    }
    return rawUrl;
  }

  if (!url || type === 'none') {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-zinc-800/50 text-zinc-600',
          fill ? 'absolute inset-0' : 'w-full h-full',
          className,
        )}
      >
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

  const displayUrl = resolveWithGateway(url, gatewayIndex);

  if (type === 'video') {
    return (
      <video
        className={cn('w-full h-full object-contain', className)}
        src={displayUrl}
        autoPlay
        loop
        muted
        playsInline
        onError={() => {
          if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
            setGatewayIndex((g) => g + 1);
          }
        }}
      />
    );
  }

  if (imgError && gatewayIndex >= IPFS_GATEWAYS.length - 1) {
    return (
      <div className={cn('flex items-center justify-center bg-zinc-800/50 text-zinc-600 text-xs', className)}>
        Failed to load image
      </div>
    );
  }

  return (
    <Image
      src={displayUrl}
      alt={name}
      fill={fill}
      width={fill ? undefined : 400}
      height={fill ? undefined : 400}
      className={cn('object-contain', className)}
      unoptimized
      onError={() => {
        if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
          setGatewayIndex((g) => g + 1);
        } else {
          setImgError(true);
        }
      }}
    />
  );
}
