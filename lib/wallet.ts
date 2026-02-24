// ─── WharfKit Wallet Integration ─────────────────────────────────────────────
// Client-side only. Lazy loaded to avoid SSR issues.

import type { Session, SessionKit } from '@wharfkit/session';

let sessionKit: SessionKit | null = null;
let activeSession: Session | null = null;

export type WalletState = {
  account: string | null;
  connected: boolean;
};

// Lazy init - call only in browser
export async function initSessionKit(): Promise<SessionKit> {
  if (sessionKit) return sessionKit;

  const [
    { SessionKit },
    { WebRenderer },
    { WalletPluginCloudWallet },
    { WalletPluginAnchor },
  ] = await Promise.all([
    import('@wharfkit/session'),
    import('@wharfkit/web-renderer'),
    import('@wharfkit/wallet-plugin-cloudwallet'),
    import('@wharfkit/wallet-plugin-anchor'),
  ]);

  sessionKit = new SessionKit({
    appName: 'WAX Wallet Viewer',
    chains: [
      {
        id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
        url: 'https://wax.greymass.com',
      },
    ],
    ui: new WebRenderer(),
    walletPlugins: [
      new WalletPluginCloudWallet(),
      new WalletPluginAnchor(),
    ],
  });

  return sessionKit;
}

export async function connectWallet(): Promise<string | null> {
  try {
    const kit = await initSessionKit();
    const { session } = await kit.login();
    activeSession = session;
    return String(session.actor);
  } catch (err) {
    console.error('[Wallet] Login failed:', err);
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const kit = await initSessionKit();
    await kit.logout(activeSession ?? undefined);
    activeSession = null;
  } catch (err) {
    console.error('[Wallet] Logout failed:', err);
  }
}

export async function restoreSession(): Promise<string | null> {
  try {
    const kit = await initSessionKit();
    const restored = await kit.restore();
    if (restored) {
      activeSession = restored;
      return String(restored.actor);
    }
    return null;
  } catch {
    return null;
  }
}

export function getActiveSession(): Session | null {
  return activeSession;
}
