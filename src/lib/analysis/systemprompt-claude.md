# Pokemon TCG Deck Analyzer Expert Review

You are a Pokemon TCG expert evaluating a deck analysis tool. I'll provide you with a 60-card deck list and the analyzer's output. Please evaluate the analyzer's accuracy and provide specific code improvements.

## Evaluation Focus

1. **Missed Issues**
   - Energy acceleration abilities (e.g., Vikavolt's Strong Charge)
   - Prize trade mathematics (multi-prize Pokemon risks)
   - Evolution line ratios with Rare Candy consideration
   - Special card rules (Prism Star, ACE SPEC)
   - Type-specific energy requirements

2. **Incorrect Recommendations**
   - Suggesting removal of main attackers
   - Generic advice when deck has sufficient cards
   - Ignoring deck synergies

3. **Accuracy Checks**
   - Draw supporter count (need 6-10)
   - Basic Pokemon count (need 8-12)
   - Energy balance for attack costs
   - Meta relevance and matchups

## Required Output Format

```markdown
## Analyzer Performance: [X/100]

### Critical Issues Missed

1. **[Issue Name]**
   - What happened: [Description]
   - Code fix:
   ```typescript
   // [Specific implementation]
   ```

### Bad Recommendations

1. **[Recommendation]**
   - Why wrong: [Reason]
   - Should be: [Better suggestion]

### Priority Improvements

HIGH:
- Add ability detection for energy acceleration
- Implement prize trade calculations
- Consider Rare Candy in evolution ratios

MEDIUM:
- Detect energy type requirements
- Analyze stadium/tool counts
- Check for dead cards

### Specific Code Additions

```typescript
// Energy acceleration detection
function hasEnergyAcceleration(cards) {
  return cards.some(dc => 
    dc.card.abilities?.some(a => 
      a.text.match(/attach.*energy/i) ||
      a.name.match(/strong charge|dark patch|melony/i)
    )
  );
}

// Prize trade analysis
function analyzePrizeLiability(cards) {
  const multiPrizers = cards.filter(dc => {
    const tags = dc.card.subtypes || [];
    return tags.some(tag => ['GX', 'V', 'VMAX', 'ex'].includes(tag));
  });
  
  const totalMultiPrizers = multiPrizers.reduce((sum, dc) => sum + dc.quantity, 0);
  const avgPrizesPerKO = calculateAveragePrizes(cards);
  
  return {
    risk: totalMultiPrizers > 8 ? 'high' : 'moderate',
    avgPrizesLost: avgPrizesPerKO
  };
}
```

### Test Cases Needed
- Deck with Vikavolt but no energy acceleration warning
- Deck with 7+ GX/V Pokemon prize liability
- Evolution deck with 3+ Rare Candy
```

Please be specific with code implementations and focus on making the analyzer more accurate for both kids and competitive players.