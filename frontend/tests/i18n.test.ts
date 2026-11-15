import { describe, it, expect } from 'vitest';
import { messages, strategyNames, cropNames, limitations } from '../lib/i18n';

describe('i18n completeness', () => {
  it('contains matching keys in uk and en dictionaries', () => {
    const ukKeys = Object.keys(messages.uk).sort();
    const enKeys = Object.keys(messages.en).sort();
    expect(ukKeys).toEqual(enKeys);
  });

  it('translates all core rotation strategies', () => {
    for (const lang of ['uk', 'en'] as const) {
      expect(strategyNames[lang].S1).toBeDefined();
      expect(strategyNames[lang].S2).toBeDefined();
      expect(strategyNames[lang].S3).toBeDefined();
    }
  });

  it('translates all core crops', () => {
    const crops = ['wheat', 'maize', 'sunflower', 'pea', 'barley', 'sorghum', 'clover', 'soybean', 'rapeseed'];
    for (const lang of ['uk', 'en'] as const) {
      for (const crop of crops) {
        expect(cropNames[lang][crop]).toBeDefined();
        expect(cropNames[lang][crop].length).toBeGreaterThan(0);
      }
    }
  });

  it('has limitations descriptions in both languages', () => {
    const limitKeys = Object.keys(limitations.uk);
    expect(limitKeys.length).toBeGreaterThanOrEqual(4);
    for (const k of limitKeys) {
      expect(limitations.en[k]).toBeDefined();
    }
  });
});
