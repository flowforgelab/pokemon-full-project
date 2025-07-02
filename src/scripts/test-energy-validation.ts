import { PrismaClient } from '@prisma/client';
import { isBasicEnergy, validateDeckLegality, getDeckCompositionWarnings } from '../lib/analysis/deck-validator';
import { getCardQualityScore } from '../lib/analysis/card-quality-database';

const prisma = new PrismaClient();

async function testEnergyValidation() {
  try {
    // Find the Rayquaza deck
    const deck = await prisma.deck.findFirst({
      where: {
        name: { contains: 'Rayquaza', mode: 'insensitive' }
      },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    });
    
    if (!deck) {
      console.log('No Rayquaza deck found');
      return;
    }
    
    console.log('========================================');
    console.log('ENERGY VALIDATION TEST:', deck.name);
    console.log('========================================\n');
    
    // Test energy card detection and scoring
    const energyCards = deck.cards.filter(dc => dc.card.supertype === 'ENERGY');
    
    console.log('ENERGY CARDS IN DECK:');
    energyCards.forEach(dc => {
      const isBasic = isBasicEnergy(dc.card);
      const score = getCardQualityScore(dc.card);
      
      console.log(`${dc.quantity}x ${dc.card.name}`);
      console.log(`  Type: ${isBasic ? 'Basic Energy' : 'Special Energy'}`);
      console.log(`  Quality Score: ${score}/10`);
      console.log(`  Subtypes: ${dc.card.subtypes.join(', ') || 'None'}`);
      console.log('');
    });
    
    console.log('----------------------------------------\n');
    
    // Test deck legality validation
    console.log('DECK LEGALITY CHECK:');
    const validation = validateDeckLegality(deck.cards);
    
    console.log(`Total Cards: ${validation.totalCards}`);
    console.log(`Is Legal: ${validation.isLegal ? '✓ Yes' : '✗ No'}`);
    
    if (validation.issues.length > 0) {
      console.log('\nLegality Issues:');
      validation.issues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`${icon} ${issue.message}`);
        if (issue.suggestion) {
          console.log(`   → ${issue.suggestion}`);
        }
      });
    } else {
      console.log('\n✓ No legality issues found');
    }
    
    console.log('\n----------------------------------------\n');
    
    // Test composition warnings
    console.log('DECK COMPOSITION ANALYSIS:');
    const compositionWarnings = getDeckCompositionWarnings(deck.cards);
    
    if (compositionWarnings.length > 0) {
      compositionWarnings.forEach(warning => {
        const icon = warning.severity === 'error' ? '❌' : '⚠️';
        console.log(`${icon} ${warning.message}`);
        if (warning.suggestion) {
          console.log(`   → ${warning.suggestion}`);
        }
      });
    } else {
      console.log('✓ Deck composition looks good');
    }
    
    // Test with a deck that has too many non-basic energy
    console.log('\n----------------------------------------\n');
    console.log('TESTING CARD LIMITS:');
    
    // Count cards by name
    const cardCounts = new Map<string, { quantity: number; isBasic: boolean }>();
    deck.cards.forEach(dc => {
      const existing = cardCounts.get(dc.card.name);
      if (existing) {
        existing.quantity += dc.quantity;
      } else {
        cardCounts.set(dc.card.name, {
          quantity: dc.quantity,
          isBasic: dc.card.supertype === 'ENERGY' && isBasicEnergy(dc.card)
        });
      }
    });
    
    // Show cards with 4+ copies
    let hasViolations = false;
    for (const [cardName, { quantity, isBasic }] of cardCounts) {
      if (quantity >= 4) {
        if (quantity > 4 && !isBasic) {
          console.log(`❌ ${cardName}: ${quantity} copies (ILLEGAL - max 4 allowed)`);
          hasViolations = true;
        } else if (isBasic && quantity > 4) {
          console.log(`✓ ${cardName}: ${quantity} copies (LEGAL - basic energy has no limit)`);
        } else if (quantity === 4) {
          console.log(`✓ ${cardName}: ${quantity} copies (at limit)`);
        }
      }
    }
    
    if (!hasViolations) {
      console.log('✓ No card limit violations found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEnergyValidation().catch(console.error);