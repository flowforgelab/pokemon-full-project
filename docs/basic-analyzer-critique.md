# Basic Deck Analyzer Critical Review

## Current Issues with Rayquaza Deck Analysis

### 1. **Scoring Too Generous (100/100)**
The Rayquaza deck gets a perfect score despite having several issues:
- Only 1 Charjabug for 2 Vikavolt (evolution line issue)
- Multiple Prism Star cards (5 total - very high prize liability)
- Energy split between types without proper acceleration
- No basic energy acceleration for Lightning type

### 2. **Missing Critical Checks**
The analyzer should detect:
- **Evolution ratio problems**: Having 2 Stage 2 but only 1 Stage 1
- **Energy type mismatch**: Dragon types need multiple energy types
- **Prize liability**: Too many Pokemon that give up 2+ prizes
- **Energy acceleration**: No way to power up big attacks quickly
- **Recovery options**: Limited ways to get Pokemon back

### 3. **Incorrect Energy Validation**
While correctly not flagging basic energy > 4, it should notice:
- 10 Lightning Energy might be excessive for the Pokemon count
- Split energy types without proper support

### 4. **Missing Replacement Suggestions**
When recommending cards to add, it doesn't specify what to remove:
- "Add Professor's Research" - but remove what?
- Should suggest specific trades like "Remove 1 Grubbin, add 1 Charjabug"

## Recommendations for Improvement

### 1. **More Nuanced Scoring**
- Start at 75-80 for a "good" deck
- Only award 90+ for truly exceptional decks
- Deduct more for structural issues

### 2. **Evolution Line Analysis**
```typescript
// Check if Stage 2 count > Stage 1 count
if (stage2Count > stage1Count) {
  advice.push({
    category: 'oops',
    title: 'Evolution Line Problem!',
    message: `You have ${stage2Count} Stage 2 Pokemon but only ${stage1Count} Stage 1!`,
    fixIt: `Add more Stage 1 Pokemon or remove some Stage 2s.`,
    cardsToRemove: [{name: 'Vikavolt', quantity: 1, reason: 'Not enough Charjabug'}],
    cardsToAdd: [{name: 'Charjabug', quantity: 1, why: 'Need more to evolve'}]
  });
}
```

### 3. **Prize Trade Analysis**
```typescript
// Calculate average prizes given up
const multiPrizers = cards.filter(isPrizeHeavy);
if (multiPrizers > totalPokemon * 0.4) {
  advice.push({
    category: 'needs-help',
    title: 'Too Many Big Prize Pokemon!',
    message: 'Your opponent wins faster when they knock out GX/V Pokemon!',
    tip: 'Mix in regular Pokemon that only give 1 prize'
  });
}
```

### 4. **Energy System Check**
```typescript
// Check if energy matches Pokemon needs
const energyTypes = getEnergyTypes(cards);
const pokemonTypes = getPokemonAttackCosts(cards);
if (!energyTypesMatchPokemon(energyTypes, pokemonTypes)) {
  advice.push({
    category: 'needs-help',
    title: 'Energy Doesn\'t Match Pokemon!',
    message: 'Your Pokemon need different energy than what you have!'
  });
}
```

### 5. **Specific Replacement Matrix**
For each "add" suggestion, provide corresponding "remove" options:
- Add Trainer → Remove excess Pokemon/Energy
- Add Evolution → Remove weak basics
- Add consistency → Remove luxury cards

## Expected Analysis for Rayquaza Deck

**Score**: 70-75/100 ⭐⭐

**Issues to Flag**:
1. ❌ Evolution line incomplete (2 Vikavolt, 1 Charjabug)
2. 🤔 Too many Prism Star Pokemon (5 total - high prize risk)
3. 🤔 Energy acceleration missing (how to power up 3-4 energy attacks?)
4. 🤔 Consider reducing Lightning Energy from 10 to 7-8

**Specific Swaps**:
- Remove: 1 Vikavolt or 1 Grubbin
- Add: 1 Charjabug (complete evolution line)
- Remove: 2-3 Lightning Energy
- Add: 2-3 more Trainer cards for consistency