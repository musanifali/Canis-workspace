import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Body validation via zod instead of class-validator: request schemas reuse
 * @workspace-engine/core's own spec schema, so the API's idea of a valid
 * spec can never drift from the validator's.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`);
      throw new BadRequestException({
        message: "request body failed validation",
        issues,
      });
    }
    return result.data;
  }
}
