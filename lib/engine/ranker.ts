import { resolveLocation } from '../db/locations';
import type {
  LocationData,
  PrimaryUse,
  RecommendationScore,
  UserProfile,
  Vehicle,
  VehicleRecommendation,
  VehicleTypePreference,
} from '../types';
import { TCOCalculator } from './calculator';
import { BUDGET_CEILING_MULTIPLIER, MAX_RECOMMENDATIONS } from './constants';
import {
  calculateTotalScore,
  scoreBudgetFit,
  scoreEmissions,
  scoreReliability,
  scoreResale,
  scoreTCO,
} from './scorer';
import { InputValidator } from './validator';

/** Thrown by {@link VehicleRanker.rankVehicles} when the input is invalid. */
export class ValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join('; '));
    this.name = 'ValidationError';
  }
}

/** How well a vehicle fits the user's type preference: 1 exact, 0.5 partial, 0 none. */
function typeFit(vehicle: Vehicle, preferred: VehicleTypePreference): number {
  switch (preferred) {
    case 'electric':
      // Hybrids are kept for eco-minded users but rank behind true EVs.
      if (vehicle.fuelType === 'electric') return 1;
      return vehicle.fuelType === 'hybrid' ? 0.5 : 0;
    case 'hybrid':
      return vehicle.fuelType === 'hybrid' ? 1 : 0;
    default:
      return vehicle.bodyType === preferred ? 1 : 0;
  }
}

/** Whether a vehicle suits the stated primary use. `daily_commute` has no preference. */
function useFit(vehicle: Vehicle, use: PrimaryUse): number {
  switch (use) {
    case 'luxury':
      return vehicle.isLuxury ? 1 : 0;
    case 'off_road':
      return vehicle.bodyType === 'suv' || vehicle.bodyType === 'truck' ? 1 : 0;
    case 'family_trips':
      return vehicle.bodyType === 'suv' ? 1 : 0;
    case 'daily_commute':
      return 0;
  }
}

/** Dimension names as they read in the explanation template. */
const STRENGTH_LABELS: ReadonlyArray<{
  key: keyof Omit<RecommendationScore, 'total'>;
  label: string;
}> = [
  { key: 'emissions', label: 'low emissions' },
  { key: 'reliability', label: 'reliability' },
  { key: 'tco', label: 'ownership value' },
  { key: 'budgetFit', label: 'budget fit' },
  { key: 'resale', label: 'resale value' },
];

/**
 * Filters, scores and ranks vehicles for a user, following SPEC.md
 * "Algorithm: Ranking & Filtering".
 */
export class VehicleRanker {
  constructor(
    private readonly calculator: TCOCalculator = new TCOCalculator(),
    private readonly validator: InputValidator = new InputValidator(),
  ) {}

  /**
   * Returns the top 5 recommendations, best first (rank 1-5), or an empty
   * array when no vehicle passes the filters.
   *
   * 1. Validate (throws {@link ValidationError}) and apply defaults.
   * 2. Filter: price <= budget x 1.2, reliability >= minimum, CO2 <= maximum.
   * 3. Score each candidate on the five dimensions.
   * 4. Sort. Vehicle-type matching is a *soft* preference: cars that match the
   *    user's vehicle type and primary use come first, then everything else;
   *    within each group the order is total score descending, ties broken by
   *    lower TCO then id (so output is deterministic).
   * 5. Take the top 5 and assign ranks.
   * 6. Write an explanation for each.
   *
   * @param location Regional data. Defaults to the one resolved from `user.location`.
   */
  rankVehicles(
    vehicles: readonly Vehicle[],
    user: UserProfile,
    location?: LocationData,
  ): VehicleRecommendation[] {
    const validation = this.validator.validate(user);
    if (!validation.isValid) throw new ValidationError(validation.errors);

    const profile = this.validator.normalize(user);
    const region = location ?? resolveLocation(profile.location);

    const scored = this.filterCandidates(vehicles, profile).map((vehicle) => {
      const tcoBreakdown = this.calculator.calculateTCO(vehicle, region);
      const dimensions = {
        budgetFit: scoreBudgetFit(vehicle.price, profile.budget),
        tco: scoreTCO(tcoBreakdown.total, profile.budget),
        emissions: scoreEmissions(vehicle.co2PerMile),
        reliability: scoreReliability(vehicle.reliabilityScore),
        resale: scoreResale(vehicle.resaleValue5Yr),
      };
      const scores: RecommendationScore = {
        ...dimensions,
        total: calculateTotalScore(dimensions),
      };
      const preference =
        typeFit(vehicle, profile.preferences.vehicleType) +
        useFit(vehicle, profile.primaryUse);
      return { vehicle, tcoBreakdown, scores, preference };
    });

    scored.sort(
      (a, b) =>
        b.preference - a.preference ||
        b.scores.total - a.scores.total ||
        a.tcoBreakdown.total - b.tcoBreakdown.total ||
        a.vehicle.id.localeCompare(b.vehicle.id),
    );

    return scored.slice(0, MAX_RECOMMENDATIONS).map((entry, index) => {
      const rank = index + 1;
      return {
        ...entry.vehicle,
        rank,
        scores: entry.scores,
        tcoBreakdown: entry.tcoBreakdown,
        explanation: this.generateExplanation(
          entry.vehicle,
          rank,
          entry.scores,
          profile.preferences.desiredFeatures,
        ),
      };
    });
  }

  /**
   * Keeps vehicles that satisfy ALL hard criteria. `profile` must be normalised.
   */
  filterCandidates(vehicles: readonly Vehicle[], profile: UserProfile): Vehicle[] {
    const { minReliabilityScore, maxCO2PerMile } = profile.preferences;
    return vehicles.filter(
      (v) =>
        // Integer-safe form of `price <= budget * 1.2`.
        v.price * 10 <= profile.budget * (BUDGET_CEILING_MULTIPLIER * 10) &&
        v.reliabilityScore >= minReliabilityScore &&
        v.co2PerMile <= maxCO2PerMile,
    );
  }

  /**
   * Builds "[Name] offers [strength 1] at [price] while maintaining strong
   * [strength 2]. It ranks #N due to [differentiator]." (100-200 characters).
   *
   * Strengths are the vehicle's two highest-scoring dimensions; if the user
   * asked for a feature the vehicle has, that feature replaces the second one.
   */
  private generateExplanation(
    vehicle: Vehicle,
    rank: number,
    scores: RecommendationScore,
    desiredFeatures: readonly string[] = [],
  ): string {
    const [primary, secondary] = [...STRENGTH_LABELS].sort(
      (a, b) => scores[b.key] - scores[a.key],
    );
    const matchedFeature = desiredFeatures.find((f) => vehicle.features?.includes(f));
    const secondaryLabel = matchedFeature ?? secondary.label;

    const differentiator =
      rank === 1
        ? `the highest overall score of ${scores.total}/100`
        : `a ${scores.total}/100 overall score`;

    const text =
      `${vehicle.name} offers ${primary.label} at ${formatUsd(vehicle.price)} ` +
      `while maintaining strong ${secondaryLabel}. ` +
      `It ranks #${rank} due to ${differentiator}.`;

    // The fixed template text is ~85 characters and every variable part is
    // bounded (names <= 26, labels <= 17), so this stays within 100-200.
    return text;
  }
}

const formatUsd = (amount: number): string => `$${amount.toLocaleString('en-US')}`;
