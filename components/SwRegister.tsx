'use client';
import { useEffect } from 'react';

/** Registers /sw.js as a service worker on first mount (client-side only). */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
    }
  }, []);

  return null;
}
