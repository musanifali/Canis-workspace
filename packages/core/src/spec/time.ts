/**
 * Date and relative-time value schemas (Workspace Spec v1 §5–§6).
 *
 * Symbolic values are STORED symbolically and resolved at query execution —
 * never at generation time. Resolution itself lives with the query executor;
 * this module only defines the value shapes.
 */
import { z } from "zod";

/** Day-precision ISO date: YYYY-MM-DD. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO date (YYYY-MM-DD)");

/** Instant-precision ISO datetime (UTC or offset). */
export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/,
    "expected an ISO datetime",
  );

/** Symbolic relative-time tokens, resolved at query execution (§6). */
export const relativeTokenSchema = z.enum([
  "today",
  "yesterday",
  "tomorrow",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
]);
export type RelativeToken = z.infer<typeof relativeTokenSchema>;

/**
 * Absolute date value: `{ "abs": "2026-07-01" }` or a full datetime.
 * Both precisions pass the SHAPE gate; whether a datetime is legal for the
 * target field is the policy validator's call — it truncates a datetime sent
 * against a day-precision `date` field and records a note (§5).
 */
export const absoluteDateValueSchema = z
  .object({ abs: z.union([isoDateSchema, isoDateTimeSchema]) })
  .strict();

/** Relative date value: `{ "rel": "this_month" }` or `{ "rel": "today", "offsetDays": 7 }`. */
export const relativeDateValueSchema = z
  .object({
    rel: relativeTokenSchema,
    offsetDays: z.number().int().min(-3650).max(3650).optional(),
  })
  .strict();

/** A date-filter value: absolute or symbolic. */
export const dateValueSchema = z.union([
  absoluteDateValueSchema,
  relativeDateValueSchema,
]);
export type DateValue = z.infer<typeof dateValueSchema>;

/**
 * Workspace timezone policy: the single clock for relative-time resolution (§6).
 *
 * Shape-only check (A4): "viewer", the "UTC" alias, or an Area/Location-shaped
 * string. Whether a zone actually exists is enforced at execution via Intl —
 * an invalid zone is a typed executor error, never a silent UTC fallback.
 */
export const timezoneSchema = z.union([
  z.literal("viewer"),
  z.literal("UTC"),
  z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+(\/[A-Za-z_]+)?$/, {
    message: 'expected "viewer", "UTC", or an IANA zone like "Europe/Berlin"',
  }),
]);
export type Timezone = z.infer<typeof timezoneSchema>;
