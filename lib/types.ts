// ─── AtomicAssets API Types ───────────────────────────────────────────────────

export interface AtomicAssetsResponse<T> {
  success: boolean;
  data: T;
  query_time?: number;
}

export interface ImmutableData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface AssetData {
  asset_id: string;
  contract: string;
  owner: string;
  name: string;
  is_transferable: boolean;
  is_burnable: boolean;
  template_mint: string;
  collection: {
    collection_name: string;
    name: string;
    img?: string;
    author: string;
    created_at_time: string;
  };
  schema: {
    schema_name: string;
    format?: Array<{ name: string; type: string }>;
  };
  template?: {
    template_id: string;
    max_supply: string;
    issued_supply: string;
    is_transferable: boolean;
    is_burnable: boolean;
    immutable_data?: ImmutableData;
  };
  immutable_data: ImmutableData;
  mutable_data: ImmutableData;
  data: ImmutableData;
  burned_by_account: string | null;
  burned_at_time: string | null;
  transferred_at_time: string;
  minted_at_time: string;
  backed_tokens: Array<{ token_symbol: string; token_contract: string; amount: string }>;
  updated_at_time: string;
  created_at_time: string;
}

export interface CollectionData {
  collection_name: string;
  name: string;
  img?: string;
  author: string;
  allow_notify: boolean;
  authorized_accounts: string[];
  notify_accounts: string[];
  market_fee: number;
  data: { [key: string]: unknown };
  created_at_time: string;
  created_at_block: string;
}

export interface SchemaData {
  schema_name: string;
  format: Array<{ name: string; type: string }>;
  created_at_time: string;
  created_at_block: string;
}

export interface TemplateData {
  template_id: string;
  max_supply: string;
  issued_supply: string;
  is_transferable: boolean;
  is_burnable: boolean;
  immutable_data: ImmutableData;
  created_at_time: string;
  collection: {
    collection_name: string;
    name: string;
    img?: string;
  };
  schema: {
    schema_name: string;
  };
}

// ─── UI / Store Types ─────────────────────────────────────────────────────────

export interface AssetFilters {
  search: string;
  collections: string[];
  schemas: string[];
  templateId: string;
  showBurned: boolean;
  mediaType: 'all' | 'image' | 'video';
  sortBy: SortOption;
  page: number;
  limit: number;
  /** Optional rarity attribute filter (client-side, derived from loaded assets) */
  rarity?: string;
}

export type SortOption =
  | 'asset_id:desc'
  | 'asset_id:asc'
  | 'name:asc'
  | 'name:desc'
  | 'template_mint:asc'
  | 'template_mint:desc'
  | 'transferred:desc'
  | 'transferred:asc';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'asset_id:desc', label: 'Newest First' },
  { value: 'asset_id:asc', label: 'Oldest First' },
  { value: 'name:asc', label: 'Name A→Z' },
  { value: 'name:desc', label: 'Name Z→A' },
  { value: 'template_mint:asc', label: 'Mint # Ascending' },
  { value: 'template_mint:desc', label: 'Mint # Descending' },
  { value: 'transferred:desc', label: 'Recently Transferred' },
];

export const DEFAULT_FILTERS: AssetFilters = {
  search: '',
  collections: [],
  schemas: [],
  templateId: '',
  showBurned: false,
  mediaType: 'all',
  sortBy: 'asset_id:desc',
  page: 1,
  limit: 40,
};

// ─── Template Stacking ────────────────────────────────────────────────────────

export interface TemplateStack {
  template_id: string;
  name: string;
  collection_name: string;
  collection_display_name: string;
  schema_name: string;
  /** Already-resolved full URL (null if no media) */
  image_url: string | null;
  image_type: 'image' | 'video' | 'none';
  count: number;
  max_supply: string;
  issued_supply: string;
  /** Up to 5 sample asset_ids for drill-down linking */
  sample_asset_ids: string[];
}

export type StackSortOption =
  | 'count:desc'
  | 'count:asc'
  | 'name:asc'
  | 'name:desc'
  | 'template_id:asc'
  | 'template_id:desc';

export const STACK_SORT_OPTIONS: { value: StackSortOption; label: string }[] = [
  { value: 'count:desc', label: 'Most Copies' },
  { value: 'count:asc', label: 'Fewest Copies' },
  { value: 'name:asc', label: 'Name A→Z' },
  { value: 'name:desc', label: 'Name Z→A' },
  { value: 'template_id:asc', label: 'Template ID ↑' },
  { value: 'template_id:desc', label: 'Template ID ↓' },
];

