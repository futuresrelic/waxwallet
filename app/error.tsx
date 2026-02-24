'use client';
// Route-level error boundary. Rendered within the app layout, so
// Tailwind CSS is available. Must NOT import anything that uses
// React context (providers, hooks that call useContext, wallet libs, etc.)
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fafafa' }}>Something went wrong</h2>
      <p style={{ fontSize: '0.875rem', color: '#71717a', maxWidth: '28rem' }}>
        {error?.message ?? 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.25rem',
          background: '#27272a',
          color: '#fafafa',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Try again
      </button>
    </div>
  );
}
