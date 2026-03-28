// Tests for archetype generator — validation, count, uniqueness

import { describe, it, expect } from 'vitest';
import { validateArchetypes } from './archetype-gen.js';

describe('validateArchetypes', () => {
  it('accepts valid archetypes with correct count', () => {
    const parsed = [
      { name: 'Greedy', description: 'Always takes max.' },
      { name: 'Cooperative', description: 'Takes fair share.' },
      { name: 'Retaliator', description: 'Punishes defectors.' },
    ];
    const result = validateArchetypes(parsed, 3);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array', () => {
    const result = validateArchetypes({ name: 'test' }, 1);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('JSON array');
  });

  it('rejects wrong count', () => {
    const parsed = [
      { name: 'Greedy', description: 'Takes max.' },
      { name: 'Cooperative', description: 'Takes fair share.' },
    ];
    const result = validateArchetypes(parsed, 5);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Expected 5'))).toBe(true);
  });

  it('rejects empty name', () => {
    const parsed = [
      { name: '', description: 'No name.' },
    ];
    const result = validateArchetypes(parsed, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('non-empty name'))).toBe(true);
  });

  it('rejects empty description', () => {
    const parsed = [
      { name: 'Greedy', description: '' },
    ];
    const result = validateArchetypes(parsed, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('non-empty description'))).toBe(true);
  });

  it('rejects duplicate names (case-insensitive)', () => {
    const parsed = [
      { name: 'Greedy', description: 'Takes max.' },
      { name: 'greedy', description: 'Also takes max.' },
    ];
    const result = validateArchetypes(parsed, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
  });

  it('rejects missing name field', () => {
    const parsed = [{ description: 'No name field.' }];
    const result = validateArchetypes(parsed, 1);
    expect(result.valid).toBe(false);
  });

  it('rejects missing description field', () => {
    const parsed = [{ name: 'Greedy' }];
    const result = validateArchetypes(parsed, 1);
    expect(result.valid).toBe(false);
  });

  it('collects multiple errors at once', () => {
    const parsed = [
      { name: '', description: '' },
      { name: '', description: '' },
    ];
    const result = validateArchetypes(parsed, 5);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });
});