export interface StackMeta {
  total: number;
  page: number;
  limit: number;
  capped: boolean;
  totalFetched: number;
  noTemplateCount: number;
  /** true when all wallet assets were scanned (not limited by scan_pages or MAX_ASSETS) */
  scanComplete: boolean;
}

// ─── Template Links ────────────────────────────────────────────────────────────

export interface TemplateLink {
  id: string;
  template_id: string;
  /** Button label shown on the card, e.g. "Claim", "Info" */
  label: string;
  url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Admin Types ──────────────────────────────────────────────────────────────

export interface EndpointHealth {
  url: string;
  healthy: boolean;
  latencyMs?: number;
  lastChecked: string;
  lastError?: string;
}

export interface AdminConfig {
  endpoints: string[];
  primaryEndpoint: string;
  featuredCollections: string[];
  blockedCollections: string[];
  blockedTemplates: string[];
}

export interface SystemStatus {
  endpoints: EndpointHealth[];
  currentEndpoint: string;
  lastSuccessfulCall: string | null;
  errorCountLastHour: number;
  totalRequests: number;
  uptime: number;
}

// ─── Media helpers ────────────────────────────────────────────────────────────

export const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

export function resolveMediaUrl(hash?: string | null, gateway = IPFS_GATEWAYS[0]): string | null {
  if (!hash) return null;
  if (hash.startsWith('http')) return hash;
  if (hash.startsWith('Qm') || hash.startsWith('bafy')) {
    return `${gateway}${hash}`;
  }
  return null;
}

export function getAssetMedia(asset: AssetData): { url: string | null; type: 'image' | 'video' | 'none' } {
  const data = { ...asset.immutable_data, ...asset.mutable_data, ...asset.data };
  const templateData = asset.template?.immutable_data ?? {};
  const merged = { ...templateData, ...data };

  const videoHash = merged.video ?? merged.backimg_video;
  if (videoHash && typeof videoHash === 'string') {
    return { url: resolveMediaUrl(videoHash), type: 'video' };
  }

  const imgHash = merged.img ?? merged.image ?? merged.thumbnail ?? merged.preview;
  if (imgHash && typeof imgHash === 'string') {
    return { url: resolveMediaUrl(imgHash), type: 'image' };
  }

  return { url: null, type: 'none' };
}

export function getAssetName(asset: AssetData): string {
  const data = { ...asset.immutable_data, ...asset.mutable_data, ...asset.data };
  const templateData = asset.template?.immutable_data ?? {};
  const merged = { ...templateData, ...data };

  if (asset.name && asset.name !== 'undefined') return asset.name;
  if (merged.name && typeof merged.name === 'string') return merged.name;
  return `Asset #${asset.asset_id}`;
}

// ─── Media Gallery ────────────────────────────────────────────────────────────

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  /** Source field name, e.g. "img", "video", "backimg_video" */
  field: string;
}

/** Collect all distinct media items (images + videos) from an asset's data fields. */
export function collectAllMedia(asset: AssetData): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();

  const merged = {
    ...asset.template?.immutable_data,
    ...asset.immutable_data,
    ...asset.mutable_data,
    ...asset.data,
  };

  // Prioritised video fields first so videos appear before their poster images
  const videoFields = ['video', 'backimg_video', 'animation_url'];
  const imageFields = ['img', 'image', 'thumbnail', 'preview', 'back_img', 'backimg'];
  const knownFields = new Set([...videoFields, ...imageFields]);

  const addItem = (field: string, type: 'image' | 'video') => {
    const raw = merged[field];
    if (!raw || typeof raw !== 'string') return;
    const url = resolveMediaUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({ url, type, field });
  };

  for (const f of videoFields) addItem(f, 'video');
  for (const f of imageFields) addItem(f, 'image');

  // Scan remaining fields for any IPFS hash or HTTP URL not yet captured
  for (const [field, val] of Object.entries(merged)) {
    if (knownFields.has(field) || typeof val !== 'string') continue;
    const url = resolveMediaUrl(val);
    if (!url || seen.has(url)) continue;
    const isVideo =
      field.toLowerCase().includes('video') ||
      val.toLowerCase().endsWith('.mp4') ||
      val.toLowerCase().endsWith('.webm');
    seen.add(url);
    items.push({ url, type: isVideo ? 'video' : 'image', field });
  }

  return items;
}
