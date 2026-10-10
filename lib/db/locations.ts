import type { LocationData } from '../types';

/** Fallback used when a location is missing or invalid (national average). */
export const DEFAULT_LOCATION: LocationData = {
  zipCode: '00000',
  state: 'DEFAULT',
  insuranceMultiplier: 1.0,
  electricityRate: 0.15,
};

/**
 * Regional cost data keyed by state abbreviation (plus `'DEFAULT'`).
 * CA and TX come from SPEC.md; NY is an estimate (higher-than-average
 * insurance and electricity) within the spec's allowed ranges.
 */
export const LOCATION_DATA: Readonly<Record<string, LocationData>> = {
  CA: { zipCode: '90210', state: 'CA', insuranceMultiplier: 1.3, electricityRate: 0.18 },
  TX: { zipCode: '77001', state: 'TX', insuranceMultiplier: 0.95, electricityRate: 0.12 },
  NY: { zipCode: '10001', state: 'NY', insuranceMultiplier: 1.25, electricityRate: 0.2 },
  DEFAULT: DEFAULT_LOCATION,
};

/** All 50 states plus DC; any of these is a valid location. */
const STATE_CODES: ReadonlySet<string> = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

const ZIP_PATTERN = /^\d{5}$/;

/**
 * Maps a zip code to a state with cost data using its 3-digit prefix.
 * Only states in {@link LOCATION_DATA} are mapped; other zips use DEFAULT.
 */
function stateForZip(zip: string): string | undefined {
  const prefix = Number(zip.slice(0, 3));
  if (prefix >= 900 && prefix <= 961) return 'CA';
  if ((prefix >= 750 && prefix <= 799) || prefix === 885 || prefix === 733) return 'TX';
  if ((prefix >= 100 && prefix <= 149) || prefix === 5 || prefix === 63) return 'NY';
  return undefined;
}

/** `true` for `'DEFAULT'`, a 5-digit zip code, or a US state abbreviation. */
export function isValidLocation(location: unknown): boolean {
  if (typeof location !== 'string') return false;
  const value = location.trim().toUpperCase();
  return value === 'DEFAULT' || ZIP_PATTERN.test(value) || STATE_CODES.has(value);
}

/**
 * Resolves a zip, state abbreviation or `'DEFAULT'` to cost data.
 * Invalid input, and valid locations without regional data, resolve to
 * {@link DEFAULT_LOCATION}.
 */
export function resolveLocation(location: unknown): LocationData {
  if (!isValidLocation(location)) return DEFAULT_LOCATION;

  const value = (location as string).trim().toUpperCase();
  const state = ZIP_PATTERN.test(value) ? stateForZip(value) : value;
  return (state && LOCATION_DATA[state]) || DEFAULT_LOCATION;
}
