import { NextRequest, NextResponse } from 'next/server';
import { VEHICLES } from '@/data/vehicles';
import { resolveLocation } from '@/lib/db/locations';
import { VehicleRanker } from '@/lib/engine/ranker';
import { InputValidator } from '@/lib/engine/validator';
import type { ApiErrorCode, ApiResponse, UserProfile } from '@/lib/types';

// Stateless and cheap to build, so one instance of each serves every request.
const validator = new InputValidator();
const ranker = new VehicleRanker();

function errorResponse(
  error: string,
  code: ApiErrorCode,
  status: number,
): NextResponse<ApiResponse> {
  return NextResponse.json<ApiResponse>({ success: false, error, code }, { status });
}

/**
 * POST /api/recommend
 *
 * Body: a `UserProfile`. Responds with the top 5 ranked vehicles, or one of:
 * - 400 `VALIDATION_ERROR` (malformed JSON or invalid input; first error only)
 * - 404 `NO_MATCHES` (no vehicle passes the filters)
 * - 500 `INTERNAL_ERROR` (unexpected failure; details are logged, not returned)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON', 'VALIDATION_ERROR', 400);
    }

    const validation = validator.validate(body);
    if (!validation.isValid) {
      return errorResponse(validation.errors[0], 'VALIDATION_ERROR', 400);
    }

    // Apply defaults and the DEFAULT-location fallback once, up front, so the
    // candidate count below and the ranking see identical input.
    const profile = validator.normalize(body as UserProfile);
    const location = resolveLocation(profile.location);

    const recommendations = ranker.rankVehicles(VEHICLES, profile, location);
    if (recommendations.length === 0) {
      return errorResponse(
        'No vehicles match your criteria. Try relaxing the reliability or emissions filters.',
        'NO_MATCHES',
        404,
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        recommendations,
        meta: {
          generatedAt: new Date().toISOString(),
          processTime: Date.now() - startTime,
          vehiclesConsidered: VEHICLES.length,
          vehiclesFiltered: ranker.filterCandidates(VEHICLES, profile).length,
          topRankScore: recommendations[0]?.scores.total ?? 0,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error('Recommendation API error:', error);
    return errorResponse(
      'Unable to generate recommendations. Please try again.',
      'INTERNAL_ERROR',
      500,
    );
  }
}
