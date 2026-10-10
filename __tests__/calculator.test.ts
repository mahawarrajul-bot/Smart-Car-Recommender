import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../data/vehicles';
import { DEFAULT_LOCATION, LOCATION_DATA } from '../lib/db/locations';
import { TCOCalculator } from '../lib/engine/calculator';
import type { LocationData, Vehicle } from '../lib/types';

const calc = new TCOCalculator();
const car = (id: string): Vehicle => {
  const found = VEHICLES.find((v) => v.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found;
};

const civic = car('honda-civic-2024'); // $25k, 28 mpg, 85 reliability, 60% resale
const tesla = car('tesla-model-3-2024'); // $40k, 88 reliability, 65% resale

// SPEC.md's Tesla example pairs California insurance (1.3) with a $0.15/kWh rate.
const specExampleLocation: LocationData = {
  zipCode: '90210',
  state: 'CA',
  insuranceMultiplier: 1.3,
  electricityRate: 0.15,
};

describe('TCOCalculator.calculateTCO', () => {
  it('matches the hand-calculated Honda Civic breakdown (gas)', () => {
    const tco = calc.calculateTCO(civic, DEFAULT_LOCATION);
    expect(tco).toEqual({
      purchasePrice: 25_000,
      fuelCost5Yr: 7_500, // (60,000 / 28) x $3.50
      insuranceCost5Yr: 6_000, // $1,200 x 1.0 x 1.0 x 5
      maintenanceCost5Yr: 4_500, // reliability 85 -> $900 x 5
      resaleValue: 15_000, // 60%
      total: 28_000,
    });
    expect(Math.abs(tco.total - 28_000)).toBeLessThanOrEqual(500);
  });

  it('matches the hand-calculated Tesla Model 3 breakdown (EV, spec example inputs)', () => {
    const tco = calc.calculateTCO(tesla, specExampleLocation);
    expect(tco).toEqual({
      purchasePrice: 40_000,
      fuelCost5Yr: 2_571, // (60,000 / 3.5) x $0.15
      insuranceCost5Yr: 7_410, // $1,200 x 1.3 x 0.95 x 5
      maintenanceCost5Yr: 4_500, // reliability 88 -> $900 x 5
      resaleValue: 26_000, // 65%
      total: 28_481,
    });
    expect(Math.abs(tco.total - 28_481)).toBeLessThanOrEqual(500);
  });

  it('uses the California electricity rate ($0.18) from LocationData', () => {
    const tco = calc.calculateTCO(tesla, LOCATION_DATA.CA);
    expect(tco.fuelCost5Yr).toBe(3_086); // (60,000 / 3.5) x $0.18
    expect(tco.total).toBe(28_996);
  });

  it('charges more in California than in Texas (insurance and electricity)', () => {
    const ca = calc.calculateTCO(tesla, LOCATION_DATA.CA);
    const tx = calc.calculateTCO(tesla, LOCATION_DATA.TX);
    expect(ca.insuranceCost5Yr).toBe(7_410);
    expect(tx.insuranceCost5Yr).toBe(5_415); // $1,200 x 0.95 x 0.95 x 5
    expect(ca.total - tx.total).toBe(3_024);
  });

  it('applies the 0.6 efficiency factor to hybrids', () => {
    const camry = car('toyota-camry-2025'); // 50 mpg nominal
    const tco = calc.calculateTCO(camry, DEFAULT_LOCATION);
    expect(tco.fuelCost5Yr).toBe(7_000); // (60,000 / (50 x 0.6)) x $3.50
  });

  it('treats diesel like gas', () => {
    const diesel: Vehicle = { ...civic, fuelType: 'diesel' };
    expect(calc.calculateTCO(diesel, DEFAULT_LOCATION).fuelCost5Yr).toBe(7_500);
  });

  it.each([
    [95, 3_000],
    [90, 3_000],
    [89, 4_500],
    [70, 4_500],
    [69, 6_000],
  ])('maintenance for reliability %i is %i over 5 years', (reliabilityScore, expected) => {
    const v: Vehicle = { ...civic, reliabilityScore };
    expect(calc.calculateTCO(v, DEFAULT_LOCATION).maintenanceCost5Yr).toBe(expected);
  });

  it.each([
    ['suv', false, 1.1],
    ['truck', false, 1.2],
    ['sedan', true, 1.3],
    ['suv', true, 1.3],
  ] as const)('insurance multiplier for %s (luxury=%s) is %d', (bodyType, isLuxury, mult) => {
    const v: Vehicle = { ...civic, bodyType, isLuxury };
    expect(calc.calculateTCO(v, DEFAULT_LOCATION).insuranceCost5Yr).toBe(
      Math.round(1_200 * mult * 5),
    );
  });

  it('keeps total equal to the sum of its components for every catalog vehicle', () => {
    for (const v of VEHICLES) {
      const t = calc.calculateTCO(v, LOCATION_DATA.NY);
      expect(t.total).toBe(
        t.purchasePrice + t.fuelCost5Yr + t.insuranceCost5Yr + t.maintenanceCost5Yr - t.resaleValue,
      );
      expect(Number.isInteger(t.total)).toBe(true);
    }
  });

  it('throws when a combustion vehicle has no mpg', () => {
    const { mpg: _mpg, ...rest } = civic;
    expect(() => calc.calculateTCO(rest, DEFAULT_LOCATION)).toThrow(/mpg/);
  });
});
