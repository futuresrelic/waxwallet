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
