'use client';
// This file is required to prevent Next.js from auto-generating /_global-error,
// which can fail during prerender in Next.js 16 + React 19.
// It MUST include <html> and <body> because it replaces the root layout.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: '#09090b',
          color: '#fafafa',
          fontFamily: 'sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: '#71717a', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
