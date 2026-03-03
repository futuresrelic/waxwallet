'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { WalletConnectButton } from './WalletConnectButton';

const DEFAULT_QUICK_WALLETS = ['futuresrelic'];

export function HomeSearch({ quickWallets }: { quickWallets?: string[] }) {
  const accounts = quickWallets && quickWallets.length > 0 ? quickWallets : DEFAULT_QUICK_WALLETS;
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = account.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter a WAX account name');
      return;
    }
    if (!/^[a-z1-5.]{1,13}$/.test(trimmed)) {
      setError('Invalid WAX account name (a-z, 1-5, dots, max 13 chars)');
      return;
    }
    router.push(`/wallet/${trimmed}`);
  };

  return (
    <div className="w-full max-w-lg flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="Enter WAX account (e.g. futuresrelic)"
          value={account}
          onChange={(e) => { setAccount(e.target.value); setError(''); }}
          error={error}
          leftIcon={<Search className="w-4 h-4" />}
        />
        <Button type="submit" size="lg" className="shrink-0">
          View
        </Button>
      </form>

      {/* Popular accounts */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-600">Quick:</span>
        {accounts.map((acc) => (
          <button
            key={acc}
            onClick={() => router.push(`/wallet/${acc}`)}
            className="text-xs text-zinc-400 hover:text-amber-400 font-mono border border-zinc-800 hover:border-amber-500/30 px-2 py-1 rounded transition-colors"
          >
            {acc}
          </button>
        ))}
      </div>

      {/* Or connect */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-600">or</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div className="flex justify-center">
        <WalletConnectButton />
      </div>
    </div>
  );
}
