// ─── Branding Store ───────────────────────────────────────────────────────────
// Persists branding settings + uploaded image files to DATA_DIR/branding/.
//
// Railway usage:
//   1. Mount a Railway Volume at /data (or any path).
//   2. Set DATA_DIR=/data in your Railway service Variables.
//   3. Upload images and save settings via the Admin panel.
//   Without DATA_DIR, settings reset on deploy and image uploads are rejected.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BrandingSettings {
  siteTitle: string;
  pwaName: string;
  pwaShortName: string;
  primaryColor: string;
  accentColor: string;
  updatedAt: string | null;
}

const DEFAULTS: BrandingSettings = {
  siteTitle: 'WAX Wallet Viewer',
  pwaName: 'WAX Wallet Viewer',
  pwaShortName: 'WAX Wallet',
  primaryColor: '#f59e0b',
  accentColor: '#92400e',
  updatedAt: null,
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export function getBrandingDir(): string | null {
  const dir = process.env.DATA_DIR?.trim();
  if (!dir) return null;
  return join(dir, 'branding');
}

function getSettingsPath(): string | null {
  const dir = getBrandingDir();
  if (!dir) return null;
  return join(dir, 'settings.json');
}

export function getBrandingImagePath(filename: string): string | null {
  const dir = getBrandingDir();
  if (!dir) return null;
  return join(dir, filename);
}

export function isBrandingImageAvailable(filename: string): boolean {
  const path = getBrandingImagePath(filename);
  return path !== null && existsSync(path);
}

/** Ensure branding directory exists. Returns path or null if DATA_DIR not set. */
export function ensureBrandingDir(): string | null {
  const dir = getBrandingDir();
  if (!dir) return null;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

let loaded = false;
let settings: BrandingSettings = { ...DEFAULTS };

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  const path = getSettingsPath();
  if (!path || !existsSync(path)) return;
  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as Partial<BrandingSettings>;
    settings = { ...DEFAULTS, ...data };
  } catch (err) {
    console.error('[Branding] Failed to load settings:', err);
  }
}

function persist(): void {
  const path = getSettingsPath();
  if (!path) return;
  try {
    const dir = getBrandingDir()!;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[Branding] Failed to write settings:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSettings(): BrandingSettings {
  ensureLoaded();
  return { ...settings };
}

export function updateSettings(
  patch: Partial<Omit<BrandingSettings, 'updatedAt'>>,
): BrandingSettings {
  ensureLoaded();
  settings = { ...settings, ...patch, updatedAt: new Date().toISOString() };
  persist();
  return { ...settings };
}
