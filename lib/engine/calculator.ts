import type { LocationData, TCOBreakdown, Vehicle } from '../types';
import {
  BASE_ANNUAL_INSURANCE,
  EV_MILES_PER_KWH,
  GAS_PRICE_PER_GALLON,
  HYBRID_MPG_FACTOR,
  INSURANCE_TYPE_MULTIPLIER,
  MAINTENANCE_COST,
  OWNERSHIP_YEARS,
  TOTAL_MILES,
} from './constants';

/**
 * Computes 5-year total cost of ownership per SPEC.md section "TCO":
 *
 *   total = purchase + fuel + insurance + maintenance - resale
 *
 * Assumes 12,000 miles/year (60,000 total). Every component is rounded to
 * whole dollars, and `total` is the sum of the rounded components so the
 * breakdown always adds up.
 */
export class TCOCalculator {
  /**
   * @param vehicle  Vehicle to evaluate.
   * @param location Resolved regional data (see `resolveLocation`).
   * @returns Itemised breakdown, including `total`.
   * @throws {Error} If a gas/diesel/hybrid vehicle has no positive `mpg`.
   */
  calculateTCO(vehicle: Vehicle, location: LocationData): TCOBreakdown {
    const purchasePrice = vehicle.price;
    const fuelCost5Yr = Math.round(this.fuelCost(vehicle, location));
    const insuranceCost5Yr = Math.round(
      BASE_ANNUAL_INSURANCE *
        location.insuranceMultiplier *
        this.vehicleTypeMultiplier(vehicle) *
        OWNERSHIP_YEARS,
    );
    const maintenanceCost5Yr = this.annualMaintenance(vehicle) * OWNERSHIP_YEARS;
    const resaleValue = Math.round(purchasePrice * (vehicle.resaleValue5Yr / 100));

    return {
      purchasePrice,
      fuelCost5Yr,
      insuranceCost5Yr,
      maintenanceCost5Yr,
      resaleValue,
      total:
        purchasePrice + fuelCost5Yr + insuranceCost5Yr + maintenanceCost5Yr - resaleValue,
    };
  }

  /** Unrounded 5-year fuel or electricity cost. */
  private fuelCost(vehicle: Vehicle, location: LocationData): number {
    if (vehicle.fuelType === 'electric') {
      // (60,000 mi / 3.5 mi per kWh) x local $/kWh
      return (TOTAL_MILES / EV_MILES_PER_KWH) * location.electricityRate;
    }

    if (vehicle.mpg === undefined || !(vehicle.mpg > 0)) {
      throw new Error(`Vehicle ${vehicle.id} (${vehicle.fuelType}) needs a positive mpg`);
    }

    // Hybrids are assumed to achieve only 60% of nominal mpg (per SPEC.md).
    const effectiveMpg =
      vehicle.fuelType === 'hybrid' ? vehicle.mpg * HYBRID_MPG_FACTOR : vehicle.mpg;

    // (60,000 mi / mpg) x $3.50 per gallon
    return (TOTAL_MILES / effectiveMpg) * GAS_PRICE_PER_GALLON;
  }

  /**
   * Luxury wins over everything else (1.3). Otherwise electric cars get 0.95
   * and the rest are priced by body class.
   */
  private vehicleTypeMultiplier(vehicle: Vehicle): number {
    if (vehicle.isLuxury) return INSURANCE_TYPE_MULTIPLIER.luxury;
    if (vehicle.fuelType === 'electric') return INSURANCE_TYPE_MULTIPLIER.electric;
    return INSURANCE_TYPE_MULTIPLIER[vehicle.bodyType];
  }

  /** More reliable cars cost less to maintain. */
  private annualMaintenance(vehicle: Vehicle): number {
    if (vehicle.reliabilityScore >= 90) return MAINTENANCE_COST.high;
    if (vehicle.reliabilityScore >= 70) return MAINTENANCE_COST.medium;
    return MAINTENANCE_COST.low;
  }
}
