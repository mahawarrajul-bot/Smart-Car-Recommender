'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { formatUsd } from '@/lib/format';
import type {
  ApiResponse,
  PrimaryUse,
  UserProfile,
  VehicleRecommendation,
  VehicleTypePreference,
} from '@/lib/types';

export interface RecommendationFormProps {
  /** Called with the ranked recommendations after a successful request. */
  onResults: (recommendations: VehicleRecommendation[]) => void;
}

const PRIMARY_USE_OPTIONS: ReadonlyArray<{ value: PrimaryUse; label: string }> = [
  { value: 'daily_commute', label: 'Daily Commute' },
  { value: 'family_trips', label: 'Family Trips' },
  { value: 'off_road', label: 'Off-Road' },
  { value: 'luxury', label: 'Luxury' },
];

const VEHICLE_TYPE_OPTIONS: ReadonlyArray<{ value: VehicleTypePreference; label: string }> = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Truck' },
  { value: 'electric', label: 'Electric' },
  { value: 'hybrid', label: 'Hybrid' },
];

const INITIAL_FORM_DATA: UserProfile = {
  budget: 30_000,
  primaryUse: 'daily_commute',
  location: 'DEFAULT',
  preferences: {
    vehicleType: 'sedan',
    minReliabilityScore: 75,
    maxCO2PerMile: 250,
    desiredFeatures: [],
  },
};

/** How long the success banner stays visible. */
const SUCCESS_VISIBLE_MS = 4_000;

const FIELD_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const SLIDER_CLASS =
  'w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-2';

/** Finds the option whose value equals `raw`, so no unchecked cast is needed. */
function parseOption<T extends string>(
  options: ReadonlyArray<{ value: T }>,
  raw: string,
): T | undefined {
  return options.find((option) => option.value === raw)?.value;
}

