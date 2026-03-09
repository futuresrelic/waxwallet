'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Wallet, Shield, Home, Trophy, Send, Activity } from 'lucide-react';
import { WalletConnectButton } from './WalletConnectButton';
import { EndpointPicker } from './EndpointPicker';
import { ThemePicker } from './ThemePicker';

export function Navbar({ siteTitle = 'WAX Wallet' }: { siteTitle?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
            <span className="text-black font-bold text-xs">W</span>
          </div>
          <span className="font-bold text-white hidden sm:block">{siteTitle}</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              pathname === '/'
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
            )}
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:block">Home</span>
          </Link>
          <Link
            href="/leaderboard"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              pathname === '/leaderboard'
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
            )}
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:block">Leaderboard</span>
          </Link>
          <Link
            href="/transfer"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              pathname === '/transfer'
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
            )}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:block">Transfer</span>
          </Link>
          <Link
            href="/resources"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              pathname === '/resources'
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
            )}
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:block">Resources</span>
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemePicker />
          <EndpointPicker />
          <WalletConnectButton />
          <Link
            href="/admin"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Admin"
          >
            <Shield className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
