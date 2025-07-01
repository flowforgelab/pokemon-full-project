import { getDeckTemplate, formatDeckListAsText, formatDeckListForPTCGO } from '@/data/deck-templates';

async function testRayquazaDeckImport() {
  console.log('Testing Rayquaza GX Battle Arena Deck Import\n');
  
  // Get the Rayquaza GX deck template
  const template = getDeckTemplate('rayquaza-gx-battle-arena');
  
  if (!template) {
    console.error('Could not find Rayquaza GX Battle Arena deck template!');
    return;
  }
  
  console.log('Deck Name:', template.name);
  console.log('Description:', template.description);
  console.log('Format:', template.format);
  console.log('Release Date:', template.releaseDate);
  console.log('\n--- Deck List (Text Format) ---\n');
  console.log(formatDeckListAsText(template));
  
  console.log('\n--- Deck List (PTCGO Format) ---\n');
  console.log(formatDeckListForPTCGO(template));
  
  if (template.strategy) {
    console.log('\n--- Strategy Guide ---\n');
    console.log('Overview:', template.strategy.overview);
    console.log('\nKey Cards:');
    template.strategy.keyCards.forEach(card => console.log(`  - ${card}`));
    console.log('\nGame Plan:', template.strategy.gameplan);
  }
  
  // Verify card counts
  const totalCards = template.cards.reduce((sum, card) => sum + card.quantity, 0);
  console.log(`\nTotal Cards: ${totalCards} (Should be 60)`);
  
  if (totalCards !== 60) {
    console.error('WARNING: Deck does not have exactly 60 cards!');
  }
}

// Run the test
testRayquazaDeckImport().catch(console.error);