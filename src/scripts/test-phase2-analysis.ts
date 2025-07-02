import { PrismaClient } from '@prisma/client';
import { SafeAnalyzer } from '../lib/analysis/safe-analyzer';
import { analyzeMetaPosition } from '../lib/analysis/meta-context';
import { getMatchupTable } from '../lib/analysis/matchup-predictor';
import { buildSynergyGraph, getSynergyRecommendations } from '../lib/analysis/synergy-graph';

const prisma = new PrismaClient();
const analyzer = new SafeAnalyzer();

async function testPhase2Analysis() {
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
    console.log('PHASE 2 ANALYSIS TEST:', deck.name);
    console.log('========================================\n');
    
    // 1. Meta Context Analysis
    console.log('1. META GAME CONTEXT ANALYSIS');
    console.log('------------------------------');
    const metaAnalysis = analyzeMetaPosition(deck.cards);
    console.log(`Meta Rating: ${metaAnalysis.metaRating}/100`);
    console.log(`Speed Rating: ${metaAnalysis.speedRating}`);
    console.log('\nMeta Recommendations:');
    metaAnalysis.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
    // 2. Matchup Predictions
    console.log('\n\n2. MATCHUP PREDICTIONS');
    console.log('----------------------');
    const matchups = getMatchupTable(deck.cards);
    console.log('Top 5 Matchups:');
    matchups.slice(0, 5).forEach(matchup => {
      const icon = matchup.winRate >= 55 ? '✓' : 
                   matchup.winRate <= 45 ? '✗' : '—';
      console.log(`\n${icon} vs ${matchup.opponentDeck}: ${matchup.winRate}% (${matchup.favorability})`);
      console.log(`  Gameplan: ${matchup.gameplan}`);
      if (matchup.criticalCards.length > 0) {
        console.log(`  Critical Cards: ${matchup.criticalCards.join(', ')}`);
      }
    });
    
    // 3. Synergy Graph
    console.log('\n\n3. CARD SYNERGY ANALYSIS');
    console.log('------------------------');
    const synergyGraph = buildSynergyGraph(deck.cards);
    console.log(`Overall Synergy Score: ${synergyGraph.synergyScore}/100`);
    console.log(`\nCore Engine Cards: ${synergyGraph.coreEngine.join(', ')}`);
    
    console.log('\nCard Clusters:');
    synergyGraph.clusters.forEach(cluster => {
      console.log(`\n${cluster.name} (Importance: ${cluster.importance}):`);
      console.log(`  Cards: ${cluster.cards.join(', ')}`);
      console.log(`  Purpose: ${cluster.purpose}`);
    });
    
    console.log('\nTop Synergies:');
    synergyGraph.edges
      .filter(edge => edge.strength >= 70)
      .slice(0, 5)
      .forEach(edge => {
        const arrow = edge.bidirectional ? '↔' : '→';
        console.log(`  ${edge.source} ${arrow} ${edge.target} (${edge.strength}): ${edge.description}`);
      });
    
    const synergyRecs = getSynergyRecommendations(synergyGraph);
    if (synergyRecs.length > 0) {
      console.log('\nSynergy Recommendations:');
      synergyRecs.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
    
    // 4. Run full analysis with Phase 2 improvements
    console.log('\n\n4. FULL DECK ANALYSIS WITH PHASE 2');
    console.log('----------------------------------');
    const analysis = await analyzer.analyzeDeck(deck);
    
    console.log(`Overall Score: ${analysis.scores.overall}/100`);
    console.log(`Meta Relevance: ${analysis.scores.metaRelevance}/100`);
    console.log(`Innovation (Synergy): ${analysis.scores.innovation}/100`);
    console.log(`Meta Position: ${analysis.meta.metaPosition}`);
    
    console.log('\nMeta Weaknesses:');
    analysis.meta.weaknesses.forEach(w => console.log(`- ${w}`));
    
    console.log('\nTech Recommendations:');
    analysis.meta.techRecommendations.forEach(tech => {
      console.log(`- ${tech.card}: ${tech.reason}`);
      console.log(`  Impact: ${tech.impact}`);
    });
    
    console.log('\nPopular Matchup Summary:');
    analysis.meta.popularMatchups.forEach(m => {
      const icon = m.winRate >= 55 ? '✓' : m.winRate <= 45 ? '✗' : '—';
      console.log(`${icon} vs ${m.deckName}: ${m.winRate}% (${m.favorability})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPhase2Analysis().catch(console.error);