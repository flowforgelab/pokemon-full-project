import { PrismaClient } from '@prisma/client';
import { SafeAnalyzer } from '../lib/analysis/safe-analyzer';
import { getCardQualityScore, categorizeCard } from '../lib/analysis/card-quality-database';

const prisma = new PrismaClient();

async function detailedAnalysis() {
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
    console.log('DETAILED ANALYSIS:', deck.name);
    console.log('========================================\n');
    
    // Run analysis
    const analyzer = new SafeAnalyzer();
    const analysis = await analyzer.analyzeDeck(deck);
    
    // Show trainer quality analysis
    console.log('TRAINER CARD QUALITY ANALYSIS:');
    console.log('-------------------------------');
    
    const trainers = deck.cards.filter(dc => dc.card.supertype === 'TRAINER');
    trainers.forEach(dc => {
      const score = getCardQualityScore(dc.card.name);
      const category = categorizeCard(dc.card.name, 'TRAINER');
      console.log(`${dc.quantity}x ${dc.card.name}`);
      console.log(`   Score: ${score}/10 | Category: ${category}`);
    });
    
    // Calculate average trainer quality
    const totalScore = trainers.reduce((sum, dc) => 
      sum + (getCardQualityScore(dc.card.name) * dc.quantity), 0
    );
    const totalCards = trainers.reduce((sum, dc) => sum + dc.quantity, 0);
    const avgScore = totalCards > 0 ? (totalScore / totalCards).toFixed(1) : 0;
    
    console.log(`\nAverage Trainer Quality: ${avgScore}/10`);
    
    // Show detailed consistency breakdown
    console.log('\nCONSISTENCY BREAKDOWN:');
    console.log('----------------------');
    console.log('Mulligan Probability:', (analysis.consistency.mulliganProbability * 100).toFixed(1) + '%');
    console.log('Dead Draw Probability:', (analysis.consistency.deadDrawProbability * 100).toFixed(1) + '%');
    console.log('Overall Consistency:', analysis.consistency.overallConsistency.toFixed(1) + '%');
    
    // Show all warnings with details
    console.log('\nWARNINGS & ISSUES:');
    console.log('------------------');
    if (analysis.warnings.length === 0) {
      console.log('No issues found!');
    } else {
      analysis.warnings.forEach((w, i) => {
        console.log(`${i + 1}. [${w.severity.toUpperCase()}] ${w.category}: ${w.message}`);
        if (w.suggestion) {
          console.log(`   → ${w.suggestion}`);
        }
      });
    }
    
    // Show all recommendations
    console.log('\nRECOMMENDATIONS:');
    console.log('-----------------');
    analysis.recommendations.forEach((r, i) => {
      console.log(`${i + 1}. [${r.priority.toUpperCase()}] ${r.type.toUpperCase()}: ${r.reason}`);
      console.log(`   Impact: ${r.impact}`);
      if (r.suggestion) {
        console.log(`   Action: ${r.suggestion}`);
      }
    });
    
    // Show score comparison
    console.log('\nSCORE ANALYSIS:');
    console.log('----------------');
    console.log('Overall Score:', analysis.scores.overall, '/ 100');
    console.log('- Consistency:', analysis.scores.consistency);
    console.log('- Speed:', analysis.scores.speed);
    console.log('- Power:', analysis.scores.power);
    console.log('- Versatility:', analysis.scores.versatility);
    console.log('- Meta Relevance:', analysis.scores.metaRelevance);
    console.log('- Innovation:', analysis.scores.innovation);
    console.log('- Difficulty:', analysis.scores.difficulty);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

detailedAnalysis().catch(console.error);