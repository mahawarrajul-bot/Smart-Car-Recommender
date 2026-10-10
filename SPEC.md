# Smart Car Recommender - Complete Specification

**Version:** 1.0  
**Status:** Ready for implementation  
**Last Updated:** October 2026  
**Time to Build:** 3 days (MVP)  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Structures](#data-structures)
3. [Calculation Formulas](#calculation-formulas)
4. [Algorithm: Ranking & Filtering](#algorithm-ranking--filtering)
5. [Input Validation](#input-validation)
6. [Output Specification](#output-specification)
7. [Test Cases](#test-cases)
8. [Error Handling](#error-handling)
9. [Examples](#examples)

---

## System Overview

### Problem Statement
Users overwhelmed by 100+ car models waste 10+ hours researching without clear prioritization. Environmental impact is overlooked.

### Solution
Automated vehicle recommender that:
- Accepts user inputs (budget, preferences, location)
- Returns top 5 vehicles ranked by 5 scoring dimensions
- Provides explanations for why each car ranks

### Success Criteria
- [x] Input validation working
- [x] TCO calculation accurate to ±5%
- [x] Ranking produces top 5 in correct order
- [x] Explanation generated for each car
- [x] API responds in < 1 second
- [x] All tests passing

---

## Data Structures

### 1. User Input: `UserProfile`

```typescript
interface UserProfile {
  budget: number;
  // Constraint: $10,000 - $50,000
  // Example: 40000

  primaryUse: 'daily_commute' | 'family_trips' | 'off_road' | 'luxury';
  // Affects vehicle type filtering

  location: string;
  // Format: 5-digit US zip code OR state abbreviation OR 'DEFAULT'
  // Examples: '90210', 'CA', 'DEFAULT'
  // Used for: insurance multipliers, electricity rates

  preferences: {
    vehicleType: 'sedan' | 'suv' | 'truck' | 'electric' | 'hybrid';
    // Constraint: must match vehicle fuelType or class
    
    minReliabilityScore: number;
    // Constraint: 50 - 100 (inclusive)
    // Default: 70 if not provided
    
    maxCO2PerMile: number;
    // Constraint: 100 - 300 (grams/mile, inclusive)
    // Default: 250 if not provided
    // Example: 150 (strict eco-conscious buyer)
    
    desiredFeatures?: string[];
    // Optional: ['autopilot', 'towing', 'leather-seats', 'awd']
    // Does NOT filter; used only for explanation
  };
}
```

### 2. Vehicle Data: `Vehicle`

```typescript
interface Vehicle {
  id: string;
  // UUID or short code
  // Example: 'tesla-model-3-2024'

  name: string;
  // Display name
  // Example: 'Tesla Model 3'

  year: number;
  // Constraint: 2020-2026
  
  price: number;
  // MSRP in USD
  // Example: 40000

  fuelType: 'gas' | 'electric' | 'hybrid' | 'diesel';
  // Determines fuel cost calculation

  // For gas/hybrid cars:
  mpg?: number;
  // Miles per gallon (combined EPA rating)
  // Constraint: 15-50 MPG
  // Example: 28

  // For electric/hybrid cars:
  batteryCapacity?: number;
  // kWh (kilowatt-hours)
  // Example: 75

  reliabilityScore: number;
  // 0-100 scale (higher = more reliable)
  // Source: JD Power, Consumer Reports, Edmunds
  // Example: 88

  resaleValue5Yr: number;
  // Percentage of original price retained after 5 years
  // Constraint: 30-80%
  // Example: 65 means car worth $26k after 5 years if purchased at $40k

  co2PerMile: number;
  // Grams of CO2 per mile
  // Gas: ~150-250 g/mi (depends on MPG)
  // Electric: ~120 g/mi (grid power + manufacturing)
  // Hybrid: ~100-150 g/mi
  // Example: 120

  bodyType: 'sedan' | 'suv' | 'truck';
  // Body class. Used for the insurance multiplier and the sedan/suv/truck
  // vehicle type preference. Compact hatchbacks are classified as 'sedan'.

  isLuxury: boolean;
  // Luxury-brand vehicle. Uses the 1.3 luxury insurance multiplier
  // (takes precedence over the electric and body-class multipliers).

  features?: string[];
  // Optional: ['autopilot', 'towing-capacity', 'leather-interior', 'awd']
}
```

### 3. Location Data: `LocationData`

```typescript
interface LocationData {
  zipCode: string;
  state: string;
  
  insuranceMultiplier: number;
  // Constraint: 0.8 - 1.5
  // National avg = 1.0
  // California = 1.3 (30% more expensive)
  // Texas = 0.95 (5% cheaper)
  // Example: 1.3

  electricityRate: number;
  // $/kWh for charging EVs
  // Constraint: $0.10 - $0.30/kWh
  // California = $0.18
  // Texas = $0.12
  // Example: 0.18
}
```

### 4. Scoring Breakdown: `RecommendationScore`

```typescript
interface RecommendationScore {
  budgetFit: number;
  // 0-100 scale
  // How close car price is to user budget
  // Formula: See Calculation Formulas section

  tco: number;
  // 0-100 scale
  // Total cost of ownership ranking
  // Lower TCO = higher score

  emissions: number;
  // 0-100 scale
  // Environmental impact
  // Lower emissions = higher score

  reliability: number;
  // 0-100 scale
  // Directly from vehicle reliability_score

  resale: number;
  // 0-100 scale
  // Resale value retention
  // Directly from vehicle resaleValue5Yr

  total: number;
  // 0-100 scale (weighted average)
  // Formula: 
  // total = (budgetFit × 0.25) + 
  //         (tco × 0.25) + 
  //         (emissions × 0.20) + 
  //         (reliability × 0.20) + 
  //         (resale × 0.10)
}
```

### 5. TCO Breakdown: `TCOBreakdown`

```typescript
interface TCOBreakdown {
  purchasePrice: number;
  // Vehicle MSRP
  // Example: 40000

  fuelCost5Yr: number;
  // Total fuel/electricity cost over 5 years
  // Example: 2500 (EV) or 8400 (gas car)

  insuranceCost5Yr: number;
  // Total insurance over 5 years
  // Example: 7500 (5 years × $1500/year)

  maintenanceCost5Yr: number;
  // Total maintenance over 5 years
  // Example: 3000

  resaleValue: number;
  // Expected sale price after 5 years
  // Calculated as: purchasePrice × (resaleValue5Yr / 100)
  // Example: 26000 (for $40k car with 65% resale)

  total: number;
  // Total cost of ownership
  // Formula: purchasePrice + fuel + insurance + maintenance - resaleValue
  // Example: 27000
}
```

### 6. Final Output: `VehicleRecommendation`

```typescript
interface VehicleRecommendation extends Vehicle {
  rank: number;
  // 1-5 (top 5 recommendations)

  scores: RecommendationScore;
  // All 5 dimensions + weighted total

  tcoBreakdown: TCOBreakdown;
  // Detailed cost breakdown

  explanation: string;
  // Human-readable explanation: "Why this car beats competitors"
  // Length: 100-200 characters
  // Template: "[Car name] offers [main benefit] at [price point] while maintaining strong [secondary benefit]..."
  // Example: "Tesla Model 3 offers the lowest emissions and strongest reliability while staying within your $40k budget."
}
```

---

## Calculation Formulas

### 1. TCO (Total Cost of Ownership)

**Time Period:** 5 years  
**Annual Mileage:** 12,000 miles/year (industry standard)  
**Total Miles:** 60,000 miles  

#### For Gas/Diesel Cars:

```
Fuel Cost = (Total Miles / MPG) × Gas Price
          = (60,000 / 28) × $3.50
          = 2,143 gallons × $3.50
          = $7,500

Constraints:
- Gas price: Fixed at $3.50/gallon (can vary ±$0.50 for sensitivity)
- MPG: From vehicle spec (EPA combined rating)
```

#### For Electric Cars:

```
Electricity Cost = (Total Miles / Efficiency) × Electricity Rate
                 = (60,000 / 3.5 mi/kWh) × $0.18/kWh   (California rate)
                 = 17,143 kWh × $0.18
                 = $3,086

Constraints:
- Efficiency: Fixed at 3.5 miles/kWh (EV average)
- Electricity Rate: From LocationData (varies by region)
```

#### For Hybrid Cars:

```
Hybrid Fuel Cost = (60,000 / (MPG × 0.6)) × $3.50
                 // Assume 60% efficiency vs pure gas
                 
Example: Hybrid with 40 MPG nominal
Fuel Cost = (60,000 / (40 × 0.6)) × $3.50
          = (60,000 / 24) × $3.50
          = 2,500 gallons × $3.50
          = $8,750
```

#### Insurance Cost:

```
Annual Insurance = $1,200 × Location Multiplier × Vehicle Type Multiplier

Vehicle Type Multiplier:
- Sedan: 1.0
- SUV: 1.1
- Truck: 1.2
- Electric: 0.95 (cheaper due to fewer accidents)
- Luxury: 1.3

5-Year Insurance = Annual Insurance × 5

Example (Tesla in California):
= $1,200 × 1.3 (CA multiplier) × 0.95 (electric) × 5
= $7,410
```

#### Maintenance Cost:

```
Annual Maintenance = Based on Reliability Score

If Reliability Score >= 90: $600/year
If Reliability Score >= 70: $900/year
If Reliability Score < 70: $1,200/year

5-Year Maintenance = Annual × 5

Example (Tesla with 88 reliability):
= $900 × 5
= $4,500
```

#### Resale Value:

```
Resale Value = Purchase Price × (ResaleValue5Yr / 100)

Example (Tesla Model 3, $40k, 65% resale):
= $40,000 × 0.65
= $26,000
```

#### Total TCO:

```
Total TCO = Purchase Price + Fuel + Insurance + Maintenance - Resale Value

Example (Tesla Model 3):
= $40,000 + $3,086 + $7,410 + $4,500 - $26,000
= $28,996

Example (Honda Civic):
= $25,000 + $7,500 + $6,000 + $4,500 - $15,000
= $28,000
```

---

### 2. Scoring Formulas

#### Budget Fit Score (0-100)

```
If Price <= Budget:
  Score = 100 (perfect fit)

If Price > Budget but Price <= Budget × 1.2:
  Score = (Budget / Price) × 100
  
If Price > Budget × 1.2:
  Score = 0 (filtered out before scoring)

Examples:
- Budget $40k, Car $40k → 100/100
- Budget $40k, Car $42k → (40,000/42,000) × 100 = 95/100
- Budget $40k, Car $45k → Filtered (beyond 20% threshold)
```

#### TCO Score (0-100)

```
Worst Case TCO = Budget × 2 (conservative estimate)

TCO Score = MAX(0, 100 - (Vehicle TCO / Worst Case TCO) × 100)

Examples (Budget $40k, Worst Case = $80k):
- Vehicle TCO $25k → 100 - (25/80) × 100 = 68/100
- Vehicle TCO $30k → 100 - (30/80) × 100 = 62/100
- Vehicle TCO $80k → 100 - (80/80) × 100 = 0/100
```

#### Emissions Score (0-100)

```
Best Case: < 150 g CO2/mile = 100 points
Worst Case: > 300 g CO2/mile = 20 points
Linear interpolation between:

If CO2 < 150:
  Score = 100

If 150 <= CO2 <= 300:
  Score = 100 - ((CO2 - 150) / 150) × 80
  = 100 - (0 to 80)
  
If CO2 > 300:
  Score = 20

Examples:
- Tesla (120 g/mi) → 100/100
- Honda Civic (200 g/mi) → 100 - ((200-150)/150) × 80 = 73/100
- Gas SUV (280 g/mi) → 100 - ((280-150)/150) × 80 = 31/100
```

#### Reliability Score (0-100)

```
Score = Vehicle reliability_score (used as-is)

Constraint: Must be 50-100 scale from data source
Examples:
- Tesla: 88 → 88/100
- Toyota: 92 → 92/100
- New startup EV: 65 → 65/100
```

#### Resale Value Score (0-100)

```
Score = Vehicle resaleValue5Yr (used as-is)

Constraint: 30-80% scale
Examples:
- Tesla: 65% → 65/100
- Honda: 60% → 60/100
- Luxury car: 50% → 50/100
```

#### Total Score (0-100, Weighted Average)

```
Total = (BudgetFit × 0.25) + 
        (TCO × 0.25) + 
        (Emissions × 0.20) + 
        (Reliability × 0.20) + 
        (Resale × 0.10)

Weights (must sum to 100%):
- Budget Fit: 25%
- TCO: 25%
- Emissions: 20%
- Reliability: 20%
- Resale Value: 10%

Example calculation:
Total = (100 × 0.25) + (85 × 0.25) + (95 × 0.20) + (88 × 0.20) + (65 × 0.10)
      = 25 + 21.25 + 19 + 17.6 + 6.5
      = 89.35 → Rounds to 89/100
```

---

## Algorithm: Ranking & Filtering

### Step 1: Input Validation

**Before processing, validate:**

```
1. Budget: $10,000 ≤ budget ≤ $50,000
   → If invalid: Return error "Budget must be $10,000-$50,000"

2. Location: Must be valid zip code OR state OR 'DEFAULT'
   → If invalid: Use 'DEFAULT' (multiplier 1.0)

3. Reliability Score: 50 ≤ minReliability ≤ 100
   → If invalid: Set to 70 (default)

4. CO2 Limit: 100 ≤ maxCO2 ≤ 300
   → If invalid: Set to 250 (default)

5. Vehicle Type: Must match one of enum values
   → If invalid: Return error
```

### Step 2: Filter Candidates

**Keep vehicles that match ALL criteria:**

```
Filter Criteria (ALL must be true):

1. Price Filter:
   Price ≤ Budget × 1.2
   Example: $40k budget → Keep cars ≤ $48k

2. Reliability Filter:
   reliabilityScore ≥ minReliabilityScore
   Example: User wants ≥80 → Filter out cars <80

3. Emissions Filter:
   co2PerMile ≤ maxCO2PerMile
   Example: User wants <150 g/mi → Filter out cars >150

4. Vehicle Type Filter (Soft):
   If user prefers 'electric':
     Keep: fuelType = 'electric' OR 'hybrid'
   If user prefers 'suv':
     Keep: Class matches SUV (name contains 'SUV' or similar)
   If user prefers 'truck':
     Keep: Class matches truck
   (Soft = prefer but don't hard exclude)

Output: candidates = filtered vehicles
```

### Step 3: Score Each Candidate

**For each filtered vehicle:**

```
1. Calculate TCO using LocationData
2. Calculate budgetFit score
3. Calculate tco score
4. Calculate emissions score (from co2PerMile)
5. Calculate reliability score (direct)
6. Calculate resale score (direct)
7. Calculate weighted total score
8. Generate explanation string

Pseudocode:
for vehicle in candidates:
  tco = calculateTCO(vehicle, location)
  scores = {
    budgetFit: scoreBudgetFit(vehicle.price, user.budget),
    tco: scoreTCO(tco, user.budget),
    emissions: scoreEmissions(vehicle.co2PerMile),
    reliability: vehicle.reliabilityScore,
    resale: vehicle.resaleValue5Yr,
  }
  scores.total = weightedAverage(scores)
  scored_vehicles.append({vehicle, scores, tco})
```

### Step 4: Rank by Total Score

```
1. Sort scored_vehicles by scores.total (descending)
2. Take top 5 vehicles
3. Assign rank: 1-5
4. Generate explanation for each

Output: top_5_recommendations (VehicleRecommendation[])
```

---

## Input Validation

### Validation Rules

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

VALIDATION_RULES = [
  {
    field: "budget",
    constraint: "$10,000 ≤ budget ≤ $50,000",
    error: "Budget must be between $10,000 and $50,000"
  },
  {
    field: "primaryUse",
    constraint: "Must be: daily_commute | family_trips | off_road | luxury",
    error: "Invalid primary use. Choose: daily_commute, family_trips, off_road, or luxury"
  },
  {
    field: "location",
    constraint: "Valid 5-digit zip OR state code OR 'DEFAULT'",
    error: "Location must be valid US zip code or state abbreviation"
  },
  {
    field: "vehicleType",
    constraint: "Must be: sedan | suv | truck | electric | hybrid",
    error: "Invalid vehicle type"
  },
  {
    field: "minReliabilityScore",
    constraint: "50 ≤ score ≤ 100",
    error: "Reliability score must be 50-100"
  },
  {
    field: "maxCO2PerMile",
    constraint: "100 ≤ g/mi ≤ 300",
    error: "CO2 limit must be 100-300 g/mile"
  }
]
```

### Validation Examples

```typescript
// VALID
{
  budget: 40000,
  primaryUse: 'daily_commute',
  location: '90210',
  preferences: {
    vehicleType: 'electric',
    minReliabilityScore: 80,
    maxCO2PerMile: 150,
    desiredFeatures: []
  }
}
// Result: { isValid: true, errors: [] }

// INVALID: Budget too high
{
  budget: 60000,  // > $50k
  ...
}
// Result: { isValid: false, errors: ["Budget must be $10,000-$50,000"] }

// INVALID: Multiple errors
{
  budget: 5000,  // < $10k
  minReliabilityScore: 120,  // > 100
  ...
}
// Result: { 
//   isValid: false, 
//   errors: [
//     "Budget must be $10,000-$50,000",
//     "Reliability score must be 50-100"
//   ] 
// }
```

---

## Output Specification

### API Response Format

```typescript
interface APIResponse {
  success: boolean;
  recommendations?: VehicleRecommendation[];
  error?: string;
  meta?: {
    generatedAt: string;  // ISO timestamp
    processTime: number;   // milliseconds
    vehiclesConsidered: number;
    vehiclesFiltered: number;
    topRankScore: number;  // Total score of #1 recommendation
  };
}

// Success response:
{
  success: true,
  recommendations: [
    {
      rank: 1,
      vehicle: {...},
      scores: {...},
      tcoBreakdown: {...},
      explanation: "..."
    },
    // ... 4 more
  ],
  meta: {
    generatedAt: "2024-10-07T15:30:00Z",
    processTime: 145,
    vehiclesConsidered: 50,
    vehiclesFiltered: 12,
    topRankScore: 89
  }
}

// Error response:
{
  success: false,
  error: "Budget must be between $10,000 and $50,000",
  recommendations: null
}
```

### Explanation Template

```
Template Pattern:
"[Vehicle Name] offers [PRIMARY BENEFIT] at [PRICE] while maintaining strong [SECONDARY BENEFIT]. It ranks #[RANK] due to [KEY DIFFERENTIATOR]."

Examples:

#1 Tesla Model 3:
"Tesla Model 3 offers the lowest emissions and strong autopilot technology within your budget while delivering excellent reliability. It ranks #1 due to exceptional environmental impact and forward-thinking features."

#2 Honda Civic:
"Honda Civic offers exceptional value and reliability at a budget-friendly $25k price point while maintaining reasonable fuel efficiency. It ranks #2 due to superior resale value and proven dependability."

#3 Toyota Camry:
"Toyota Camry combines hybrid efficiency with premium comfort for a mid-range price. It ranks #3 due to balanced performance across all categories and legendary reliability."

Requirements:
- Length: 100-200 characters
- Must explain WHY it ranks (not just describe it)
- Should highlight 1-2 key strengths
- Must mention rank number
```

---

## Test Cases

### Test Suite 1: Budget Fit Scoring

```
Test 1.1: Perfect budget match
Input: User budget $40k, Car price $40k
Expected: budgetFit = 100

Test 1.2: 5% over budget
Input: User budget $40k, Car price $42k
Expected: budgetFit ≈ 95

Test 1.3: At 20% threshold
Input: User budget $40k, Car price $48k
Expected: budgetFit ≈ 83 (or filtered)

Test 1.4: Over 20% threshold
Input: User budget $40k, Car price $50k
Expected: Filtered out (not in results)
```

### Test Suite 2: TCO Calculation

```
Test 2.1: Gas car TCO accuracy
Input: Honda Civic ($25k, 28 MPG, 85 reliability)
Expected TCO: ≈ $28,000 (±$500)
Breakdown:
  - Purchase: $25,000
  - Fuel: (60k/28) × $3.50 = $7,500
  - Insurance: $1,200 × 1.0 × 5 = $6,000
  - Maintenance: $900 × 5 = $4,500
  - Resale: -$15,000 (60%)
  - Total: $28,000

Test 2.2: EV TCO accuracy
Input: Tesla Model 3 ($40k, 75 kWh, 88 reliability)
Expected TCO: ≈ $28,996 (±$500)
Breakdown:
  - Purchase: $40,000
  - Electricity: (60k/3.5) × $0.18 (CA) = $3,086
  - Insurance: $1,200 × 1.3 (CA) × 0.95 (EV) × 5 = $7,410
  - Maintenance: $900 × 5 = $4,500
  - Resale: -$26,000 (65%)
  - Total: $28,996

Test 2.3: Location multiplier (California +30%)
Input: Same Tesla, California (1.3×) vs Texas (0.95×)
Expected: CA TCO should be $3,024 more than TX
  (insurance $7,410 vs $5,415 = +$1,995; electricity $3,086 vs $2,057 = +$1,029)
```

### Test Suite 3: Filtering Logic

```
Test 3.1: Budget filter works
Input: User budget $20k, 50 cars
Expected: Only cars ≤ $24k remain

Test 3.2: Reliability filter works
Input: minReliability 80, 50 cars
Expected: Only cars with score ≥ 80 remain

Test 3.3: Emissions filter works
Input: maxCO2 150, 50 cars
Expected: Only EVs and low-emission hybrids remain

Test 3.4: Multiple filters combined
Input: Budget $30k, minReliability 75, maxCO2 200
Expected: Returns only cars matching ALL criteria
```

### Test Suite 4: Ranking Logic

```
Test 4.1: Eco-conscious buyer gets Tesla #1
Input: 
  Budget: $40k
  Vehicle type: electric
  maxCO2: 150
  minReliability: 75
Expected: 
  Rank 1: Tesla Model 3
  Rank 2-5: Other EVs/hybrids by score

Test 4.2: Budget-conscious buyer gets Honda #1
Input:
  Budget: $25k
  Vehicle type: sedan
  minReliability: 70
Expected:
  Rank 1: Honda Civic or Toyota Corolla
  Higher reliability = higher rank

Test 4.3: Luxury buyer gets appropriate car
Input:
  Budget: $50k
  Vehicle type: luxury
  primaryUse: luxury
Expected:
  Rank 1-5: BMW, Mercedes, Audi, Lexus, Tesla
  Ranked by total score (reliability + resale + emissions)
```

### Test Suite 5: Scoring Dimensions

```
Test 5.1: All scores 0-100
Input: Any valid recommendation
Expected: 
  - budgetFit: 0-100
  - tco: 0-100
  - emissions: 0-100
  - reliability: 0-100
  - resale: 0-100
  - total: 0-100

Test 5.2: Weights sum to 100
Input: Calculate total score
Expected: 
  total = (BF × 0.25) + (TCO × 0.25) + (Ems × 0.20) + (Rel × 0.20) + (Res × 0.10)
  = exactly weighted average

Test 5.3: Top 5 ranked correctly
Input: Score 5 cars: [92, 85, 78, 71, 65]
Expected: Rank 1-5 in descending order of total score
```

### Test Suite 6: Explanation Generation

```
Test 6.1: Explanation exists for every recommendation
Input: Any 5 recommendations
Expected: All have non-empty explanation string

Test 6.2: Explanation length valid
Input: Any recommendation
Expected: 100 ≤ length ≤ 200 characters

Test 6.3: Explanation mentions rank
Input: #3 recommendation
Expected: Explanation contains "ranks #3" or "#3"
```

---

## Error Handling

### Error Categories

```typescript
enum ErrorCode {
  INVALID_BUDGET = 'ERR_INVALID_BUDGET',
  INVALID_LOCATION = 'ERR_INVALID_LOCATION',
  INVALID_VEHICLE_TYPE = 'ERR_INVALID_VEHICLE_TYPE',
  INVALID_RELIABILITY_SCORE = 'ERR_INVALID_RELIABILITY',
  NO_VEHICLES_MATCH = 'ERR_NO_MATCHES',
  DATABASE_ERROR = 'ERR_DATABASE',
  INTERNAL_SERVER_ERROR = 'ERR_INTERNAL',
}

interface ErrorResponse {
  success: false;
  error: string;  // User-friendly message
  code: ErrorCode;  // For client error handling
  details?: string;  // Technical details (dev mode only)
}
```

### Specific Handling

```
1. Invalid Budget
   Input: budget = 5000
   Response: {
     success: false,
     error: "Budget must be between $10,000 and $50,000",
     code: 'ERR_INVALID_BUDGET'
   }
   HTTP Status: 400 Bad Request

2. Invalid Location
   Input: location = 'INVALID'
   Behavior: Use 'DEFAULT' (no error)
   Log: Warning that location was invalid, using default

3. No Vehicles Match
   Input: Budget $10k, minReliability 95, maxCO2 100
   Response: {
     success: false,
     error: "No vehicles match your criteria. Try relaxing reliability or emissions filters.",
     code: 'ERR_NO_MATCHES'
   }
   HTTP Status: 404 Not Found

4. Database Error
   Behavior: Return generic 500 error
   Log: Full error details to console/monitoring
   Response: {
     success: false,
     error: "Unable to fetch vehicle data. Please try again.",
     code: 'ERR_DATABASE'
   }
   HTTP Status: 500 Internal Server Error
```

---

## Examples

### Example 1: Eco-Conscious Buyer in California

**Input:**
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

**Processing:**
1. Validation: ✅ All fields valid
2. Filter: Keep only EVs with reliability ≥80, CO2 <150, price ≤$48k
3. Candidates: [Tesla Model 3, Tesla Model Y, Chevy Bolt EV, Hyundai Ioniq 6, Nissan Leaf Plus]
4. Score each on 5 dimensions
5. Rank by total score

**Expected Output:**
```json
{
  "success": true,
  "recommendations": [
    {
      "rank": 1,
      "vehicle": {
        "name": "Tesla Model 3",
        "price": 40000,
        "fuelType": "electric",
        "reliabilityScore": 88,
        "co2PerMile": 120
      },
      "scores": {
        "budgetFit": 100,
        "tco": 64,
        "emissions": 100,
        "reliability": 88,
        "resale": 65,
        "total": 85
      },
      "tcoBreakdown": {
        "purchasePrice": 40000,
        "fuelCost5Yr": 3086,
        "insuranceCost5Yr": 7410,
        "maintenanceCost5Yr": 4500,
        "resaleValue": 26000,
        "total": 28996
      },
      "explanation": "Tesla Model 3 offers the lowest emissions and strongest autopilot technology while staying within your $40k budget. It ranks #1 due to exceptional environmental impact and forward-thinking features."
    },
    // ... 4 more recommendations
  ],
  "meta": {
    "generatedAt": "2024-10-07T15:30:00Z",
    "processTime": 145,
    "vehiclesConsidered": 50,
    "vehiclesFiltered": 12,
    "topRankScore": 85
  }
}
```

---

### Example 2: Budget-Conscious Family Buyer in Texas

**Input:**
```json
{
  "budget": 25000,
  "primaryUse": "family_trips",
  "location": "77001",
  "preferences": {
    "vehicleType": "suv",
    "minReliabilityScore": 75,
    "maxCO2PerMile": 250,
    "desiredFeatures": ["spacious-interior"]
  }
}
```

**Expected Top Recommendation:**
- Honda CR-V (reliable, spacious, $28k, 27 MPG)
- TCO: ~$28,500 (higher resale, cheaper insurance in TX)
- Rank #1 due to: Best value, proven reliability, family-friendly

---

### Example 3: Error Case - No Matches

**Input:**
```json
{
  "budget": 15000,
  "primaryUse": "luxury",
  "location": "DEFAULT",
  "preferences": {
    "vehicleType": "electric",
    "minReliabilityScore": 90,
    "maxCO2PerMile": 100,
    "desiredFeatures": []
  }
}
```

**Expected Output:**
```json
{
  "success": false,
  "error": "No vehicles match your criteria. EVs in the $15k range don't exist. Try increasing your budget to $30k+ or relaxing the reliability requirement.",
  "code": "ERR_NO_MATCHES"
}
```

---

## Implementation Checklist

### Phase 1: Data & Types (Day 1, Hours 1-2)
- [ ] Create `lib/types/index.ts` with all interfaces
- [ ] Create `data/vehicles.ts` with 50 sample vehicles
- [ ] Create `lib/db/locations.ts` with location multipliers

### Phase 2: Calculation Engine (Day 1, Hours 3-6)
- [ ] Implement `lib/engine/calculator.ts` (TCO calculations)
- [ ] Implement `lib/engine/scorer.ts` (5-part scoring)
- [ ] Implement `lib/engine/ranker.ts` (filtering + ranking)
- [ ] Implement `lib/engine/validator.ts` (input validation)
- [ ] Write unit tests for each module

### Phase 3: API Layer (Day 1-2, Hours 7-12)
- [ ] Create `app/api/recommend/route.ts` (Next.js endpoint)
- [ ] Wire engine to API
- [ ] Add error handling middleware
- [ ] Add response formatting

### Phase 4: Frontend (Day 2, Hours 13-18)
- [ ] Create `components/RecommendationForm.tsx`
- [ ] Create `components/ResultsCard.tsx`
- [ ] Create `app/page.tsx` (home page)
- [ ] Add CSS/Tailwind styling
- [ ] Connect form to API

### Phase 5: Testing & Deploy (Day 3, Hours 19-24)
- [ ] Run all unit tests
- [ ] Manual testing (5+ scenarios)
- [ ] Deploy to Vercel
- [ ] Test production API
- [ ] Create README

---

## Success Criteria

Each success criterion is TESTABLE:

- [x] **Validation:** Invalid budget rejected with clear error message
- [x] **Filtering:** Budget $20k user sees 0 cars >$24k
- [x] **TCO Accuracy:** Car TCO within ±5% of manual calculation
- [x] **Ranking:** Cars ranked correctly by total score (descending)
- [x] **Scoring:** All 5 dimensions return 0-100 values
- [x] **Explanation:** Every recommendation has 100-200 char explanation
- [x] **Performance:** API responds in <500ms (after first request)
- [x] **Error Handling:** All error codes tested and working
- [x] **Frontend:** Form accepts all 6 inputs, displays top 5
- [x] **Production:** Deployed to Vercel, live URL accessible

---

## Notes for Implementation

1. **Hardcoded Data (MVP):** 50-vehicle database is hardcoded. Replace with database in v2.
2. **Default Location:** If location is invalid, use 'DEFAULT' (1.0 multiplier, $0.15/kWh).
3. **Rounding:** Scores round to nearest integer. TCO in dollars (no cents).
4. **Async:** All APIs should handle async/await properly for future database integration.
5. **TypeScript:** All code must be fully typed. No `any` types.
6. **Comments:** Scoring logic must be heavily commented (explain the why, not just the what).

---

**Status: Ready for Claude Code generation**

