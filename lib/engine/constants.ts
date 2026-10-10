/** Numbers from SPEC.md "Calculation Formulas" and "Input Validation". */

// ---- TCO ----
export const OWNERSHIP_YEARS = 5;
export const ANNUAL_MILES = 12_000;
export const TOTAL_MILES = ANNUAL_MILES * OWNERSHIP_YEARS; // 60,000

/** Fixed gas price in $/gallon. */
export const GAS_PRICE_PER_GALLON = 3.5;

/** Fixed EV efficiency in miles per kWh. */
export const EV_MILES_PER_KWH = 3.5;

/** Hybrids are assumed to deliver 60% of their nominal mpg. */
export const HYBRID_MPG_FACTOR = 0.6;

/** Base annual insurance in USD before multipliers. */
export const BASE_ANNUAL_INSURANCE = 1_200;

export const INSURANCE_TYPE_MULTIPLIER = {
  sedan: 1.0,
  suv: 1.1,
  truck: 1.2,
  electric: 0.95,
  luxury: 1.3,
} as const;

/** Annual maintenance cost by reliability tier. */
export const MAINTENANCE_COST = {
  /** reliability >= 90 */
  high: 600,
  /** reliability >= 70 */
  medium: 900,
  /** reliability < 70 */
  low: 1_200,
} as const;

// ---- Filtering and ranking ----
/** Vehicles priced above `budget * 1.2` are filtered out. */
export const BUDGET_CEILING_MULTIPLIER = 1.2;
export const MAX_RECOMMENDATIONS = 5;

// ---- Validation ----
export const MIN_BUDGET = 10_000;
export const MAX_BUDGET = 50_000;
export const MIN_RELIABILITY_RANGE = { min: 50, max: 100 } as const;
export const MAX_CO2_RANGE = { min: 100, max: 300 } as const;
export const DEFAULT_MIN_RELIABILITY = 70;
export const DEFAULT_MAX_CO2 = 250;
