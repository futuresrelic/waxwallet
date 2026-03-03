'use client';
import { useState, useEffect, useRef } from 'react';
import { Server, ChevronDown, Check } from 'lucide-react';

const LS_KEY = 'wax_preferred_endpoint';

interface EndpointEntry {
  url: string;
  label: string;
  source: 'admin' | 'bp';
}

export function EndpointPicker() {
  const [open, setOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<EndpointEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Read persisted choice from localStorage on mount
  useEffect(() => {
    setSelected(localStorage.getItem(LS_KEY));
  }, []);

  // Fetch the server's list of available endpoints
  useEffect(() => {
    fetch('/api/endpoints')
      .then((r) => r.json())
      .then((j: { success: boolean; data: EndpointEntry[] }) => {
        if (j.success) setEndpoints(j.data);
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const choose = (url: string | null) => {
    if (url) {
      localStorage.setItem(LS_KEY, url);
    } else {
      localStorage.removeItem(LS_KEY);
    }
    setSelected(url);
    setOpen(false);
    // Reload so all in-flight queries re-run with the new endpoint
    window.location.reload();
  };

  // Derive a short label for the currently selected endpoint
  const selectedLabel = selected
    ? (endpoints.find((e) => e.url === selected)?.label ?? new URL(selected).hostname)
    : 'Auto';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        title="Switch API endpoint"
      >
        <Server className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:block max-w-[88px] truncate text-xs font-mono">{selectedLabel}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-300">API Endpoint</p>
            <p className="text-xs text-zinc-500 mt-0.5">Your choice is saved and persists across updates</p>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {/* Auto option */}
            <button
              onClick={() => choose(null)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left gap-3"
            >
              <div>
                <p className="text-sm text-white font-medium">Auto</p>
                <p className="text-xs text-zinc-500">Server picks the fastest available endpoint</p>
              </div>
              {!selected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
            </button>

            {/* Endpoint list */}
            {endpoints.length > 0 && (
              <>
                <div className="border-t border-zinc-800 mx-3 my-1" />
                {/* Admin-configured first */}
                {endpoints.filter((e) => e.source === 'admin').length > 0 && (
                  <p className="px-3 pt-1 pb-0.5 text-xs font-medium text-amber-500 uppercase tracking-wider">
                    Custom
                  </p>
                )}
                {endpoints.filter((e) => e.source === 'admin').map((ep) => (
                  <EndpointRow key={ep.url} ep={ep} selected={selected} choose={choose} />
                ))}
                {endpoints.filter((e) => e.source === 'bp').length > 0 && (
                  <p className="px-3 pt-2 pb-0.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Block Producers
                  </p>
                )}
                {endpoints.filter((e) => e.source === 'bp').map((ep) => (
                  <EndpointRow key={ep.url} ep={ep} selected={selected} choose={choose} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointRow({
  ep,
  selected,
  choose,
}: {
  ep: EndpointEntry;
  selected: string | null;
  choose: (url: string) => void;
}) {
  const isActive = selected === ep.url;
  return (
    <button
      onClick={() => choose(ep.url)}
      className={`w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800 transition-colors text-left gap-2 ${isActive ? 'bg-zinc-800/60' : ''}`}
    >
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{ep.label}</p>
        <p className="text-xs text-zinc-500 truncate font-mono">{ep.url.replace('https://', '')}</p>
      </div>
      {isActive && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
    </button>
  );
}
