import type { GameContent } from '@shards/shared';
import { contentSchema } from './schema';
import { validateReferences, type ValidationIssue } from './references';

export type { ValidationIssue } from './references';
export { validateEquipmentCatalog, assertValidEquipmentCatalog, EquipmentCatalogValidationError } from './equipment-catalog';
export interface ValidationResult { valid: boolean; issues: ValidationIssue[] }

/** Never throws for malformed content. Performs schemas first, then cross-reference checks. */
export function validateContent(input: unknown): ValidationResult {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.') || '$', message: issue.message })),
    };
  }
  const issues = validateReferences(parsed.data);
  return { valid: issues.length === 0, issues };
}

export class ContentValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(`Invalid game content:\n${issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'ContentValidationError';
  }
}

/** Throws ContentValidationError with all collected issues when validation fails. */
export function assertValidContent(input: unknown): asserts input is GameContent {
  const result = validateContent(input);
  if (!result.valid) throw new ContentValidationError(result.issues);
}
