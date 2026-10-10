import { describe, expect, it } from 'vitest';
import {
  SCORE_WEIGHTS,
  calculateTotalScore,
  scoreBudgetFit,
  scoreEmissions,
  scoreReliability,
  scoreResale,
  scoreTCO,
} from '../lib/engine/scorer';

const inRange = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 100;

describe('scoreBudgetFit', () => {
  it('is 100 at or under budget', () => {
    expect(scoreBudgetFit(40_000, 40_000)).toBe(100);
    expect(scoreBudgetFit(20_000, 40_000)).toBe(100);
  });

  it('falls as budget / price when over budget', () => {
    expect(scoreBudgetFit(42_000, 40_000)).toBe(95);
    expect(scoreBudgetFit(48_000, 40_000)).toBe(83); // exactly at the 20% ceiling
  });

  it('is 0 beyond the 20% ceiling', () => {
    expect(scoreBudgetFit(48_001, 40_000)).toBe(0);
    expect(scoreBudgetFit(50_000, 40_000)).toBe(0);
  });
});

describe('scoreTCO', () => {
  it('scores against a worst case of twice the budget', () => {
    expect(scoreTCO(25_000, 40_000)).toBe(69); // 68.75 rounded
    expect(scoreTCO(30_000, 40_000)).toBe(63); // 62.5 rounded
    expect(scoreTCO(80_000, 40_000)).toBe(0);
  });

  it('never goes below 0 or above 100', () => {
    expect(scoreTCO(200_000, 40_000)).toBe(0);
    expect(scoreTCO(0, 40_000)).toBe(100);
  });
});

describe('scoreEmissions', () => {
  it('gives full marks under 150 g/mi', () => {
    expect(scoreEmissions(0)).toBe(100);
    expect(scoreEmissions(120)).toBe(100);
    expect(scoreEmissions(150)).toBe(100);
  });

  it('interpolates linearly from 100 at 150 to 20 at 300', () => {
    expect(scoreEmissions(200)).toBe(73);
    expect(scoreEmissions(280)).toBe(31);
    expect(scoreEmissions(300)).toBe(20);
  });

  it('floors at 20 above 300 g/mi', () => {
    expect(scoreEmissions(301)).toBe(20);
    expect(scoreEmissions(600)).toBe(20);
  });
});

describe('scoreReliability and scoreResale', () => {
  it('pass the value through', () => {
    expect(scoreReliability(88)).toBe(88);
    expect(scoreResale(65)).toBe(65);
  });

  it('clamp to 0-100', () => {
    expect(scoreReliability(120)).toBe(100);
    expect(scoreResale(-5)).toBe(0);
  });
});

describe('calculateTotalScore', () => {
  it('weights sum to 1', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('reproduces the SPEC.md worked example (89.35 -> 89)', () => {
    expect(
      calculateTotalScore({ budgetFit: 100, tco: 85, emissions: 95, reliability: 88, resale: 65 }),
    ).toBe(89);
  });

  it('is exactly the weighted average of the dimensions', () => {
    const s = { budgetFit: 91, tco: 63, emissions: 100, reliability: 85, resale: 66 };
    const expected =
      s.budgetFit * 0.25 + s.tco * 0.25 + s.emissions * 0.2 + s.reliability * 0.2 + s.resale * 0.1;
    expect(Math.abs(calculateTotalScore(s) - expected)).toBeLessThanOrEqual(0.5);
  });
});

describe('every scoring function returns 0-100', () => {
  it('across a sweep of inputs', () => {
    for (let price = 5_000; price <= 80_000; price += 2_500) {
      expect(inRange(scoreBudgetFit(price, 30_000))).toBe(true);
    }
    for (let tco = 0; tco <= 150_000; tco += 5_000) {
      expect(inRange(scoreTCO(tco, 30_000))).toBe(true);
    }
    for (let co2 = 0; co2 <= 500; co2 += 25) {
      expect(inRange(scoreEmissions(co2))).toBe(true);
    }
    for (let v = 0; v <= 100; v += 10) {
      expect(inRange(scoreReliability(v))).toBe(true);
      expect(inRange(scoreResale(v))).toBe(true);
    }
  });
});
