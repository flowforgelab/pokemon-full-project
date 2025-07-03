# Revised Evaluation Priorities for Deck Analyzer

## Current Priorities Analysis

The current priorities focus too heavily on specific mechanics rather than fundamental deck construction principles. Here's why they need restructuring:

### Issues with Current Priorities:

1. **Energy acceleration** is listed first, but it's useless if the deck can't consistently set up
2. **Prize trade math** is important but secondary to having a functional deck
3. **Evolution ratios** are too specific - what about non-evolution decks?
4. **Draw engine** is too narrow - should be "consistency engine"
5. **Meta relevance** requires accurate, updated meta data

## Recommended Priority Structure

### Tier 1: Fundamental Playability (Must Pass)
1. **Format Legality & Card Limits**
   - Rotation compliance
   - 4-copy rule (except basic energy)
   - Special restrictions (ACE SPEC, Prism Star, Radiant)

2. **Basic Pokemon Sufficiency**
   - Mulligan probability < 15%
   - Minimum 8-10 basics for most decks
   - Opening hand viability

3. **Win Condition Clarity**
   - Clear primary attacker(s)
   - Damage output capability
   - Strategy coherence

### Tier 2: Consistency & Setup (Core Functionality)
4. **Consistency Engine**
   - Draw support (6-10 cards)
   - Search cards (6-12 cards)
   - Deck thinning options
   - Ability-based draw

5. **Energy System Balance**
   - Energy count matches attack costs
   - Acceleration options if needed
   - Recovery for discarded energy
   - Type matching

6. **Evolution/Setup Feasibility**
   - Evolution ratios (including Rare Candy)
   - Setup speed vs meta
   - Alternative evolution paths

### Tier 3: Competitive Viability
7. **Prize Trade Economics**
   - Average prizes per KO
   - Single vs multi-prize balance
   - Comeback mechanics

8. **Recovery & Sustainability**
   - Pokemon recovery options
   - Resource recycling
   - Late game viability

9. **Disruption & Defense**
   - Gust effects (Boss's Orders)
   - Stadiums and tools
   - Hand disruption

### Tier 4: Meta Optimization
10. **Matchup Analysis**
    - vs top 5 meta decks
    - Tech card relevance
    - Weakness coverage

## Why This Structure Works Better

1. **Hierarchical**: Can't optimize prize trades if deck doesn't function
2. **Universal**: Applies to all deck types, not just evolution decks
3. **Practical**: Follows actual deck building process
4. **Measurable**: Each tier has specific metrics

## Implementation Priority

```typescript
interface AnalyzerPriorities {
  // Tier 1: Must pass all
  fundamentals: {
    isLegal: boolean;
    canStart: boolean;  // mulligan rate acceptable
    hasWinCondition: boolean;
  };
  
  // Tier 2: Score each 0-100
  consistency: {
    drawEngine: number;
    searchEngine: number;
    energyBalance: number;
    setupSpeed: number;
  };
  
  // Tier 3: Advanced metrics
  competitive: {
    prizeTrade: number;
    recovery: number;
    disruption: number;
  };
  
  // Tier 4: Meta-dependent
  meta: {
    matchupSpread: number;
    techChoices: number;
  };
}
```

## Revised System Prompt Priorities

```
EVALUATION PRIORITIES (in order):

TIER 1 - FUNDAMENTAL CHECKS (Binary pass/fail):
1. Format legality and card restrictions
2. Basic Pokemon count (mulligan rate < 15%)
3. Win condition identification

TIER 2 - CONSISTENCY METRICS (Score 0-100):
4. Full consistency engine (draw + search + thin)
5. Energy system balance (count + type + acceleration)
6. Setup feasibility (evolution lines, abilities, speed)

TIER 3 - COMPETITIVE ANALYSIS:
7. Prize trade mathematics and tempo
8. Recovery and resource management
9. Disruption tools and defensive options

TIER 4 - META CONSIDERATIONS:
10. Matchup spread vs current top decks
11. Tech card choices and sideboard potential
```

This structure ensures the analyzer catches fundamental issues before worrying about optimization.