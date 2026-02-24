// ─── Template Links Store ─────────────────────────────────────────────────────
// In-memory store with optional JSON file persistence.
//
// Railway usage:
//   1. Add a Railway Volume mounted at /data (or any path you choose).
//   2. Set DATA_DIR=/data in your Railway service Variables.
//   3. Links now survive restarts. Without DATA_DIR they reset on deploy.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TemplateLink } from './types';

// ─── Persistence path ─────────────────────────────────────────────────────────

function getFilePath(): string | null {
  const dir = process.env.DATA_DIR?.trim();
  if (!dir) return null;
  return join(dir, 'template-links.json');
}

// ─── In-memory map ────────────────────────────────────────────────────────────

let loaded = false;
const store = new Map<string, TemplateLink>();

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  const path = getFilePath();
  if (!path || !existsSync(path)) return;
  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as TemplateLink[];
    if (Array.isArray(data)) {
      for (const link of data) store.set(link.id, link);
    }
  } catch (err) {
    console.error('[TemplateLinks] Failed to load from disk:', err);
  }
}

function persist(): void {
  const path = getFilePath();
  if (!path) return;
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(Array.from(store.values()), null, 2), 'utf8');
  } catch (err) {
    console.error('[TemplateLinks] Failed to write to disk:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllLinks(): TemplateLink[] {
  ensureLoaded();
  return Array.from(store.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Returns all *enabled* links as a template_id → TemplateLink map. */
export function getEnabledLinksMap(): Map<string, TemplateLink> {
  ensureLoaded();
  const map = new Map<string, TemplateLink>();
  for (const link of store.values()) {
    if (link.enabled) map.set(link.template_id, link);
  }
  return map;
}

export function createLink(data: {
  template_id: string;
  label: string;
  url: string;
  enabled: boolean;
}): TemplateLink {
  ensureLoaded();
  const now = new Date().toISOString();
  const link: TemplateLink = { id: randomUUID(), ...data, created_at: now, updated_at: now };
  store.set(link.id, link);
  persist();
  return link;
}

export function updateLink(
  id: string,
  data: Partial<Omit<TemplateLink, 'id' | 'created_at'>>,
): TemplateLink | null {
  ensureLoaded();
  const existing = store.get(id);
  if (!existing) return null;
  const updated: TemplateLink = { ...existing, ...data, updated_at: new Date().toISOString() };
  store.set(id, updated);
  persist();
  return updated;
}

export function deleteLink(id: string): boolean {
  ensureLoaded();
  const existed = store.has(id);
  store.delete(id);
  if (existed) persist();
  return existed;
}
