'use client';

import { useEffect, useRef, useState } from 'react';
import RecommendationForm from '@/components/RecommendationForm';
import ResultsCard from '@/components/ResultsCard';
import type { VehicleRecommendation } from '@/lib/types';

/** Shown in the footer; update whenever the vehicle catalog is refreshed. */
const DATA_AS_OF = 'October 2024';

export default function HomePage() {
  const [results, setResults] = useState<VehicleRecommendation[]>([]);
  const resultsRef = useRef<HTMLElement | null>(null);

  // Bring new results into view; on a tall form they land below the fold.
  useEffect(() => {
    if (results.length > 0) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-linear-to-b from-blue-100 to-gray-50 text-center py-12 px-4">
        <p className="text-5xl" aria-hidden="true">
          🚗
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Smart Car Recommender</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          Find your perfect car based on budget, lifestyle &amp; environmental impact
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 pb-12">
        <RecommendationForm onResults={setResults} />

        {results.length > 0 && (
          <section ref={resultsRef} aria-labelledby="results-heading" className="scroll-mt-6">
            <h2 id="results-heading" className="mb-4 text-2xl font-bold">
              {results.length === 5 ? 'Your Top 5 Matches' : `Your ${results.length} Matches`}
            </h2>
            <div className="space-y-4">
              {results.map((rec) => (
                <ResultsCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        Data current as of {DATA_AS_OF} • Built with Next.js &amp; TypeScript
      </footer>
    </div>
  );
}
