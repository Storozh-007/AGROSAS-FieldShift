import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('Utility functions', () => {
  it('merges tailwind classes cleanly', () => {
    expect(cn('card', 'active')).toBe('card active');
    expect(cn('card', false && 'hidden', 'p-4')).toBe('card p-4');
  });

  it('handles multi-criteria weights normalization logic', () => {
    const rawWeights = { water: 30, soil: 30, resilience: 25, economy: 15 };
    const total = Object.values(rawWeights).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    const normalized = Object.fromEntries(
      Object.entries(rawWeights).map(([k, v]) => [k, v / total])
    );
    expect(normalized.water).toBeCloseTo(0.3);
    expect(normalized.soil).toBeCloseTo(0.3);
    expect(normalized.resilience).toBeCloseTo(0.25);
    expect(normalized.economy).toBeCloseTo(0.15);
  });
});
