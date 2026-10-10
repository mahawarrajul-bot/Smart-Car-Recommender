import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../data/vehicles';
import { LOCATION_DATA } from '../lib/db/locations';
import { InputValidator } from '../lib/engine/validator';
import { ValidationError, VehicleRanker } from '../lib/engine/ranker';
import type { UserProfile, Vehicle, VehicleTypePreference } from '../lib/types';

const ranker = new VehicleRanker();
const validator = new InputValidator();

const car = (id: string): Vehicle => {
  const found = VEHICLES.find((v) => v.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found;
};
const civic = car('honda-civic-2024');
const tesla = car('tesla-model-3-2024');

const user = (
  overrides: Partial<Omit<UserProfile, 'preferences'>> & {
    preferences?: Partial<UserProfile['preferences']>;
  } = {},
): UserProfile => ({
  budget: 25_000,
  primaryUse: 'daily_commute',
  location: 'DEFAULT',
  ...overrides,
  preferences: {
    vehicleType: 'sedan',
    minReliabilityScore: 50,
    maxCO2PerMile: 300,
    ...overrides.preferences,
  },
});

const candidatesFor = (profile: UserProfile, pool: readonly Vehicle[] = VEHICLES): Vehicle[] =>
  ranker.filterCandidates(pool, validator.normalize(profile));

describe('catalog', () => {
  it('has 50 unique vehicles within the spec constraints', () => {
    expect(VEHICLES).toHaveLength(50);
    expect(new Set(VEHICLES.map((v) => v.id)).size).toBe(50);
    for (const v of VEHICLES) {
      expect(v.year).toBeGreaterThanOrEqual(2020);
      expect(v.year).toBeLessThanOrEqual(2026);
      expect(v.resaleValue5Yr).toBeGreaterThanOrEqual(30);
      expect(v.resaleValue5Yr).toBeLessThanOrEqual(80);
      expect(v.reliabilityScore).toBeLessThanOrEqual(100);
      if (v.fuelType === 'electric') {
        expect(v.mpg).toBeUndefined();
      } else {
        expect(v.mpg).toBeGreaterThanOrEqual(15);
        expect(v.mpg).toBeLessThanOrEqual(50);
      }
    }
  });
});

describe('filtering', () => {
  it('removes cars above budget x 1.2 (budget $20k keeps only cars <= $24k)', () => {
    const result = candidatesFor(user({ budget: 20_000 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((v) => v.price <= 24_000)).toBe(true);
    expect(result.map((v) => v.id).sort()).toEqual(
      VEHICLES.filter((v) => v.price <= 24_000).map((v) => v.id).sort(),
    );
  });

  it('keeps a car at exactly 120% of budget and drops one dollar more', () => {
    const atLimit = { ...civic, id: 'at-limit', price: 48_000 };
    const over = { ...civic, id: 'over', price: 48_001 };
    const ids = candidatesFor(user({ budget: 40_000 }), [atLimit, over]).map((v) => v.id);
    expect(ids).toEqual(['at-limit']);
  });

  it('removes cars below the reliability minimum', () => {
    const result = candidatesFor(user({ budget: 50_000, preferences: { minReliabilityScore: 80 } }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((v) => v.reliabilityScore >= 80)).toBe(true);
  });

  it('removes cars above the CO2 limit (150 g/mi leaves only EVs and hybrids)', () => {
    const result = candidatesFor(user({ budget: 50_000, preferences: { maxCO2PerMile: 150 } }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((v) => v.co2PerMile <= 150)).toBe(true);
    expect(result.every((v) => v.fuelType === 'electric' || v.fuelType === 'hybrid')).toBe(true);
  });

  it('requires ALL criteria when combined', () => {
    const result = candidatesFor(
      user({ budget: 30_000, preferences: { minReliabilityScore: 75, maxCO2PerMile: 200 } }),
    );
    expect(result.length).toBeGreaterThan(0);
    for (const v of result) {
      expect(v.price).toBeLessThanOrEqual(36_000);
      expect(v.reliabilityScore).toBeGreaterThanOrEqual(75);
      expect(v.co2PerMile).toBeLessThanOrEqual(200);
    }
  });

  it('applies the default 70 reliability and 250 g/mi CO2 when omitted', () => {
    const profile = user({ budget: 50_000 });
    delete (profile.preferences as Partial<UserProfile['preferences']>).minReliabilityScore;
    delete (profile.preferences as Partial<UserProfile['preferences']>).maxCO2PerMile;
    const result = candidatesFor(profile);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((v) => v.reliabilityScore >= 70 && v.co2PerMile <= 250)).toBe(true);
  });
});

describe('rankVehicles', () => {
  it('throws ValidationError with the validator messages for bad input', () => {
    const bad = user({ budget: 5_000 });
    expect(() => ranker.rankVehicles(VEHICLES, bad)).toThrow(ValidationError);
    try {
      ranker.rankVehicles(VEHICLES, bad);
    } catch (e) {
      expect((e as ValidationError).errors).toEqual(['Budget must be between $10,000 and $50,000']);
    }
  });

  it('returns an empty array when nothing matches', () => {
    expect(
      ranker.rankVehicles(VEHICLES, user({ budget: 10_000, preferences: { minReliabilityScore: 95 } })),
    ).toEqual([]);
  });

  it('returns at most 5 results with ranks 1..n', () => {
    const result = ranker.rankVehicles(VEHICLES, user());
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts by total score, highest first', () => {
    // Same car, only reliability differs, so total score must follow it.
    const pool = [70, 95, 80, 85, 75, 90].map((reliabilityScore, i) => ({
      ...civic,
      id: `civic-${i}`,
      reliabilityScore,
    }));
    const result = ranker.rankVehicles(pool, user());
    expect(result.map((r) => r.reliabilityScore)).toEqual([95, 90, 85, 80, 75]);
    const totals = result.map((r) => r.scores.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it('keeps total scores non-increasing for a realistic sedan search', () => {
    const totals = ranker.rankVehicles(VEHICLES, user()).map((r) => r.scores.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it('breaks exact ties deterministically (lower TCO, then id)', () => {
    const pool = ['c', 'a', 'b'].map((id) => ({ ...civic, id }));
    expect(ranker.rankVehicles(pool, user()).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the vehicle list', () => {
    const before = VEHICLES.map((v) => v.id);
    ranker.rankVehicles(VEHICLES, user());
    expect(VEHICLES.map((v) => v.id)).toEqual(before);
  });

  it('puts true EVs ahead of hybrids for an electric preference, even with weaker scores', () => {
    const weakEv: Vehicle = { ...tesla, id: 'weak-ev', reliabilityScore: 55, resaleValue5Yr: 30 };
    const result = ranker.rankVehicles(
      [weakEv, car('toyota-camry-2025')],
      user({ budget: 40_000, preferences: { vehicleType: 'electric', maxCO2PerMile: 150 } }),
    );
    expect(result.map((r) => r.id)).toEqual(['weak-ev', 'toyota-camry-2025']);
  });

  it('treats vehicle type as a preference, not a filter', () => {
    const result = ranker.rankVehicles(
      VEHICLES,
      user({ budget: 30_000, preferences: { vehicleType: 'truck', minReliabilityScore: 70, maxCO2PerMile: 250 } }),
    );
    expect(result).toHaveLength(5);
    expect(result[0].bodyType).toBe('truck');
    expect(result.slice(1).some((r) => r.bodyType !== 'truck')).toBe(true);
  });

  it('uses the location given, defaulting to the one on the profile', () => {
    const profile = user({ budget: 40_000, location: 'TX' });
    const viaProfile = ranker.rankVehicles([tesla], profile)[0];
    const explicitCA = ranker.rankVehicles([tesla], profile, LOCATION_DATA.CA)[0];
    expect(viaProfile.tcoBreakdown.insuranceCost5Yr).toBe(5_415);
    expect(explicitCA.tcoBreakdown.insuranceCost5Yr).toBe(7_410);
    expect(explicitCA.tcoBreakdown.total).toBeGreaterThan(viaProfile.tcoBreakdown.total);
  });

  it('keeps every score within 0-100', () => {
    const result = ranker.rankVehicles(VEHICLES, user({ budget: 45_000 }));
    for (const r of result) {
      for (const value of Object.values(r.scores)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('explanations', () => {
  const types: VehicleTypePreference[] = ['sedan', 'suv', 'truck', 'electric', 'hybrid'];

  it('exist, are 100-200 characters and mention the rank, across many searches', () => {
    let checked = 0;
    for (const budget of [12_000, 20_000, 30_000, 40_000, 50_000]) {
      for (const vehicleType of types) {
        const result = ranker.rankVehicles(
          VEHICLES,
          user({ budget, preferences: { vehicleType, maxCO2PerMile: 300 } }),
        );
        for (const r of result) {
          expect(r.explanation.length).toBeGreaterThanOrEqual(100);
          expect(r.explanation.length).toBeLessThanOrEqual(200);
          expect(r.explanation).toContain(`#${r.rank}`);
          expect(r.explanation).toContain(r.name);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('mentions a desired feature the vehicle has', () => {
    const [top] = ranker.rankVehicles(
      [tesla],
      user({ budget: 40_000, preferences: { desiredFeatures: ['autopilot'] } }),
    );
    expect(top.explanation).toContain('autopilot');
  });

  it('ignores desired features the vehicle lacks', () => {
    const [top] = ranker.rankVehicles(
      [civic],
      user({ preferences: { desiredFeatures: ['autopilot'] } }),
    );
    expect(top.explanation).not.toContain('autopilot');
  });
});
