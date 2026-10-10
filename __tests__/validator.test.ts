import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputValidator } from '../lib/engine/validator';
import type { UserProfile } from '../lib/types';

const validator = new InputValidator();

const valid = (): UserProfile => ({
  budget: 40_000,
  primaryUse: 'daily_commute',
  location: '90210',
  preferences: {
    vehicleType: 'electric',
    minReliabilityScore: 80,
    maxCO2PerMile: 150,
    desiredFeatures: [],
  },
});

afterEach(() => vi.restoreAllMocks());

describe('InputValidator.validate', () => {
  it('accepts the SPEC.md valid example', () => {
    expect(validator.validate(valid())).toEqual({ isValid: true, errors: [] });
  });

  it.each([10_000, 50_000])('accepts a budget of %i (inclusive bounds)', (budget) => {
    expect(validator.validate({ ...valid(), budget }).isValid).toBe(true);
  });

  it.each([9_999, 50_001, 60_000, 5_000, Number.NaN, '40000', undefined])(
    'rejects budget %s',
    (budget) => {
      expect(validator.validate({ ...valid(), budget })).toEqual({
        isValid: false,
        errors: ['Budget must be between $10,000 and $50,000'],
      });
    },
  );

  it('reports every problem at once', () => {
    const input = {
      ...valid(),
      budget: 5_000,
      preferences: { ...valid().preferences, minReliabilityScore: 120 },
    };
    expect(validator.validate(input)).toEqual({
      isValid: false,
      errors: ['Budget must be between $10,000 and $50,000', 'Reliability score must be 50-100'],
    });
  });

  it('rejects an unknown primary use and vehicle type', () => {
    const input = {
      ...valid(),
      primaryUse: 'racing',
      preferences: { ...valid().preferences, vehicleType: 'bus' },
    };
    const { errors } = validator.validate(input);
    expect(errors).toContain(
      'Invalid primary use. Choose: daily_commute, family_trips, off_road, or luxury',
    );
    expect(errors).toContain('Invalid vehicle type');
  });

  it.each([49, 101])('rejects minReliabilityScore %i', (minReliabilityScore) => {
    const input = { ...valid(), preferences: { ...valid().preferences, minReliabilityScore } };
    expect(validator.validate(input).errors).toEqual(['Reliability score must be 50-100']);
  });

  it.each([99, 301])('rejects maxCO2PerMile %i', (maxCO2PerMile) => {
    const input = { ...valid(), preferences: { ...valid().preferences, maxCO2PerMile } };
    expect(validator.validate(input).errors).toEqual(['CO2 limit must be 100-300 g/mile']);
  });

  it('allows minReliabilityScore and maxCO2PerMile to be omitted', () => {
    const { minReliabilityScore: _a, maxCO2PerMile: _b, ...rest } = valid().preferences;
    expect(validator.validate({ ...valid(), preferences: rest }).isValid).toBe(true);
  });

  it('never treats an invalid location as an error', () => {
    expect(validator.validate({ ...valid(), location: 'INVALID' }).isValid).toBe(true);
  });

  it('rejects non-object input and missing preferences', () => {
    expect(validator.validate(null).isValid).toBe(false);
    expect(validator.validate('nope').isValid).toBe(false);
    const { preferences: _p, ...noPrefs } = valid();
    expect(validator.validate(noPrefs).errors).toContain('Preferences are required');
  });
});

describe('InputValidator.normalize', () => {
  it('applies defaults of 70 reliability and 250 g/mi CO2', () => {
    const { minReliabilityScore: _a, maxCO2PerMile: _b, ...rest } = valid().preferences;
    const normalized = validator.normalize({ ...valid(), preferences: rest } as UserProfile);
    expect(normalized.preferences.minReliabilityScore).toBe(70);
    expect(normalized.preferences.maxCO2PerMile).toBe(250);
  });

  it('keeps provided values', () => {
    expect(validator.normalize(valid()).preferences).toMatchObject({
      minReliabilityScore: 80,
      maxCO2PerMile: 150,
    });
  });

  it.each(['INVALID', '1234', '', 42])('falls back to DEFAULT (with a warning) for %j', (location) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const normalized = validator.normalize({ ...valid(), location } as unknown as UserProfile);
    expect(normalized.location).toBe('DEFAULT');
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each(['90210', 'CA', 'ca', 'DEFAULT'])('keeps valid location %s', (location) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(validator.normalize({ ...valid(), location }).location).toBe(location);
    expect(warn).not.toHaveBeenCalled();
  });
});
