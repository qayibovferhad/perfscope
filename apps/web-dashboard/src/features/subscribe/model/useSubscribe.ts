import { useState } from 'react';
import { subscribeSchema } from './schema';

export function useSubscribe() {
  const [email,   setEmail]   = useState('');
  const [done,    setDone]    = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = subscribeSchema.safeParse({ email: email.trim() });
    if (!result.success) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 1400);
      return;
    }
    setLoading(true);
    try {
      // TODO: replace with real endpoint
      await new Promise(r => setTimeout(r, 600));
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return { email, setEmail, done, invalid, loading, submit };
}
