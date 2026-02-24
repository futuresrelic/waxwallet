'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImmutableData } from '@/lib/types';

interface AttributeListProps {
  data: ImmutableData;
  title: string;
  defaultOpen?: boolean;
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

export function AttributeList({ data, title, defaultOpen = true }: AttributeListProps) {
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
          {entries.map(([key, value]) => (
            <div key={key} className="group flex items-start justify-between px-4 py-2.5 gap-4 hover:bg-zinc-800/30">
              <span className="text-xs text-zinc-500 shrink-0 pt-0.5 min-w-[100px]">{key}</span>
              <span className="text-sm text-zinc-200 text-right break-all">{String(value)}</span>
              <CopyButton value={String(value)} />
            </div>
          ))}
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
