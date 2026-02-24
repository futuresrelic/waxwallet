'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useWalletStore } from '@/lib/store';

export function WalletConnectButton() {
  const router = useRouter();
  const { connectedAccount, setConnectedAccount } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Attempt to restore session on mount
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const { restoreSession } = await import('@/lib/wallet');
        const account = await restoreSession();
        if (!cancelled && account) {
          setConnectedAccount(account);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setInitialized(true);
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [setConnectedAccount]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { connectWallet } = await import('@/lib/wallet');
      const account = await connectWallet();
      if (account) {
        setConnectedAccount(account);
        router.push(`/wallet/${account}`);
      }
    } catch (err) {
      console.error('[WalletConnect] failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { disconnectWallet } = await import('@/lib/wallet');
      await disconnectWallet();
      setConnectedAccount(null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) return null;

  if (connectedAccount) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/wallet/${connectedAccount}`)}
          className="text-sm text-amber-400 hover:text-amber-300 font-mono transition-colors truncate max-w-[120px]"
          title={connectedAccount}
        >
          {connectedAccount}
        </button>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="text-zinc-500 hover:text-red-400 transition-colors"
          title="Disconnect"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleConnect}
      loading={loading}
    >
      <Wallet className="w-4 h-4" />
      Connect
    </Button>
  );
}
