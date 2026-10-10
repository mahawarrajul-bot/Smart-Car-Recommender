import type { RecommendationScore } from '../types';
import { BUDGET_CEILING_MULTIPLIER } from './constants';

/**
 * Weights for the weighted total. They sum to 1 (100%).
 * Cost matters most (budget + TCO = 50%), then environment and reliability
 * (20% each); resale is a tiebreaker-sized 10%.
 */
export const SCORE_WEIGHTS = {
  budgetFit: 0.25,
  tco: 0.25,
  emissions: 0.2,
  reliability: 0.2,
  resale: 0.1,
} as const;

/** Per SPEC.md every score is a whole number in 0-100. */
const toScore = (value: number): number => Math.round(Math.min(100, Math.max(0, value)));

/**
 * Budget fit, 0-100.
 *
 * At or under budget is a perfect fit (we never penalise saving money). Over
 * budget the score is `budget / price`, so it falls smoothly with every extra
 * dollar. Past the 20% ceiling the car would already have been filtered out, so
 * it scores 0.
 */
export function scoreBudgetFit(price: number, budget: number): number {
  if (price <= budget) return 100;
  // Integer-safe form of `price <= budget * 1.2` (avoids float error at the edge).
  if (price * 10 <= budget * (BUDGET_CEILING_MULTIPLIER * 10)) {
    return toScore((budget / price) * 100);
  }
  return 0;
}

/**
 * TCO score, 0-100. Lower cost of ownership scores higher.
 *
 * The scale is anchored to the user's budget rather than to the other
 * candidates, so a score means the same thing whichever cars are in the pool.
 * The "worst case" is twice the budget: a TCO of 0 would score 100 and a TCO of
 * `2 x budget` scores 0.
 */
export function scoreTCO(tco: number, budget: number): number {
  const worstCaseTco = budget * 2;
  return toScore(100 - (tco / worstCaseTco) * 100);
}

/**
 * Emissions score, 0-100, from grams of CO2 per mile.
 *
 * Under 150 g/mi earns full marks. From 150 to 300 g/mi the score slides
 * linearly from 100 down to 20. Above 300 it stays at 20: very dirty cars are
 * penalised but never zeroed, since the other dimensions still matter.
 */
export function scoreEmissions(co2PerMile: number): number {
  if (co2PerMile < 150) return 100;
  if (co2PerMile > 300) return 20;
  return toScore(100 - ((co2PerMile - 150) / 150) * 80);
}

/** Reliability score: the vehicle's 0-100 rating, used as-is. */
export function scoreReliability(reliabilityScore: number): number {
  return toScore(reliabilityScore);
}

/** Resale score: the 5-year retained percentage (30-80), used as-is. */
export function scoreResale(resalePercentage: number): number {
  return toScore(resalePercentage);
}

/** Weighted average of the five dimensions, rounded to a whole number. */
export function calculateTotalScore(scores: Omit<RecommendationScore, 'total'>): number {
  return toScore(
    scores.budgetFit * SCORE_WEIGHTS.budgetFit +
      scores.tco * SCORE_WEIGHTS.tco +
      scores.emissions * SCORE_WEIGHTS.emissions +
      scores.reliability * SCORE_WEIGHTS.reliability +
      scores.resale * SCORE_WEIGHTS.resale,
  );
}
