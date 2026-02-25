'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImmutableData } from '@/lib/types';

interface AttributeListProps {
  data: ImmutableData;
  title: string;
  defaultOpen?: boolean;
  /** When provided, pivotable attribute values become links to wallet/{owner} with the filter applied. */
  owner?: string;
  /** Collection to pre-select in the pivot URL (optional). */
  collectionName?: string;
}

/** Returns true for short, non-URL, non-IPFS string values that make sense as wallet attribute filters. */
function isPivotable(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 80) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (/^ipfs:\/\//i.test(value)) return false;
  if (/^Qm[a-zA-Z0-9]{40,}/.test(value)) return false; // IPFS CIDv0
  if (/^baf[a-zA-Z0-9]{40,}/i.test(value)) return false; // IPFS CIDv1
  return true;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
    </button>
  );
}

export function AttributeList({ data, title, defaultOpen = true, owner, collectionName }: AttributeListProps) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-300">{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {open && (
        <div className="divide-y divide-zinc-800/50">
          {entries.map(([key, value]) => {
            const strVal = String(value);
            const canPivot = !!owner && isPivotable(value);
            const pivotHref = canPivot
              ? `/wallet/${owner}?a.${encodeURIComponent(key)}=${encodeURIComponent(strVal)}${collectionName ? `&c=${encodeURIComponent(collectionName)}` : ''}`
              : null;
            return (
              <div key={key} className="group flex items-start justify-between px-4 py-2.5 gap-4 hover:bg-zinc-800/30">
                <span className="text-xs text-zinc-500 shrink-0 pt-0.5 min-w-[100px]">{key}</span>
                {pivotHref ? (
                  <Link
                    href={pivotHref}
                    title={`Filter wallet by ${key} = ${strVal}`}
                    className="text-sm text-amber-400 hover:text-amber-300 hover:underline text-right break-all transition-colors"
                  >
                    {strVal}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-200 text-right break-all">{strVal}</span>
                )}
                <CopyButton value={strVal} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RawJsonProps {
  data: unknown;
  title?: string;
}

export function RawJson({ data, title = 'Raw JSON' }: RawJsonProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-300">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && (
        <pre className="p-4 text-xs text-zinc-400 overflow-x-auto font-mono leading-relaxed bg-black/30">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
