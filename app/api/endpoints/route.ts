import { NextResponse } from 'next/server';
import { getEndpoints } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

// Known Block Producer AtomicAssets endpoints (from validate.eosnation.io/wax BP list).
// Admin-configured endpoints appear first in the response and override labels here.
const KNOWN_BP_ENDPOINTS = [
  { url: 'https://api.waxsweden.org',               label: 'Sw/eden 🌿' },
  { url: 'https://wax.api.atomicassets.io',          label: 'AtomicHub (Pink.gg)' },
  { url: 'https://aa.wax.blacklusion.io',            label: 'Blacklusion' },
  { url: 'https://wax-aa.eu.eosamsterdam.net',       label: 'EOS Amsterdam' },
  { url: 'https://atomic.wax.eosrio.io',             label: 'EOS Rio' },
  { url: 'https://wax-atomic-api.eosphere.io',       label: 'EOSphere' },
  { url: 'https://aa-wax-public1.neftyblocks.com',   label: 'NeftyBlocks' },
  { url: 'https://atomic.hivebp.io',                 label: 'HiveBP' },
  { url: 'https://wax.eosusa.io',                    label: 'EOS USA' },
  { url: 'https://atomic-wax-mainnet.wecan.dev',     label: 'WeCan' },
  { url: 'https://wax-aa.eosdac.io',                 label: 'eosDAC' },
  { url: 'https://aa.dapplica.io',                   label: 'Dapplica' },
  { url: 'https://wax-atomic.eosiomadrid.io',        label: 'EOS Madrid' },
  { url: 'https://atomic-api.wax.cryptolions.io',    label: 'CryptoLions' },
  { url: 'https://wax-atomic.eosiomadrid.io',        label: 'EOS Madrid' },
  { url: 'https://atomic.wax.eosdetroit.io',         label: 'EOS Detroit' },
  { url: 'https://wax-aa.eosnation.io',              label: 'EOS Nation' },
] as const;

export async function GET() {
  const adminUrls = getEndpoints();
  const adminSet = new Set(adminUrls);

  // Admin-configured endpoints come first (marked as 'admin' source)
  const result: Array<{ url: string; label: string; source: 'admin' | 'bp' }> = adminUrls.map((url) => {
    const known = KNOWN_BP_ENDPOINTS.find((e) => e.url === url);
    return {
      url,
      label: known?.label ?? new URL(url).hostname,
      source: 'admin' as const,
    };
  });

  // Append BP endpoints not already in the admin list
  const seen = new Set(adminUrls);
  for (const ep of KNOWN_BP_ENDPOINTS) {
    if (!seen.has(ep.url)) {
      seen.add(ep.url);
      result.push({ url: ep.url, label: ep.label, source: 'bp' as const });
    }
  }

  return NextResponse.json({ success: true, data: result });
}
