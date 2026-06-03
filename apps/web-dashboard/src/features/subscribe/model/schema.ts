import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.string().email(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
