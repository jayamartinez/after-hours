import {
  CharacterConfigSchema,
  type CharacterConfig,
  type ConfigIssue,
} from '@after-hours/contracts';
import type { z } from 'zod';

import { deepMerge, type PlainObject } from './deep-merge';

export interface ResolveResult {
  /** The merged config when valid, otherwise the preset. */
  character: CharacterConfig;
  valid: boolean;
  issues: ConfigIssue[];
}

export function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Applies one override to its preset and validates the merged result. An invalid result
 * (including an attempt to change `id`) returns the preset unchanged plus the issues.
 */
export function resolveCharacter(
  preset: CharacterConfig,
  override: PlainObject | null | undefined,
): ResolveResult {
  if (!override) return { character: preset, valid: true, issues: [] };

  const result = CharacterConfigSchema.safeParse(deepMerge(preset, override));
  const issues = result.success ? [] : toIssues(result.error);
  if (result.success && result.data.id !== preset.id) {
    issues.push({ path: 'id', message: `id is immutable (expected "${preset.id}")` });
  }
  if (!result.success || issues.length > 0) return { character: preset, valid: false, issues };
  return { character: result.data, valid: true, issues };
}
