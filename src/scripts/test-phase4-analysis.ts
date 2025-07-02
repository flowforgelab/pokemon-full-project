import { PrismaClient } from '@prisma/client';
import { SafeAnalyzer } from '../lib/analysis/safe-analyzer';
import { generateSmartWarnings, getWarningSummary } from '../lib/analysis/smart-warnings';
import { generateCardRecommendations } from '../lib/analysis/card-recommendations';

const prisma = new PrismaClient();
const analyzer = new SafeAnalyzer();

async function testPhase4Analysis() {
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
    console.log('PHASE 4 ANALYSIS TEST:', deck.name);
    console.log('========================================\n');
    
    // 1. Smart Warnings
    console.log('1. SMART WARNING SYSTEM');
    console.log('----------------------');
    const warnings = generateSmartWarnings(deck.cards);
    const summary = getWarningSummary(warnings);
    
    console.log(`Total Warnings: ${summary.total}`);
    console.log(`  Critical: ${summary.critical}`);
    console.log(`  High: ${summary.high}`);
    console.log(`  Medium: ${summary.medium}`);
    console.log(`  Low: ${summary.low}`);
    console.log(`  Info: ${summary.info}`);
    console.log(`\nEstimated Win Rate Impact: ${summary.estimatedWinRateImpact.toFixed(0)}%`);
    
    console.log('\nTop Warnings:');
    warnings.slice(0, 5).forEach((warning, i) => {
      console.log(`\n${i + 1}. [${warning.severity.toUpperCase()}] ${warning.title}`);
      console.log(`   ${warning.description}`);
      console.log(`   Impact: ${warning.impact}`);
      console.log(`   Suggestions:`);
      warning.suggestions.forEach(s => console.log(`   - ${s}`));
    });
    
    // 2. Card Recommendations
    console.log('\n\n2. CARD RECOMMENDATION ENGINE');
    console.log('----------------------------');
    const recommendations = generateCardRecommendations(deck.cards, warnings);
    
    console.log(`\nImmediate Additions (${recommendations.immediate.length}):`);
    recommendations.immediate.forEach((rec, i) => {
      console.log(`\n${i + 1}. ${rec.card.name} x${rec.card.quantity} [${rec.priority.toUpperCase()}]`);
      console.log(`   Reasoning:`);
      rec.reasoning.forEach(r => console.log(`   - ${r}`));
      console.log(`   Synergies: ${rec.synergiesWith.join(', ')}`);
      console.log(`   Expected Improvement: +${rec.estimatedImprovement}%`);
    });
    
    console.log(`\n\nShort-Term Upgrades (${recommendations.shortTerm.length}):`);
    recommendations.shortTerm.slice(0, 3).forEach((rec, i) => {
      console.log(`\n${i + 1}. ${rec.card.name} x${rec.card.quantity}`);
      console.log(`   ${rec.reasoning[0]}`);
      if (rec.replaces) {
        console.log(`   Replaces: ${rec.replaces.card} x${rec.replaces.quantity}`);
      }
    });
    
    console.log(`\n\nCards to Cut (${recommendations.cuts.length}):`);
    recommendations.cuts.forEach((cut, i) => {
      console.log(`\n${i + 1}. Remove ${cut.quantity} ${cut.card}`);
      console.log(`   Reason: ${cut.reason}`);
      console.log(`   Impact: ${cut.impact}`);
    });
    
    // 3. Full Analysis with Phase 4
    console.log('\n\n3. FULL DECK ANALYSIS WITH PHASE 4');
    console.log('----------------------------------');
    const analysis = await analyzer.analyzeDeck(deck);
    
    console.log(`Overall Score: ${analysis.scores.overall}/100`);
    console.log(`\nWarnings (${analysis.warnings.length}):`);
    analysis.warnings.slice(0, 3).forEach(w => {
      console.log(`- [${w.severity.toUpperCase()}] ${w.message}`);
      if (w.suggestion) console.log(`  → ${w.suggestion}`);
    });
    
    console.log(`\nRecommendations (${analysis.recommendations.length}):`);
    analysis.recommendations.slice(0, 5).forEach(r => {
      console.log(`- [${r.type.toUpperCase()}] ${r.reason}`);
      console.log(`  → ${r.suggestion || r.impact}`);
    });
    
    // 4. Before and After Comparison
    console.log('\n\n4. TRANSFORMATION SUMMARY');
    console.log('------------------------');
    console.log('Before Phase 4:');
    console.log('- Generic warnings like "Add more draw support"');
    console.log('- Vague recommendations');
    console.log('- No severity levels or prioritization');
    console.log('- No specific card suggestions');
    
    console.log('\nAfter Phase 4:');
    console.log('- Smart warnings with severity and win rate impact');
    console.log('- Specific card recommendations with quantities');
    console.log('- Clear reasoning and expected improvements');
    console.log('- Actionable cuts to make room');
    console.log('- Prioritized by impact and implementation ease');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPhase4Analysis().catch(console.error);