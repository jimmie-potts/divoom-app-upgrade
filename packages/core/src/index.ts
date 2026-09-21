import { z } from 'zod';
export const healthSchema = z.object({
  status: z.literal('ready'),
  mode: z.enum(['simulator','device']),
  device: z.object({ connected: z.boolean().nullable() }),
  canvas: z.object({ width: z.literal(64), height: z.literal(64) }),
});
export type Health = z.infer<typeof healthSchema>;
export * from './api.js';
export * from './integration.js';
