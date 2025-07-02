// Calculate mulligan probability for Rayquaza-GX Battle Arena Deck

// Count of Basic Pokemon in the deck
const basicPokemon = [
  { name: "Rayquaza-GX", quantity: 2 },
  { name: "Tapu Koko Prism Star", quantity: 1 },
  { name: "Magnemite", quantity: 3 },
  { name: "Blitzle", quantity: 2 },
  { name: "Zapdos", quantity: 2 },
  { name: "Zeraora", quantity: 1 },
  { name: "Heracross", quantity: 1 }
];

const totalBasics = basicPokemon.reduce((sum, card) => sum + card.quantity, 0);
const deckSize = 60;
const openingHandSize = 7;

console.log("Rayquaza-GX Battle Arena Deck - Mulligan Analysis\n");
console.log("Basic Pokemon in deck:");
basicPokemon.forEach(card => {
  console.log(`- ${card.quantity}x ${card.name}`);
});
console.log(`\nTotal Basic Pokemon: ${totalBasics}`);

// Calculate probability of NOT getting a basic in opening hand
// This uses hypergeometric distribution
function calculateMulliganProbability(basics: number, deckSize: number, handSize: number): number {
  // Probability of drawing 0 basics in 7 cards
  // = C(non-basics, 7) / C(deck, 7)
  // = C(48, 7) / C(60, 7)
  
  const nonBasics = deckSize - basics;
  
  // Calculate combinations using logarithms to avoid overflow
  function logCombination(n: number, k: number): number {
    if (k > n || k < 0) return -Infinity;
    if (k === 0 || k === n) return 0;
    
    let result = 0;
    for (let i = 0; i < k; i++) {
      result += Math.log(n - i) - Math.log(i + 1);
    }
    return result;
  }
  
  const logMulliganCases = logCombination(nonBasics, handSize);
  const logTotalCases = logCombination(deckSize, handSize);
  
  return Math.exp(logMulliganCases - logTotalCases);
}

const mulliganProb = calculateMulliganProbability(totalBasics, deckSize, openingHandSize);

console.log(`\nMulligan Probability: ${(mulliganProb * 100).toFixed(2)}%`);
console.log(`Chance of getting at least 1 Basic: ${((1 - mulliganProb) * 100).toFixed(2)}%`);

// Compare to what the analyzer said
console.log("\n--- Analyzer Comparison ---");
console.log("Analyzer claimed: 30.0% mulligan rate");
console.log(`Actual calculated: ${(mulliganProb * 100).toFixed(2)}% mulligan rate`);
console.log(`\nThe analyzer was ${Math.abs(30 - mulliganProb * 100).toFixed(1)} percentage points off!`);

// Additional insights
console.log("\n--- Expert Analysis ---");
if (mulliganProb < 0.10) {
  console.log("✓ Excellent mulligan rate (< 10%)");
} else if (mulliganProb < 0.15) {
  console.log("✓ Good mulligan rate (10-15%)");
} else if (mulliganProb < 0.20) {
  console.log("⚠ Acceptable mulligan rate (15-20%)");
} else {
  console.log("✗ Poor mulligan rate (> 20%)");
}

console.log(`\nWith ${totalBasics} Basic Pokemon, competitive decks typically run 11-14 for optimal consistency.`);