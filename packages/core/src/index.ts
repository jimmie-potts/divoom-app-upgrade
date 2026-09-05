import { z } from 'zod';
export const healthSchema = z.object({
  status: z.literal('ready'),
  mode: z.literal('simulator'),
  device: z.object({ connected: z.literal(false) }),
  canvas: z.object({ width: z.literal(64), height: z.literal(64) }),
});
export type Health = z.infer<typeof healthSchema>;
