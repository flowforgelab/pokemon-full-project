/**
 * Export AI analysis results to markdown format
 */

import type { AIAnalysisResult } from '@/lib/api/types';

export function exportAnalysisToMarkdown(
  analysis: AIAnalysisResult,
  deckName: string,
  deckFormat: string,
  userAge?: number
): string {
  const date = new Date().toLocaleDateString();
  const ageMode = userAge ? getAgeMode(userAge) : null;
  
  let markdown = `# AI Deck Analysis: ${deckName}\n\n`;
  markdown += `**Date:** ${date}  \n`;
  markdown += `**Format:** ${deckFormat}  \n`;
  if (ageMode) {
    markdown += `**Analysis Mode:** ${ageMode}  \n`;
  }
  markdown += `\n---\n\n`;
  
  // Overall Score
  markdown += `## Overall Score: ${analysis.overallRating}/100\n\n`;
  markdown += `**Tier Rating:** ${analysis.tierRating}\n\n`;
  
  // Executive Summary
  markdown += `## Executive Summary\n\n`;
  markdown += `${analysis.executiveSummary}\n\n`;
  
  // Strengths
  markdown += `## Strengths\n\n`;
  analysis.strengths.forEach(strength => {
    markdown += `### ${strength.title} (${strength.impact} impact)\n`;
    markdown += `${strength.description}\n\n`;
  });
  
  // Weaknesses
  markdown += `## Weaknesses\n\n`;
  analysis.weaknesses.forEach(weakness => {
    markdown += `### ${weakness.title} (${weakness.severity})\n`;
    markdown += `${weakness.description}\n\n`;
    markdown += `**💡 Suggestion:** ${weakness.suggestion}\n\n`;
  });
  
  // Improvements
  if (analysis.improvements && analysis.improvements.length > 0) {
    markdown += `## Recommended Improvements\n\n`;
    analysis.improvements.forEach((improvement, idx) => {
      const priorityEmoji = improvement.priority === 'immediate' ? '🔴' : improvement.priority === 'short-term' ? '🟡' : '🟢';
      markdown += `### ${priorityEmoji} Improvement ${idx + 1}: ${improvement.suggestion.split('.')[0]}\n`;
      markdown += `${improvement.suggestion}\n\n`;
      
      if (improvement.cardChanges) {
        const removes = improvement.cardChanges.remove || [];
        const adds = improvement.cardChanges.add || [];
        
        if (removes.length > 0 || adds.length > 0) {
          markdown += `**Card Changes:**\n`;
          
          // Ensure 1:1 matching by pairing removes and adds
          const maxLength = Math.max(removes.length, adds.length);
          for (let i = 0; i < maxLength; i++) {
            if (i < removes.length) {
              markdown += `- Remove: ${removes[i].quantity}x ${removes[i].card}\n`;
              if (i < adds.length) {
                markdown += `  Replace with: ${adds[i].quantity}x ${adds[i].card}\n`;
                markdown += `  Reason: ${removes[i].reason || adds[i].reason || 'Improve deck consistency'}\n\n`;
              }
            } else if (i < adds.length) {
              markdown += `- Add: ${adds[i].quantity}x ${adds[i].card}\n`;
              markdown += `  Reason: ${adds[i].reason || 'Improve deck consistency'}\n\n`;
            }
          }
          
          if (improvement.expectedImpact) {
            markdown += `**Expected Impact:** ${improvement.expectedImpact}\n\n`;
          }
        }
      }
    });
  }
  
  // Play Style Notes
  markdown += `## Play Style Guide\n\n`;
  markdown += `**Difficulty:** ${analysis.playStyleNotes.difficulty}\n\n`;
  
  if (analysis.playStyleNotes.keyPlays.length > 0) {
    markdown += `### Key Plays\n`;
    analysis.playStyleNotes.keyPlays.forEach(play => {
      markdown += `- ${play}\n`;
    });
    markdown += `\n`;
  }
  
  if (analysis.playStyleNotes.mulliganStrategy) {
    markdown += `### Mulligan Strategy\n`;
    markdown += `${analysis.playStyleNotes.mulliganStrategy}\n\n`;
  }
  
  if (analysis.playStyleNotes.commonMistakes.length > 0) {
    markdown += `### Common Mistakes to Avoid\n`;
    analysis.playStyleNotes.commonMistakes.forEach(mistake => {
      markdown += `- ${mistake}\n`;
    });
    markdown += `\n`;
  }
  
  // Synergy Analysis
  markdown += `## Synergy Analysis (${analysis.synergyAnalysis.rating}/100)\n\n`;
  
  if (analysis.synergyAnalysis.combos.length > 0) {
    markdown += `### Key Combos\n`;
    analysis.synergyAnalysis.combos.forEach(combo => {
      markdown += `- **${combo.cards.join(' + ')}**: ${combo.description}\n`;
    });
    markdown += `\n`;
  }
  
  if (analysis.synergyAnalysis.antiSynergies.length > 0) {
    markdown += `### Anti-Synergies\n`;
    analysis.synergyAnalysis.antiSynergies.forEach(anti => {
      markdown += `- **${anti.cards.join(' vs ')}**: ${anti.issue}\n`;
    });
    markdown += `\n`;
  }
  
  // Matchup Analysis
  if (analysis.matchupAnalysis && analysis.matchupAnalysis.length > 0) {
    markdown += `## Matchup Analysis\n\n`;
    analysis.matchupAnalysis.forEach(matchup => {
      const winRate = matchup.winRate || 50;
      const emoji = winRate >= 60 ? '✅' : winRate <= 40 ? '❌' : '⚖️';
      markdown += `### ${emoji} vs ${matchup.opponent} (${winRate}% win rate)\n`;
      if (matchup.keyFactors && matchup.keyFactors.length > 0) {
        markdown += `**Key Factors:**\n`;
        matchup.keyFactors.forEach(factor => {
          markdown += `- ${factor}\n`;
        });
      }
      if (matchup.techCards && matchup.techCards.length > 0) {
        markdown += `\n**Tech Cards to Consider:**\n`;
        matchup.techCards.forEach(tech => {
          markdown += `- ${tech}\n`;
        });
      }
      markdown += `\n`;
    });
  }
  
  // Format Positioning
  markdown += `## Meta Game Position\n\n`;
  markdown += `**Relevance:** ${analysis.formatPositioning.metaRelevance}\n\n`;
  
  if (analysis.formatPositioning.currentTrends.length > 0) {
    markdown += `### Current Trends\n`;
    analysis.formatPositioning.currentTrends.forEach(trend => {
      markdown += `- ${trend}\n`;
    });
    markdown += `\n`;
  }
  
  if (analysis.formatPositioning.futureOutlook) {
    markdown += `### Future Outlook\n`;
    markdown += `${analysis.formatPositioning.futureOutlook}\n\n`;
  }
  
  // Footer
  markdown += `---\n\n`;
  markdown += `*Generated by Pokemon TCG Deck Builder AI Analysis*  \n`;
  markdown += `*Powered by GPT-4*\n`;
  
  return markdown;
}

function getAgeMode(age: number): string {
  if (age < 10) return '🌟 Young Trainer Mode';
  if (age < 13) return '✨ Junior Trainer Mode';
  if (age < 18) return '🎯 Teen Trainer Mode';
  return '🏆 Master Trainer Mode';
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}