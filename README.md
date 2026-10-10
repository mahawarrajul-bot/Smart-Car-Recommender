# Smart Car Recommender

Find your perfect car based on budget, lifestyle and environmental impact.

Tell the app your budget, location, vehicle type, and minimum reliability and maximum CO2 limits. It filters a 50-car catalog, scores each match on five dimensions, and returns your **top 5**, each with a plain-English explanation and a 5-year cost-of-ownership breakdown.

Built with Next.js (App Router), React, TypeScript and Tailwind CSS. The full specification is in [SPEC.md](./SPEC.md).

## How it works

1. **Validate** the input (budget $10,000–$50,000, known vehicle type and primary use, reliability 50–100, CO2 100–300 g/mile). Missing reliability and CO2 limits default to 70 and 250.
2. **Filter** (all must pass): price ≤ budget × 1.2, reliability ≥ your minimum, CO2 ≤ your maximum.
3. **Score** each remaining car from 0 to 100 on five dimensions:

   | Dimension | Weight | How it is scored |
   |---|---|---|
   | Budget fit | 25% | 100 at or under budget; `budget / price × 100` up to 20% over |
   | Total cost of ownership | 25% | `100 − TCO / (2 × budget) × 100`, floored at 0 |
   | Emissions | 20% | 100 under 150 g/mile, sliding linearly to 20 at 300 g/mile |
   | Reliability | 20% | The car's 0–100 reliability score, as-is |
   | Resale value | 10% | 5-year resale retention (30–80%), as-is |

4. **Rank.** Cars that match your vehicle type and primary use come first (a soft preference, not a filter, so other cars backfill when few match). Within each group, cars sort by total score; ties go to lower TCO.
5. **Explain.** Each of the top 5 gets a 100–200 character explanation that mentions its rank.

### Total cost of ownership (5 years, 12,000 miles/year)

```
TCO = purchase + fuel + insurance + maintenance − resale

Gas/diesel fuel = (60,000 / mpg) × $3.50
Hybrid fuel     = (60,000 / (mpg × 0.6)) × $3.50
Electric fuel   = (60,000 / 3.5 mi per kWh) × local $/kWh
Insurance       = $1,200 × location multiplier × vehicle-type multiplier × 5
Maintenance     = $600 / $900 / $1,200 per year (reliability ≥ 90 / ≥ 70 / below 70) × 5
Resale          = price × resale % retained
```

Location data (insurance multiplier and electricity rate) comes from `lib/db/locations.ts`. California, Texas and New York have their own values. Any other valid state or zip code uses the national default.

## Getting started

Requires Node.js 20.9 or newer (developed on Node 24).

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |
| `npm test` | Run the unit and API tests (Vitest) |
| `npm run typecheck` | Type-check without emitting files |

## API

### `POST /api/recommend`

Request body (`UserProfile`):

```json
{
  "budget": 40000,
  "primaryUse": "daily_commute",
  "location": "90210",
  "preferences": {
    "vehicleType": "electric",
    "minReliabilityScore": 80,
    "maxCO2PerMile": 150,
    "desiredFeatures": ["autopilot"]
  }
}
```

- `primaryUse`: `daily_commute` | `family_trips` | `off_road` | `luxury`
- `location`: a 5-digit zip code, a US state abbreviation, or `DEFAULT`. Anything else silently falls back to `DEFAULT`.
- `vehicleType`: `sedan` | `suv` | `truck` | `electric` | `hybrid`
- `minReliabilityScore` and `maxCO2PerMile` are optional.
- `desiredFeatures` is optional. It never filters; a matching feature is mentioned in the explanation.

Success (`200`):

```json
{
  "success": true,
  "recommendations": [
    {
      "rank": 1,
      "id": "tesla-model-3-2024",
      "name": "Tesla Model 3",
      "price": 40000,
      "scores": { "budgetFit": 100, "tco": 64, "emissions": 100, "reliability": 88, "resale": 65, "total": 85 },
      "tcoBreakdown": {
        "purchasePrice": 40000, "fuelCost5Yr": 3086, "insuranceCost5Yr": 7410,
        "maintenanceCost5Yr": 4500, "resaleValue": 26000, "total": 28996
      },
      "explanation": "Tesla Model 3 offers low emissions at $40,000 while maintaining strong autopilot. It ranks #1 due to the highest overall score of 85/100."
    }
  ],
  "meta": {
    "generatedAt": "2026-10-10T22:12:17.998Z",
    "processTime": 25,
    "vehiclesConsidered": 50,
    "vehiclesFiltered": 12,
    "topRankScore": 85
  }
}
```

Each recommendation also includes the full vehicle fields (year, fuel type, CO2, and so on). `vehiclesFiltered` is the number of cars that passed the filters before the top 5 were taken.

Errors all have the shape `{ "success": false, "error": "…", "code": "…" }`:

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed JSON or invalid input (only the first problem is reported) |
| 404 | `NO_MATCHES` | No car passes the filters |
| 500 | `INTERNAL_ERROR` | Unexpected failure (details are logged server-side, never returned) |

## Project structure

```
app/
  page.tsx                  Home page: form + results
  layout.tsx, globals.css   Root layout and Tailwind import
  api/recommend/route.ts    POST /api/recommend
components/
  RecommendationForm.tsx    Search form
  ResultsCard.tsx           One ranked recommendation, with collapsible cost breakdown
data/
  vehicles.ts               50-car catalog
lib/
  types/index.ts            All shared TypeScript types
  engine/                   calculator.ts (TCO), scorer.ts, ranker.ts, validator.ts, constants.ts
  db/locations.ts           Regional cost data and zip/state resolution
  format.ts                 Currency formatting
__tests__/                  Vitest suites (105 tests)
SPEC.md                     Full specification
```

## Testing

`npm test` runs 105 tests covering TCO accuracy against hand-calculated values, every scoring function (all 0–100), filtering, ranking order, explanation length, input validation, the API's status codes, and the three example scenarios from SPEC.md.

## Known limitations

- **Catalog data is approximate.** Prices, resale percentages, reliability scores and CO2 figures are rounded estimates calibrated to the examples in SPEC.md, not live manufacturer or EPA data. Check them before presenting any number as fact. The catalog is hardcoded; SPEC.md plans a database for v2.
- **Hybrids look worse on fuel than they are.** SPEC.md applies a 0.6 efficiency factor to hybrid mpg, so a hybrid is costed as less efficient than the same car on gas.
- **No lower budget bound.** Only cars *above* 120% of budget are filtered out, so a $50,000 budget includes cheap cars too.
- **Some searches have no matches.** The cheapest car costs $17,500, so budgets under about $14,600 return nothing. Strict combinations of reliability and CO2 limits can also rule out every car, and the API then answers `NO_MATCHES`.
- **Regional data is coarse.** Only CA, TX and NY have their own insurance and electricity values, and NY's values are estimates. Other states use the national default.
- **Stateless.** There is no authentication, user accounts, saved searches or analytics.

## Deployment

The app deploys to [Vercel](https://vercel.com) with no configuration: import the GitHub repo, keep the detected Next.js settings, and deploy. No environment variables are needed.
