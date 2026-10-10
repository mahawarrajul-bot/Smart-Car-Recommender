/**
 * Core domain types for the Smart Car Recommender.
 * Mirrors the "Data Structures" section of SPEC.md.
 */

/** What the car will mainly be used for. Softly steers which vehicles are preferred. */
export type PrimaryUse = 'daily_commute' | 'family_trips' | 'off_road' | 'luxury';

/** Vehicle type a user can ask for. */
export type VehicleTypePreference = 'sedan' | 'suv' | 'truck' | 'electric' | 'hybrid';

/** How a vehicle is powered. Determines the fuel cost formula. */
export type FuelType = 'gas' | 'electric' | 'hybrid' | 'diesel';

/**
 * Body class of a vehicle. Compact hatchbacks are grouped under `'sedan'`.
 * (Not in SPEC.md's `Vehicle`, but required for the insurance multiplier and
 * the sedan/suv/truck preference filter.)
 */
export type BodyType = 'sedan' | 'suv' | 'truck';

/** Input collected from the user. */
export interface UserProfile {
  /**
   * Target purchase price in USD.
   * Constraint: $10,000 - $50,000. Example: 40000.
   */
  budget: number;

  /** What the car is mainly used for. Affects vehicle type preference. */
  primaryUse: PrimaryUse;

  /**
   * 5-digit US zip code, state abbreviation, or `'DEFAULT'`.
   * Examples: `'90210'`, `'CA'`, `'DEFAULT'`.
   * Used for insurance multipliers and electricity rates. Invalid values fall
   * back to `'DEFAULT'`.
   */
  location: string;

  preferences: {
    /** Preferred vehicle type; matched against fuel type or body class. */
    vehicleType: VehicleTypePreference;

    /**
     * Lowest acceptable reliability score.
     * Constraint: 50 - 100 inclusive. Default: 70 when not provided.
     */
    minReliabilityScore: number;

    /**
     * Highest acceptable CO2 in grams per mile.
     * Constraint: 100 - 300 inclusive. Default: 250 when not provided.
     * Example: 150 (strict eco-conscious buyer).
     */
    maxCO2PerMile: number;

    /**
     * Optional wish list, e.g. `['autopilot', 'towing', 'leather-seats', 'awd']`.
     * Does NOT filter; used only to word the explanation.
     */
    desiredFeatures?: string[];
  };
}

/** A vehicle in the catalog. */
export interface Vehicle {
  /** Unique id or short code. Example: `'tesla-model-3-2024'`. */
  id: string;

  /** Display name. Example: `'Tesla Model 3'`. */
  name: string;

  /** Model year. Constraint: 2020-2026. */
  year: number;

  /** MSRP in USD. Example: 40000. */
  price: number;

  /** Determines the fuel cost calculation. */
  fuelType: FuelType;

  /**
   * Combined EPA miles per gallon for gas, diesel and hybrid cars.
   * Constraint: 15-50. Example: 28.
   */
  mpg?: number;

  /** Battery capacity in kWh for electric/hybrid cars. Example: 75. */
  batteryCapacity?: number;

  /**
   * Reliability on a 0-100 scale (higher is better).
   * Sources: JD Power, Consumer Reports, Edmunds. Example: 88.
   */
  reliabilityScore: number;

  /**
   * Percentage of the original price retained after 5 years.
   * Constraint: 30-80. Example: 65 means a $40k car is worth $26k.
   */
  resaleValue5Yr: number;

  /**
   * Grams of CO2 per mile. Gas ~150-250, electric ~120 (grid power plus
   * manufacturing), hybrid ~100-150. Example: 120.
   */
  co2PerMile: number;

  /** Body class, used for the insurance multiplier and type preference. */
  bodyType: BodyType;

  /** Luxury-brand vehicles carry a higher insurance multiplier (1.3). */
  isLuxury: boolean;

  /** Optional features, e.g. `['autopilot', 'towing', 'leather-seats', 'awd']`. */
  features?: string[];
}

/** Regional cost inputs. */
export interface LocationData {
  /** 5-digit zip code this entry represents. */
  zipCode: string;

  /** State abbreviation, or `'DEFAULT'`. */
  state: string;

  /**
   * Insurance cost relative to the national average.
   * Constraint: 0.8 - 1.5. California = 1.3, Texas = 0.95.
   */
  insuranceMultiplier: number;

  /**
   * Electricity price in $/kWh for charging EVs.
   * Constraint: $0.10 - $0.30. California = 0.18, Texas = 0.12.
   */
  electricityRate: number;
}

/** Per-dimension scores, each 0-100, plus the weighted total. */
export interface RecommendationScore {
  /** How close the car's price is to the user's budget. */
  budgetFit: number;

  /** Total cost of ownership score; lower TCO scores higher. */
  tco: number;

  /** Environmental impact; lower emissions score higher. */
  emissions: number;

  /** The vehicle's reliability score, as-is. */
  reliability: number;

  /** The vehicle's 5-year resale percentage, as-is. */
  resale: number;

  /**
   * Weighted average, rounded:
   * `budgetFit*0.25 + tco*0.25 + emissions*0.20 + reliability*0.20 + resale*0.10`.
   */
  total: number;
}

/** Itemised 5-year cost of ownership in whole dollars. */
export interface TCOBreakdown {
  /** Vehicle MSRP. */
  purchasePrice: number;

  /** Total fuel or electricity over 5 years. */
  fuelCost5Yr: number;

  /** Total insurance over 5 years. */
  insuranceCost5Yr: number;

  /** Total maintenance over 5 years. */
  maintenanceCost5Yr: number;

  /** Expected sale price after 5 years: `purchasePrice * (resaleValue5Yr / 100)`. */
  resaleValue: number;

  /** `purchasePrice + fuel + insurance + maintenance - resaleValue`. */
  total: number;
}

/** A ranked recommendation returned to the caller. */
export interface VehicleRecommendation extends Vehicle {
  /** 1-5; 1 is the best match. */
  rank: number;

  /** All five dimensions plus the weighted total. */
  scores: RecommendationScore;

  /** Detailed cost breakdown for the user's location. */
  tcoBreakdown: TCOBreakdown;

  /**
   * Human-readable "why this car ranks here", 100-200 characters, mentioning
   * the rank.
   */
  explanation: string;
}

/** Machine-readable error codes returned by `POST /api/recommend`. */
export type ApiErrorCode = 'VALIDATION_ERROR' | 'NO_MATCHES' | 'INTERNAL_ERROR';

/** Diagnostics attached to a successful recommendation response. */
export interface ApiMeta {
  /** ISO 8601 timestamp of when the response was generated. */
  generatedAt: string;

  /** Server-side processing time in milliseconds. */
  processTime: number;

  /** Number of vehicles in the catalog that were evaluated. */
  vehiclesConsidered: number;

  /** Number of vehicles that passed the hard filters (before taking the top 5). */
  vehiclesFiltered: number;

  /** Total score of the #1 recommendation. */
  topRankScore: number;
}

/** `POST /api/recommend` success body. */
export interface ApiSuccessResponse {
  success: true;
  recommendations: VehicleRecommendation[];
  meta: ApiMeta;
}

/** `POST /api/recommend` error body. */
export interface ApiErrorResponse {
  success: false;
  /** User-friendly message. */
  error: string;
  code: ApiErrorCode;
}

/** Any body returned by `POST /api/recommend`. */
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

/** Result of validating raw user input. */
export interface ValidationResult {
  /** `true` when `errors` is empty. */
  isValid: boolean;

  /** User-facing messages, one per problem. */
  errors: string[];
}
