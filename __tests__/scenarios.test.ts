import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../data/vehicles';
import { VehicleRanker } from '../lib/engine/ranker';
import type { UserProfile } from '../lib/types';

/** End-to-end runs of the examples in SPEC.md ("Examples" and Test Suite 4). */
const ranker = new VehicleRanker();

describe('Example 1: eco-conscious buyer in California', () => {
  const profile: UserProfile = {
    budget: 40_000,
    primaryUse: 'daily_commute',
    location: '90210',
    preferences: {
      vehicleType: 'electric',
      minReliabilityScore: 80,
      maxCO2PerMile: 150,
      desiredFeatures: ['autopilot'],
    },
  };
  const result = ranker.rankVehicles(VEHICLES, profile);

  it('ranks the Tesla Model 3 first, followed by other EVs', () => {
    expect(result).toHaveLength(5);
    expect(result[0].name).toBe('Tesla Model 3');
    expect(result.every((r) => r.fuelType === 'electric')).toBe(true);
  });

  it('scores the Tesla with the spec formulas', () => {
    expect(result[0].scores).toEqual({
      budgetFit: 100,
      tco: 64, // spec text says 85, but its own TCO formula gives 64
      emissions: 100,
      reliability: 88,
      resale: 65,
      total: 85,
    });
  });

  it('computes the Tesla TCO with California rates ($0.18/kWh, 1.3x insurance)', () => {
    expect(result[0].tcoBreakdown).toEqual({
      purchasePrice: 40_000,
      fuelCost5Yr: 3_086,
      insuranceCost5Yr: 7_410,
      maintenanceCost5Yr: 4_500,
      resaleValue: 26_000,
      total: 28_996,
    });
  });

  it('mentions the requested autopilot feature and the rank', () => {
    expect(result[0].explanation).toContain('autopilot');
    expect(result[0].explanation).toContain('#1');
  });
});

describe('Example 2: budget-conscious family buyer in Texas', () => {
  const profile: UserProfile = {
    budget: 25_000,
    primaryUse: 'family_trips',
    location: '77001',
    preferences: {
      vehicleType: 'suv',
      minReliabilityScore: 75,
      maxCO2PerMile: 250,
      desiredFeatures: ['spacious-interior'],
    },
  };
  const result = ranker.rankVehicles(VEHICLES, profile);

  it('recommends the Honda CR-V first, with only SUVs in the top 5', () => {
    expect(result[0].name).toBe('Honda CR-V');
    expect(result.every((r) => r.bodyType === 'suv')).toBe(true);
  });

  it('has a CR-V TCO near the spec estimate of ~$28,500 (+/- $500)', () => {
    expect(Math.abs(result[0].tcoBreakdown.total - 28_500)).toBeLessThanOrEqual(500);
  });

  it('keeps every pick within 120% of budget ($30,000)', () => {
    expect(result.every((r) => r.price <= 30_000)).toBe(true);
  });
});

describe('Example 3: no matches', () => {
  it('returns no recommendations for a $15k luxury EV with 90+ reliability', () => {
    const profile: UserProfile = {
      budget: 15_000,
      primaryUse: 'luxury',
      location: 'DEFAULT',
      preferences: {
        vehicleType: 'electric',
        minReliabilityScore: 90,
        maxCO2PerMile: 100,
        desiredFeatures: [],
      },
    };
    expect(ranker.rankVehicles(VEHICLES, profile)).toEqual([]);
  });
});

describe('Test Suite 4: ranking behaviour', () => {
  it('4.2 budget-conscious sedan buyer gets a Corolla or Civic first', () => {
    const result = ranker.rankVehicles(VEHICLES, {
      budget: 25_000,
      primaryUse: 'daily_commute',
      location: 'DEFAULT',
      preferences: { vehicleType: 'sedan', minReliabilityScore: 70, maxCO2PerMile: 250 },
    });
    expect(result[0].name).toMatch(/Corolla|Civic/);
    expect(result.every((r) => r.bodyType === 'sedan')).toBe(true);
    expect(result.every((r) => r.price <= 30_000)).toBe(true);
  });

  it('4.3 luxury buyer sees the luxury sedans first, led by the Lexus ES 300h', () => {
    const result = ranker.rankVehicles(VEHICLES, {
      budget: 50_000,
      primaryUse: 'luxury',
      location: 'DEFAULT',
      preferences: { vehicleType: 'sedan', minReliabilityScore: 60, maxCO2PerMile: 250 },
    });
    expect(result[0].name).toBe('Lexus ES 300h');
    expect(result.slice(0, 4).every((r) => r.isLuxury)).toBe(true);
    expect(result.slice(0, 4).map((r) => r.name).sort()).toEqual([
      'Audi A4',
      'BMW 330i',
      'Lexus ES 300h',
      'Mercedes-Benz C 300',
    ]);
  });
});
