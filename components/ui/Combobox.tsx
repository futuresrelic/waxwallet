'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  count?: number;
}

interface ComboboxProps {
  options: ComboboxOption[];
  /** Selected values. For single-select pass an array with 0 or 1 elements. */
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Allow selecting multiple values (default false) */
  multiple?: boolean;
  className?: string;
}

/**
 * Lightweight searchable combobox — no external dependencies.
 *
 * Renders inline (not absolutely positioned) so it works inside any
 * scroll container (mobile drawer, sticky sidebar) without clipping.
 * Keyboard: Escape closes the panel.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  multiple = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', onDown);
      // Auto-focus search input
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Escape key closes panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (v: string) => {
    if (multiple) {
      onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
    } else {
      // Single-select: deselect if already selected
      onChange(value[0] === v ? [] : [v]);
      setOpen(false);
      setSearch('');
    }
  };

  const selectedLabel =
    value.length === 0
      ? null
      : value.length === 1
        ? (options.find(o => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`;

  return (
    <div ref={containerRef} className={cn('flex flex-col', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={cn(
          'flex items-center justify-between gap-1.5 w-full px-3 py-2 rounded-lg border text-sm transition-colors text-left',
          open
            ? 'bg-zinc-700/60 border-zinc-600 text-white'
            : value.length > 0
              ? 'bg-zinc-800 border-amber-500/40 text-zinc-200 hover:border-amber-500/60'
              : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
        )}
      >
        <span className="truncate min-w-0">{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Inline panel — expands below the trigger, no absolute positioning */}
      {open && (
        <div className="mt-1 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden">
          {/* Search row */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-zinc-800">
            <Search className="w-3 h-3 text-zinc-600 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Clear selection row (single-select, when a value is active) */}
          {!multiple && value.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false); setSearch(''); }}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors border-b border-zinc-800/60"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}

          {/* Options */}
          <div className="max-h-44 overflow-y-auto py-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-600 px-3 py-2">No matches</p>
            ) : (
              filtered.map(opt => {
                const sel = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm transition-colors text-left',
                      sel
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white',
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate min-w-0">
                      {multiple && (
                        <span
                          className={cn(
                            'w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center',
                            sel ? 'bg-amber-500 border-amber-500' : 'border-zinc-600',
                          )}
                        >
                          {sel && <Check className="w-2.5 h-2.5 text-black" />}
                        </span>
                      )}
                      {!multiple && sel && (
                        <Check className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.count !== undefined && (
                      <span className="text-xs text-zinc-500 shrink-0">{opt.count}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
