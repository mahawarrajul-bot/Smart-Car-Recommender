import { isValidLocation } from '../db/locations';
import type {
  PrimaryUse,
  UserProfile,
  ValidationResult,
  VehicleTypePreference,
} from '../types';
import {
  DEFAULT_MAX_CO2,
  DEFAULT_MIN_RELIABILITY,
  MAX_BUDGET,
  MAX_CO2_RANGE,
  MIN_BUDGET,
  MIN_RELIABILITY_RANGE,
} from './constants';

const PRIMARY_USES: readonly PrimaryUse[] = [
  'daily_commute',
  'family_trips',
  'off_road',
  'luxury',
];

const VEHICLE_TYPES: readonly VehicleTypePreference[] = [
  'sedan',
  'suv',
  'truck',
  'electric',
  'hybrid',
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isMissing = (value: unknown): boolean => value === undefined || value === null;

const inRange = (value: number, range: { min: number; max: number }): boolean =>
  value >= range.min && value <= range.max;

/** Validates raw input against the rules in SPEC.md "Input Validation". */
export class InputValidator {
  /**
   * Checks `input` and reports every problem found. Never throws.
   *
   * - budget: $10,000-$50,000 (required)
   * - primaryUse, preferences.vehicleType: must be a known value (required)
   * - preferences.minReliabilityScore: 50-100 when provided (default 70)
   * - preferences.maxCO2PerMile: 100-300 when provided (default 250)
   * - location: never an error; invalid values fall back to DEFAULT
   *   (see {@link normalize})
   */
  validate(input: unknown): ValidationResult {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { isValid: false, errors: ['Input must be an object'] };
    }
    const data = input as Record<string, unknown>;
    const errors: string[] = [];

    if (
      !isFiniteNumber(data.budget) ||
      data.budget < MIN_BUDGET ||
      data.budget > MAX_BUDGET
    ) {
      errors.push('Budget must be between $10,000 and $50,000');
    }

    if (!PRIMARY_USES.includes(data.primaryUse as PrimaryUse)) {
      errors.push(
        'Invalid primary use. Choose: daily_commute, family_trips, off_road, or luxury',
      );
    }

    const prefs = data.preferences;
    if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) {
      errors.push('Preferences are required');
      return { isValid: false, errors };
    }
    const preferences = prefs as Record<string, unknown>;

    if (!VEHICLE_TYPES.includes(preferences.vehicleType as VehicleTypePreference)) {
      errors.push('Invalid vehicle type');
    }

    const minReliability = preferences.minReliabilityScore;
    if (
      !isMissing(minReliability) &&
      (!isFiniteNumber(minReliability) || !inRange(minReliability, MIN_RELIABILITY_RANGE))
    ) {
      errors.push('Reliability score must be 50-100');
    }

    const maxCO2 = preferences.maxCO2PerMile;
    if (!isMissing(maxCO2) && (!isFiniteNumber(maxCO2) || !inRange(maxCO2, MAX_CO2_RANGE))) {
      errors.push('CO2 limit must be 100-300 g/mile');
    }

    const features = preferences.desiredFeatures;
    if (
      !isMissing(features) &&
      (!Array.isArray(features) || features.some((f) => typeof f !== 'string'))
    ) {
      errors.push('Desired features must be a list of text values');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Fills in defaults for a profile that passed {@link validate}:
   * minReliabilityScore 70, maxCO2PerMile 250, and `location: 'DEFAULT'` when
   * the location is missing or invalid (a warning is logged in that case).
   */
  normalize(profile: UserProfile): UserProfile {
    let location = profile.location;
    if (!isValidLocation(location)) {
      console.warn(`Invalid location "${String(location)}"; using DEFAULT`);
      location = 'DEFAULT';
    }

    return {
      ...profile,
      location,
      preferences: {
        ...profile.preferences,
        minReliabilityScore:
          profile.preferences.minReliabilityScore ?? DEFAULT_MIN_RELIABILITY,
        maxCO2PerMile: profile.preferences.maxCO2PerMile ?? DEFAULT_MAX_CO2,
      },
    };
  }
}
