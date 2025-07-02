import { PrismaClient } from '@prisma/client';
import { analyzeEvolutionLines } from '../lib/analysis/evolution-line-analyzer';

const prisma = new PrismaClient();

async function testEvolutionAnalysis() {
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
    console.log('EVOLUTION LINE ANALYSIS:', deck.name);
    console.log('========================================\n');
    
    // Get all Pokemon cards with their evolution info
    const pokemonCards = deck.cards.filter(dc => dc.card.supertype === 'POKEMON');
    
    console.log('POKEMON IN DECK:');
    pokemonCards.forEach(dc => {
      console.log(`${dc.quantity}x ${dc.card.name}`);
      if (dc.card.evolvesFrom) {
        console.log(`   → Evolves from: ${dc.card.evolvesFrom}`);
      }
    });
    
    console.log('\n----------------------------------------\n');
    
    // Run evolution line analysis
    const analysis = analyzeEvolutionLines(deck.cards);
    
    console.log('EVOLUTION LINES FOUND:', analysis.lines.length);
    console.log('TOTAL ISSUES:', analysis.totalIssues);
    console.log('OVERALL CONSISTENCY SCORE:', analysis.overallScore, '/ 100\n');
    
    // Show each evolution line
    analysis.lines.forEach((line, index) => {
      console.log(`\n${index + 1}. ${line.name} Evolution Line`);
      console.log('   Structure:', line.structure);
      console.log('   Status:', line.isValid ? '✓ Valid' : '✗ Has Issues');
      
      if (line.bottleneck !== 'none') {
        console.log('   Bottleneck:', line.bottleneck);
      }
      
      if (line.basic) {
        console.log(`   Basic: ${line.basic.quantity}x ${line.basic.card.name}`);
      }
      if (line.stage1) {
        console.log(`   Stage 1: ${line.stage1.quantity}x ${line.stage1.card.name}`);
        console.log(`   → Turn 2 probability: ${(line.consistency.turnTwoStage1 * 100).toFixed(1)}%`);
      }
      if (line.stage2) {
        console.log(`   Stage 2: ${line.stage2.quantity}x ${line.stage2.card.name}`);
        console.log(`   → Turn 3 probability: ${(line.consistency.turnThreeStage2 * 100).toFixed(1)}%`);
      }
      
      if (line.issues.length > 0) {
        console.log('\n   Issues:');
        line.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
      }
      
      if (line.recommendations.length > 0) {
        console.log('\n   Recommendations:');
        line.recommendations.forEach(rec => {
          console.log(`   → ${rec}`);
        });
      }
    });
    
    if (analysis.recommendations.length > 0) {
      console.log('\n\nOVERALL RECOMMENDATIONS:');
      analysis.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEvolutionAnalysis().catch(console.error);