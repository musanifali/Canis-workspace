/**
 * Layout frame on the 12-column grid (Workspace Spec v1 §3).
 *
 * Per-frame arithmetic (x + w ≤ 12) is schema-level; cross-block rules
 * (no overlap) are validator-level and live with the policy validator.
 */
import { z } from "zod";

export const GRID_COLUMNS = 12;

export const frameSchema = z
  .object({
    x: z.number().int().min(0).max(GRID_COLUMNS - 1),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(GRID_COLUMNS),
    h: z.number().int().min(1),
  })
  .strict()
  .refine((frame) => frame.x + frame.w <= GRID_COLUMNS, {
    message: `frame must fit the grid: x + w must be <= ${GRID_COLUMNS}`,
  });
export type Frame = z.infer<typeof frameSchema>;
