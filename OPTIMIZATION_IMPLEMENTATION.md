# Deck Analyzer & Optimizer Integration Implementation

## Summary of Changes

### 1. UI Simplification
- **Hidden non-AI analysis tabs**: Removed Consistency, Synergy, Speed, Meta, and other tabs from the advanced analysis page
- **Renamed tabs**: 
  - "Dashboard" → "AI Expert Analysis"
  - Added "Optimizer" tab with WrenchScrewdriverIcon

### 2. Unified Optimizer Service
Created `/src/lib/deck-optimization/unified-optimizer.ts` that combines:
- **Deck Analysis**: Runs full analysis to identify issues
- **Collection Integration**: Checks user's collection for owned cards
- **Budget Optimization**: Suggests cost-effective alternatives
- **Priority Modes**: Consistency, Speed, Power, or Budget focused
- **Smart Recommendations**: Prioritizes critical fixes, then improvements

Key features:
- Generates optimization recommendations with priorities (critical/high/medium/low)
- Shows which cards are in user's collection
- Calculates total budget needed for missing cards
- Creates tiered upgrade paths (Critical → Core → Premium)
- Estimates score improvements for each change

### 3. Optimization Engine
Created `/src/lib/deck-optimization/optimization-engine.ts` with:
- **Rule-based system**: Prioritized rules for different optimization needs
- **Mode-specific multipliers**: Adjusts priorities based on selected mode
- **Card suggestion database**: Pre-configured card recommendations
- **Constraint handling**: Respects user preferences and limits

### 4. Enhanced DeckOptimizer Component
Updated the component with:
- **Mode Selection**: Visual buttons for Consistency/Speed/Power/Budget
- **Collection Toggle**: "Use my collection" checkbox
- **Budget Input**: Appears when Budget mode is selected
- **Real-time Analysis**: Re-runs when settings change
- **Rich Recommendations**: Shows collection status, pricing, and tags
- **Summary Cards**: Critical issues, cards from collection, budget needed
- **Upgrade Path**: Tiered recommendations with estimated improvements

### 5. Integration Benefits
The new system provides:
- **Seamless Flow**: Analysis results directly feed into optimization
- **Collection Awareness**: Prioritizes cards you already own
- **Budget Consciousness**: Respects financial constraints
- **TCGPlayer Pricing**: Uses real market prices for recommendations
- **Smart Prioritization**: Fixes legality issues first, then improvements
- **Visual Feedback**: Clear indication of what's owned vs. needed

## Architecture

```
User Selects Mode → Unified Optimizer → Analysis Engine
                           ↓
                    Collection Check
                           ↓
                 Optimization Engine
                           ↓
              Prioritized Recommendations
                           ↓
                    UI Display
```

## Usage Flow
1. User navigates to deck analysis page
2. Sees only "AI Expert Analysis" and "Optimizer" tabs
3. Clicks Optimizer tab
4. Selects optimization mode (Consistency/Speed/Power/Budget)
5. Toggles "Use my collection" if desired
6. Sets budget if in Budget mode
7. System automatically analyzes and generates recommendations
8. User can apply individual changes or auto-optimize all
9. Preview shows before/after comparison
10. Can apply all changes to deck

## Technical Implementation
- Uses existing deck analyzer for consistency
- Leverages budget optimizer for cost calculations
- Integrates with collection manager for ownership data
- Maintains 1:1 card replacements (60 cards total)
- Respects deck archetype when possible
- Provides actionable, specific recommendations

## Future Enhancements
1. Add TCGPlayer direct purchase links
2. Implement one-click ordering for missing cards
3. Add community-driven optimization templates
4. Include meta matchup considerations
5. Add historical price tracking for budget optimization