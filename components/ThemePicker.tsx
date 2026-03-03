'use client';
import { useState, useEffect, useRef } from 'react';
import { Palette, Check } from 'lucide-react';

const LS_KEY = 'wax_theme';

const THEMES = [
  { id: 'auto',   label: 'Auto',   color: '#f59e0b', description: 'Follow site branding' },
  { id: 'amber',  label: 'Amber',  color: '#f59e0b', description: 'Warm gold' },
  { id: 'violet', label: 'Violet', color: '#8b5cf6', description: 'Purple accent' },
  { id: 'ocean',  label: 'Ocean',  color: '#0ea5e9', description: 'Sky blue' },
  { id: 'forest', label: 'Forest', color: '#22c55e', description: 'Fresh green' },
  { id: 'rose',   label: 'Rose',   color: '#f43f5e', description: 'Vibrant pink' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

function applyTheme(id: ThemeId) {
  if (id === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', id);
  }
}

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ThemeId>('auto');
  const ref = useRef<HTMLDivElement>(null);

  // Read persisted choice on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      setActive(stored);
      applyTheme(stored);
    }
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

  const choose = (id: ThemeId) => {
    if (id === 'auto') {
      localStorage.removeItem(LS_KEY);
    } else {
      localStorage.setItem(LS_KEY, id);
    }
    setActive(id);
    applyTheme(id);
    setOpen(false);
  };

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        title="Pick color theme"
      >
        <Palette className="w-3.5 h-3.5 shrink-0" />
        {/* Swatch dot showing current color */}
        <span
          className="hidden sm:block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: current.color }}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-300">Color Theme</p>
            <p className="text-xs text-zinc-500 mt-0.5">Saved locally in your browser</p>
          </div>

          <div className="py-1">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => choose(theme.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
              >
                <span
                  className="w-4 h-4 rounded-full shrink-0 ring-1 ring-white/10"
                  style={{ background: theme.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{theme.label}</p>
                  <p className="text-xs text-zinc-500">{theme.description}</p>
                </div>
                {active === theme.id && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