/** Collects the user's search criteria and requests recommendations. */
export default function RecommendationForm({ onResults }: RecommendationFormProps) {
  const [formData, setFormData] = useState<UserProfile>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const id = useId();
  const ids = {
    budget: `${id}-budget`,
    primaryUse: `${id}-primary-use`,
    location: `${id}-location`,
    locationHelp: `${id}-location-help`,
    vehicleType: `${id}-vehicle-type`,
    reliability: `${id}-reliability`,
    co2: `${id}-co2`,
    error: `${id}-error`,
  };
  // Points every input at the error banner while one is showing.
  const errorRef = error ? ids.error : undefined;

  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Hide the success banner after a few seconds.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(null), SUCCESS_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [success]);

  const updatePreferences = (changes: Partial<UserProfile['preferences']>): void =>
    setFormData((prev) => ({ ...prev, preferences: { ...prev.preferences, ...changes } }));

  const handlePrimaryUse = (e: ChangeEvent<HTMLSelectElement>): void => {
    const primaryUse = parseOption(PRIMARY_USE_OPTIONS, e.target.value);
    if (primaryUse) setFormData((prev) => ({ ...prev, primaryUse }));
  };

  const handleVehicleType = (e: ChangeEvent<HTMLSelectElement>): void => {
    const vehicleType = parseOption(VEHICLE_TYPE_OPTIONS, e.target.value);
    if (vehicleType) updatePreferences({ vehicleType });
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, location: formData.location.trim() }),
        signal: controller.signal,
      });

      // Error responses (400/404/500) also carry a JSON body with a friendly
      // message, so parse first and only fall back to the status code.
      let data: ApiResponse | null = null;
      try {
        data = (await response.json()) as ApiResponse;
      } catch {
        data = null;
      }

      if (response.ok && data?.success) {
        const count = data.recommendations.length;
        setSuccess(`Found ${count} ${count === 1 ? 'match' : 'matches'}!`);
        onResults(data.recommendations);
      } else {
        const apiError = data && !data.success ? data.error : '';
        setError(apiError || `Request failed (${response.status})`);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError((err instanceof Error && err.message) || 'Network error');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }

  const { preferences } = formData;

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor={ids.budget} className={LABEL_CLASS}>
            Budget
          </label>
          <input
            id={ids.budget}
            type="range"
            min={10_000}
            max={50_000}
            step={1_000}
            value={formData.budget}
            onChange={(e) => setFormData((prev) => ({ ...prev, budget: Number(e.target.value) }))}
            aria-label="Budget"
            aria-valuetext={formatUsd(formData.budget)}
            aria-describedby={errorRef}
            className={SLIDER_CLASS}
          />
          <p className="mt-1 text-sm text-gray-600" aria-hidden="true">
            {formatUsd(formData.budget)}
          </p>
        </div>

        <div>
          <label htmlFor={ids.primaryUse} className={LABEL_CLASS}>
            Primary Use
          </label>
          <select
            id={ids.primaryUse}
            value={formData.primaryUse}
            onChange={handlePrimaryUse}
            aria-describedby={errorRef}
            className={FIELD_CLASS}
          >
            {PRIMARY_USE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={ids.location} className={LABEL_CLASS}>
            Location
          </label>
          <input
            id={ids.location}
            type="text"
            value={formData.location}
            placeholder="e.g., 90210, CA, or DEFAULT"
            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            aria-describedby={errorRef ? `${ids.locationHelp} ${errorRef}` : ids.locationHelp}
            className={FIELD_CLASS}
          />
          <p id={ids.locationHelp} className="mt-1 text-sm text-gray-500">
            5-digit zip code, state, or DEFAULT
          </p>
        </div>

        <div>
          <label htmlFor={ids.vehicleType} className={LABEL_CLASS}>
            Vehicle Type
          </label>
          <select
            id={ids.vehicleType}
            value={preferences.vehicleType}
            onChange={handleVehicleType}
            aria-describedby={errorRef}
            className={FIELD_CLASS}
          >
            {VEHICLE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={ids.reliability} className={LABEL_CLASS}>
            Minimum Reliability Score
          </label>
          <input
            id={ids.reliability}
            type="range"
            min={50}
            max={100}
            step={5}
            value={preferences.minReliabilityScore}
            onChange={(e) => updatePreferences({ minReliabilityScore: Number(e.target.value) })}
            aria-label="Minimum Reliability Score"
            aria-valuetext={`${preferences.minReliabilityScore} out of 100`}
            aria-describedby={errorRef}
            className={SLIDER_CLASS}
          />
          <p className="mt-1 text-sm text-gray-600" aria-hidden="true">
            {preferences.minReliabilityScore}/100
          </p>
        </div>

        <div>
          <label htmlFor={ids.co2} className={LABEL_CLASS}>
            Maximum CO2 Emissions (g/mile)
          </label>
          <input
            id={ids.co2}
            type="range"
            min={100}
            max={300}
            step={10}
            value={preferences.maxCO2PerMile}
            onChange={(e) => updatePreferences({ maxCO2PerMile: Number(e.target.value) })}
            aria-label="Maximum CO2 Emissions in grams per mile"
            aria-valuetext={`${preferences.maxCO2PerMile} grams per mile`}
            aria-describedby={errorRef}
            className={SLIDER_CLASS}
          />
          <p className="mt-1 text-sm text-gray-600" aria-hidden="true">
            {preferences.maxCO2PerMile} g/mile
          </p>
        </div>

        {error && (
          <div
            id={ids.error}
            role="alert"
            className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700"
          >
            <span aria-hidden="true">⚠️ </span>
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="bg-green-50 border border-green-200 p-4 rounded-md text-green-700"
          >
            {success}
          </div>
        )}

        {loading && (
          <p role="status" className="text-sm text-gray-600">
            ⏳ Finding recommendations...
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Finding recommendations...' : 'Get Recommendations'}
        </button>
      </form>
    </div>
  );
}
