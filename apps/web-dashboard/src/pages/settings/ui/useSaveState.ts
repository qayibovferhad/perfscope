import { useState } from 'react';

/**
 * The saved/error lifecycle every settings section runs: clear both flags, attempt the
 * save, record which way it went. Three sections each carried this state pair, the
 * identical error paragraph and the identical "Saved" chip; when to *show* the chip
 * stays a per-section decision (the profile form also waits for the form to be clean).
 */
export function useSaveState(fallbackError: string) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<void>): Promise<void> {
    setError('');
    setSaved(false);
    try {
      await fn();
      setSaved(true);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? fallbackError);
    }
  }

  return { saved, error, run };
}
