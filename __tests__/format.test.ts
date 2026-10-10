import { describe, expect, it } from 'vitest';
import { formatUsd } from '../lib/format';

describe('formatUsd', () => {
  it.each([
    [40_000, '$40,000'],
    [0, '$0'],
    [999, '$999'],
    [1_234_567, '$1,234,567'],
    [-26_000, '-$26,000'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatUsd(amount)).toBe(expected);
  });
});
