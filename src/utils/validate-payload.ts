import { z } from "zod";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePayload(
  payload: unknown,
  schema: z.ZodSchema
): ValidationResult {
  try {
    schema.parse(payload);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.length > 0 ? `${err.path.join(".")}: ` : "";
        return `${path}${err.message}`;
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: ["Unknown validation error"] };
  }
}
