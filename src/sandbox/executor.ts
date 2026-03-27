// Agent 006: Sandbox Executor
// High-level API for validating and executing strategy code in the sandbox.

import { validateStrategy, type ValidationResult } from './validator.js';
import { RoundDispatcher, type RoundDispatchResult } from './round-dispatcher.js';

export { validateStrategy, type ValidationResult } from './validator.js';
export { RoundDispatcher, type RoundDispatchResult } from './round-dispatcher.js';

/**
 * Normalize a raw extraction value from the sandbox.
 * Handles NaN, Infinity, negatives, non-numbers, and error objects.
 * Clamps to [0, maxExtraction].
 */
export function normalizeExtraction(
  raw: unknown,
  maxExtraction: number,
): { value: number; error?: string } {
  // Error object from child
  if (raw && typeof raw === 'object' && 'error' in raw) {
    return { value: 0, error: (raw as { error: string }).error };
  }

  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { value: 0 };
  }

  if (raw < 0) return { value: 0 };
  if (raw > maxExtraction) return { value: Math.round(maxExtraction * 100) / 100 };

  return { value: Math.round(raw * 100) / 100 };
}
