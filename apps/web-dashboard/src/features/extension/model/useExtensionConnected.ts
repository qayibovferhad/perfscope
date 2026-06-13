import { useEffect, useState } from 'react';

export function useExtensionConnected() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    setConnected(localStorage.getItem('perfscope-auth') !== null);
    const handler = () => setConnected(localStorage.getItem('perfscope-auth') !== null);
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return connected;
}
