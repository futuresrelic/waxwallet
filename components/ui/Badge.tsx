import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'amber' | 'green' | 'red' | 'blue' | 'purple';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-zinc-700/80 text-zinc-300': variant === 'default',
          'bg-amber-500/20 text-amber-400 border border-amber-500/30': variant === 'amber',
          'bg-green-500/20 text-green-400 border border-green-500/30': variant === 'green',
          'bg-red-500/20 text-red-400 border border-red-500/30': variant === 'red',
          'bg-blue-500/20 text-blue-400 border border-blue-500/30': variant === 'blue',
          'bg-purple-500/20 text-purple-400 border border-purple-500/30': variant === 'purple',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
