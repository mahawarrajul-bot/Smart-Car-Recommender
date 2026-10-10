import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/recommend/route';
import { VehicleRanker } from '../lib/engine/ranker';
import type { ApiErrorResponse, ApiSuccessResponse, UserProfile } from '../lib/types';

const ecoBuyer: UserProfile = {
  budget: 40_000,
  primaryUse: 'daily_commute',
  location: '90210',
  preferences: {
    vehicleType: 'electric',
    minReliabilityScore: 80,
    maxCO2PerMile: 150,
    desiredFeatures: [],
  },
};

const post = (body: unknown): Promise<Response> =>
  POST(
    new NextRequest('http://localhost/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe('POST /api/recommend', () => {
  it('returns 200 with five ranked recommendations and meta (spec Example 1)', async () => {
    const res = await post(ecoBuyer);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiSuccessResponse;
    expect(body.success).toBe(true);
    expect(body.recommendations.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(body.recommendations[0].name).toBe('Tesla Model 3');
    expect(body.recommendations[0].tcoBreakdown.total).toBe(28_996);

    expect(body.meta.vehiclesConsidered).toBe(50);
    expect(body.meta.vehiclesFiltered).toBe(12); // EVs + hybrids with reliability >= 80, CO2 <= 150, price <= $48k
    expect(body.meta.topRankScore).toBe(85);
    expect(body.meta.processTime).toBeGreaterThanOrEqual(0);
    expect(body.meta.processTime).toBeLessThan(500);
    expect(new Date(body.meta.generatedAt).toISOString()).toBe(body.meta.generatedAt);
  });

  it('returns 400 with the first validation error', async () => {
    const res = await post({ ...ecoBuyer, budget: 60_000 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Budget must be between $10,000 and $50,000',
      code: 'VALIDATION_ERROR',
    } satisfies ApiErrorResponse);
  });

  it('reports only the first of several validation errors', async () => {
    const res = await post({ ...ecoBuyer, budget: 5_000, primaryUse: 'racing' });
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error).toBe('Budget must be between $10,000 and $50,000');
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/valid JSON/);
  });

  it('returns 400 for a non-object body', async () => {
    expect((await post('null')).status).toBe(400);
    expect((await post('[1,2]')).status).toBe(400);
  });

  it('returns 404 NO_MATCHES when nothing passes the filters (spec Example 3)', async () => {
    const res = await post({
      budget: 15_000,
      primaryUse: 'luxury',
      location: 'DEFAULT',
      preferences: { vehicleType: 'electric', minReliabilityScore: 90, maxCO2PerMile: 100 },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: 'No vehicles match your criteria. Try relaxing the reliability or emissions filters.',
      code: 'NO_MATCHES',
    } satisfies ApiErrorResponse);
  });

  it('falls back to DEFAULT for an unrecognised location instead of failing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body = (await (await post({ ...ecoBuyer, location: 'INVALID' })).json()) as ApiSuccessResponse;
    expect(body.success).toBe(true);
    // DEFAULT electricity is $0.15/kWh: (60,000 / 3.5) x 0.15
    expect(body.recommendations[0].tcoBreakdown.fuelCost5Yr).toBe(2_571);
  });

  it('applies defaults when optional preferences are omitted', async () => {
    const res = await post({
      budget: 30_000,
      primaryUse: 'daily_commute',
      location: 'TX',
      preferences: { vehicleType: 'sedan' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiSuccessResponse;
    expect(body.recommendations.every((r) => r.reliabilityScore >= 70 && r.co2PerMile <= 250)).toBe(true);
  });

  it('returns 500 with a generic message and logs the cause on unexpected errors', async () => {
    const boom = new Error('database exploded');
    vi.spyOn(VehicleRanker.prototype, 'rankVehicles').mockImplementation(() => {
      throw boom;
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await post(ecoBuyer);
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body).toEqual({
      success: false,
      error: 'Unable to generate recommendations. Please try again.',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(body)).not.toContain('exploded');
    expect(logged).toHaveBeenCalledWith('Recommendation API error:', boom);
  });
});
