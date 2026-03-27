import { describe, it, expect } from 'vitest';
import { normalizeExtraction } from './executor.js';

describe('normalizeExtraction', () => {
  it('passes through valid number', () => {
    expect(normalizeExtraction(50, 200)).toEqual({ value: 50 });
  });

  it('clamps to maxExtraction', () => {
    expect(normalizeExtraction(300, 200)).toEqual({ value: 200 });
  });

  it('treats negative as 0', () => {
    expect(normalizeExtraction(-5, 200)).toEqual({ value: 0 });
  });

  it('treats NaN as 0', () => {
    expect(normalizeExtraction(NaN, 200)).toEqual({ value: 0 });
  });

  it('treats Infinity as 0', () => {
    expect(normalizeExtraction(Infinity, 200)).toEqual({ value: 0 });
  });

  it('treats -Infinity as 0', () => {
    expect(normalizeExtraction(-Infinity, 200)).toEqual({ value: 0 });
  });

  it('treats string as 0', () => {
    expect(normalizeExtraction('50' as unknown, 200)).toEqual({ value: 0 });
  });

  it('treats null as 0', () => {
    expect(normalizeExtraction(null, 200)).toEqual({ value: 0 });
  });

  it('treats undefined as 0', () => {
    expect(normalizeExtraction(undefined, 200)).toEqual({ value: 0 });
  });

  it('extracts error from error object', () => {
    const result = normalizeExtraction({ error: 'boom', agentIndex: 0 }, 200);
    expect(result.value).toBe(0);
    expect(result.error).toBe('boom');
  });

  it('rounds to 2 decimal places', () => {
    expect(normalizeExtraction(14.285714, 200)).toEqual({ value: 14.29 });
  });
});
