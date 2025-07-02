import { PrismaClient } from '@prisma/client';
import { SafeAnalyzer } from '../lib/analysis/safe-analyzer';
import { calculateMultiFactorScore } from '../lib/analysis/multi-factor-scoring';
import { calculateDynamicSpeedRating } from '../lib/analysis/dynamic-speed-rating';
import { analyzePrizeTradeEconomy } from '../lib/analysis/prize-trade-analysis';

const prisma = new PrismaClient();
const analyzer = new SafeAnalyzer();

async function testPhase3Analysis() {
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
    console.log('PHASE 3 ANALYSIS TEST:', deck.name);
    console.log('========================================\n');
    
    // 1. Multi-Factor Scoring
    console.log('1. MULTI-FACTOR SCORING ANALYSIS');
    console.log('--------------------------------');
    const multiFactorScore = calculateMultiFactorScore(deck.cards);
    console.log(`Overall Score: ${multiFactorScore.overallScore}/100`);
    console.log(`Confidence Level: ${(multiFactorScore.confidenceLevel * 100).toFixed(0)}%`);
    
    console.log('\nScore Breakdown:');
    Object.entries(multiFactorScore.scoreBreakdown).forEach(([category, score]) => {
      console.log(`  ${category}: ${score}/100`);
    });
    
    console.log('\nTop Factors:');
    multiFactorScore.factors
      .sort((a, b) => b.rawScore - a.rawScore)
      .slice(0, 5)
      .forEach(factor => {
        console.log(`  ${factor.name} (${factor.category}): ${factor.rawScore}/100`);
        factor.details.forEach(detail => console.log(`    - ${detail}`));
      });
    
    console.log('\nStrengths:');
    multiFactorScore.strengths.forEach((s, i) => console.log(`${i + 1}. ${s}`));
    
    console.log('\nWeaknesses:');
    multiFactorScore.weaknesses.forEach((w, i) => console.log(`${i + 1}. ${w}`));
    
    // 2. Dynamic Speed Rating
    console.log('\n\n2. DYNAMIC SPEED RATING');
    console.log('-----------------------');
    const speedRating = calculateDynamicSpeedRating(deck.cards);
    console.log(`Speed Classification: ${speedRating.classification.toUpperCase()}`);
    console.log(`Absolute Speed: ${speedRating.absoluteSpeed}/100`);
    console.log(`Relative to Meta: ${speedRating.relativeSpeed}/100`);
    console.log(`First Attack Turn: ${speedRating.firstAttackTurn}`);
    console.log(`Full Setup Turn: ${speedRating.fullSetupTurn}`);
    
    console.log('\nTurn-by-Turn Analysis:');
    speedRating.turnByTurnAnalysis.forEach(turn => {
      console.log(`\nTurn ${turn.turn}:`);
      console.log(`  Setup: ${(turn.setupProbability * 100).toFixed(0)}%`);
      console.log(`  Damage: ${turn.damageOutput}`);
      console.log(`  Energy: ${turn.energyAttached}`);
      console.log(`  ${turn.description}`);
    });
    
    console.log('\nMeta Comparison:');
    console.log(`Faster than: ${speedRating.metaComparison.fasterThan.join(', ') || 'None'}`);
    console.log(`Slower than: ${speedRating.metaComparison.slowerThan.join(', ') || 'None'}`);
    console.log(`Comparable to: ${speedRating.metaComparison.comparable.join(', ') || 'None'}`);
    
    // 3. Prize Trade Economy
    console.log('\n\n3. PRIZE TRADE ECONOMY ANALYSIS');
    console.log('--------------------------------');
    const prizeEconomy = analyzePrizeTradeEconomy(deck.cards);
    console.log(`Overall Efficiency: ${prizeEconomy.overallEfficiency}/100`);
    console.log(`Average Prize Value: ${prizeEconomy.averagePrizeValue.toFixed(2)} prizes given up`);
    console.log(`Total Prize Liability: ${prizeEconomy.prizeLiability} prizes`);
    console.log(`Strategy: ${prizeEconomy.strategy.primaryApproach}`);
    console.log(`Game Plan: ${prizeEconomy.strategy.idealGameplan}`);
    
    console.log('\nBest Prize Traders:');
    prizeEconomy.bestTraders.slice(0, 3).forEach(trader => {
      console.log(`  ${trader.pokemon}: ${trader.maxDamage} damage for ${trader.prizeValue} prize(s)`);
      console.log(`    Efficiency: ${trader.efficiency.toFixed(0)} damage/prize`);
    });
    
    console.log('\nWorst Liabilities:');
    prizeEconomy.worstLiabilities.slice(0, 3).forEach(liability => {
      console.log(`  ${liability.pokemon}: ${liability.prizeValue} prizes, ${liability.hp} HP`);
      console.log(`    Risk: ${liability.risk}`);
    });
    
    console.log('\nKey Trade Scenarios:');
    prizeEconomy.scenarios.slice(0, 5).forEach(scenario => {
      const icon = scenario.evaluation === 'excellent' ? '⭐' :
                   scenario.evaluation === 'favorable' ? '✓' :
                   scenario.evaluation === 'even' ? '—' : '✗';
      console.log(`${icon} ${scenario.yourAttacker} (${scenario.yourPrizeValue}) vs ${scenario.opponentTarget} (${scenario.opponentPrizeValue})`);
      console.log(`   Trade Ratio: ${scenario.tradeRatio.toFixed(1)}:1 (${scenario.evaluation})`);
    });
    
    // 4. Full Analysis with Phase 3
    console.log('\n\n4. FULL DECK ANALYSIS WITH PHASE 3');
    console.log('----------------------------------');
    const analysis = await analyzer.analyzeDeck(deck);
    
    console.log(`Overall Score: ${analysis.scores.overall}/100`);
    console.log(`Difficulty: ${analysis.scores.difficulty}/100`);
    console.log('\nCore Strategy: ' + analysis.scores.breakdown.coreStrategy);
    console.log('\nWin Conditions:');
    analysis.scores.breakdown.winConditions.forEach((wc, i) => {
      console.log(`${i + 1}. ${wc}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPhase3Analysis().catch(console.error);