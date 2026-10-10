'use client';

import { useId, useState } from 'react';
import { formatUsd } from '@/lib/format';
import type { RecommendationScore, VehicleRecommendation } from '@/lib/types';

export interface ResultsCardProps {
  /** The ranked vehicle to display. */
  recommendation: VehicleRecommendation;
}

type ScoreKey = keyof Omit<RecommendationScore, 'total'>;

/**
 * Score badges in display order. Tailwind needs complete class names in the
 * source, so each colour scheme is spelled out rather than built dynamically.
 */
const SCORE_BADGES: ReadonlyArray<{ key: ScoreKey; label: string; className: string }> = [
  { key: 'budgetFit', label: 'Budget Fit', className: 'bg-blue-100 text-blue-800' },
  { key: 'tco', label: 'TCO', className: 'bg-green-100 text-green-800' },
  { key: 'emissions', label: 'Emissions', className: 'bg-emerald-100 text-emerald-800' },
  { key: 'reliability', label: 'Reliability', className: 'bg-amber-100 text-amber-800' },
  { key: 'resale', label: 'Resale Value', className: 'bg-orange-100 text-orange-800' },
];

/** One vehicle recommendation: rank, scores, explanation and a cost breakdown. */
export default function ResultsCard({ recommendation }: ResultsCardProps) {
  const { rank, name, price, scores, tcoBreakdown, explanation } = recommendation;
  const [expanded, setExpanded] = useState<boolean>(false);
  const breakdownId = useId();

  const breakdownRows: ReadonlyArray<{ label: string; value: number }> = [
    { label: 'Purchase Price', value: tcoBreakdown.purchasePrice },
    { label: '5-Yr Fuel/Electricity', value: tcoBreakdown.fuelCost5Yr },
    { label: '5-Yr Insurance', value: tcoBreakdown.insuranceCost5Yr },
    { label: '5-Yr Maintenance', value: tcoBreakdown.maintenanceCost5Yr },
    // Shown as a negative because it reduces the cost of owning the car.
    { label: 'Resale Value', value: -tcoBreakdown.resaleValue },
  ];

  return (
    <article className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="bg-blue-600 text-white w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-bold text-xl"
            aria-label={`Rank ${rank}`}
          >
            #{rank}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">{name}</h3>
            <p className="text-gray-500">{formatUsd(price)}</p>
          </div>
        </div>
        <p
          className="text-2xl font-bold shrink-0"
          aria-label={`Overall score ${scores.total} out of 100`}
        >
          {scores.total}/100
        </p>
      </header>

      <p className="py-3 italic text-gray-600 max-w-prose">{explanation}</p>

      <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {SCORE_BADGES.map(({ key, label, className }) => (
          <li
            key={key}
            className={`${className} px-2 py-1 rounded text-xs font-medium text-center`}
          >
            <span className="block">{label}</span>
            <span className="block">{scores[key]}/100</span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={breakdownId}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          {expanded ? 'Hide cost breakdown ▲' : 'View cost breakdown ▼'}
        </button>

        <dl
          id={breakdownId}
          hidden={!expanded}
          className="mt-2 bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-sm text-gray-700"
        >
          {breakdownRows.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4">
              <dt>{label}:</dt>
              <dd className="text-right">{formatUsd(value)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-gray-300 font-bold">
            <dt>Total:</dt>
            <dd className="text-right">{formatUsd(tcoBreakdown.total)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
