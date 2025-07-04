/**
 * AI Analysis Client Component
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PremiumCard } from '@/components/ui';
import { Button } from '@/components/ui';
import { 
  Brain, 
  Sparkles, 
  TrendingUp,
  Target,
  DollarSign,
  Gamepad2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info,
  Download
} from 'lucide-react';
import type { AIDeckAnalysis } from '@/lib/analysis/ai-deck-analyzer';
import { AnalysisStatus } from '@/components/analysis/AnalysisStatus';
import { exportAnalysisToMarkdown, downloadMarkdown } from '@/lib/utils/export-analysis';
// Badge component inline since it doesn't exist in UI library
import { cn } from '@/lib/utils';

interface AIAnalysisClientProps {
  deck: any; // Full deck with cards
  userTier: string;
}

export function AIAnalysisClient({ deck, userTier }: AIAnalysisClientProps) {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIDeckAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [userAge, setUserAge] = useState<string>('');
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const currentJobId = useRef<string | null>(null);

  const focusAreaOptions = [
    { id: 'competitive', label: 'Competitive Play', icon: Target },
    { id: 'budget', label: 'Budget Options', icon: DollarSign },
    { id: 'beginner', label: 'Beginner Friendly', icon: Gamepad2 },
    { id: 'synergy', label: 'Card Synergies', icon: Sparkles },
    { id: 'matchups', label: 'Matchup Analysis', icon: TrendingUp }
  ];

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Check for jobId or analysisId in URL params on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const jobIdParam = searchParams.get('jobId');
    const analysisIdParam = searchParams.get('analysisId');
    
    if (jobIdParam) {
      console.log('Found jobId in URL:', jobIdParam);
      currentJobId.current = jobIdParam;
      setIsAnalyzing(true);
      
      // Start polling for this job
      checkAnalysisStatus(jobIdParam);
      pollingInterval.current = setInterval(() => {
        checkAnalysisStatus(jobIdParam);
      }, 2000);
    } else if (analysisIdParam) {
      console.log('Found analysisId in URL:', analysisIdParam);
      // Load completed analysis directly
      loadCompletedAnalysis(analysisIdParam);
    }
  }, []);

  const loadCompletedAnalysis = async (analysisId: string) => {
    try {
      const response = await fetch(`/api/analysis/ai/result/${analysisId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load analysis');
      }

      const data = await response.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        setAnalysisStatus('Analysis loaded');
      }
    } catch (err) {
      console.error('Failed to load analysis:', err);
      setError('Failed to load previous analysis');
    }
  };

  const checkAnalysisStatus = async (jobId: string) => {
    try {
      console.log('Checking analysis status for job:', jobId);
      const response = await fetch(`/api/analysis/ai/status/${jobId}`);
      
      if (!response.ok) {
        console.error('Status check failed:', response.status, response.statusText);
        throw new Error('Failed to check status');
      }

      const data = await response.json();
      console.log('Status response:', data);
      
      if (data.status === 'COMPLETED') {
        // Stop polling
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        
        // Set the analysis result
        setAnalysis(data.result);
        setIsAnalyzing(false);
        setAnalysisStatus('Analysis complete!');
      } else if (data.status === 'FAILED') {
        // Stop polling on failure
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        
        setError(data.error || 'Analysis failed');
        setIsAnalyzing(false);
      } else {
        // Update status message
        if (data.status === 'PROCESSING') {
          setAnalysisStatus('AI is analyzing your deck...');
        } else {
          setAnalysisStatus('Analysis queued, waiting to start...');
        }
      }
    } catch (err) {
      console.error('Status check error:', err);
      // Don't stop polling on transient errors
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisStatus('Preparing your deck data...');
    setAnalysis(null);
    currentJobId.current = null;

    try {
      setAnalysisStatus('Queueing analysis...');
      const response = await fetch('/api/analysis/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId: deck.id,
          options: {
            model: selectedModel,
            temperature: 0.3, // Lower temperature for more consistent results
            focusAreas: selectedFocusAreas,
            userAge: userAge ? parseInt(userAge) : undefined
          }
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(data.error || `Analysis failed with status ${response.status}`);
      }

      const data = await response.json();
      currentJobId.current = data.jobId;
      setAnalysisStatus('Analysis queued successfully!');

      // Start polling for status
      pollingInterval.current = setInterval(() => {
        checkAnalysisStatus(data.jobId);
      }, 2000); // Poll every 2 seconds

      // Initial status check
      checkAnalysisStatus(data.jobId);
      
    } catch (err) {
      setIsAnalyzing(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  const tierColors = {
    'S': 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    'A': 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    'B': 'text-green-600 bg-green-50 dark:bg-green-900/20',
    'C': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    'D': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    'F': 'text-red-600 bg-red-50 dark:bg-red-900/20'
  };

  const impactColors = {
    'high': 'text-green-600',
    'medium': 'text-yellow-600',
    'low': 'text-gray-600'
  };

  const severityColors = {
    'critical': 'text-red-600',
    'major': 'text-orange-600',
    'minor': 'text-yellow-600'
  };

  const handleDownloadAnalysis = () => {
    if (!analysis) return;
    
    const markdown = exportAnalysisToMarkdown(
      analysis,
      deck.name,
      deck.format || 'STANDARD',
      userAge ? parseInt(userAge) : undefined
    );
    
    const filename = `${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_analysis_${new Date().toISOString().split('T')[0]}.md`;
    downloadMarkdown(markdown, filename);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold">AI Deck Analysis</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Get expert insights powered by advanced AI to optimize your deck's performance
        </p>
      </div>

      {!analysis && !isAnalyzing ? (
        /* Configuration Section */
        <div className="grid gap-6 md:grid-cols-2">
          <PremiumCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Options</h2>
              
              {/* Age Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Your Age (Optional)
                  <span className="text-xs text-gray-500 ml-2">For age-appropriate analysis</span>
                </label>
                <input
                  type="number"
                  min="5"
                  max="99"
                  value={userAge}
                  onChange={(e) => setUserAge(e.target.value)}
                  placeholder="Enter your age"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
                />
                {userAge && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {parseInt(userAge) < 10 && '🌟 Analysis will use very simple language with fun explanations!'}
                    {parseInt(userAge) >= 10 && parseInt(userAge) < 13 && '✨ Analysis will be kid-friendly and educational!'}
                    {parseInt(userAge) >= 13 && parseInt(userAge) < 18 && '🎯 Analysis will balance strategy tips with clear explanations!'}
                    {parseInt(userAge) >= 18 && '🏆 Analysis will include advanced competitive insights!'}
                  </p>
                )}
              </div>
              
              {/* Model Selection (Ultimate tier only) */}
              {userTier === 'ULTIMATE' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">AI Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast, Reliable)</option>
                    <option value="gpt-4">GPT-4 (Detailed)</option>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo (Best Quality)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                  </select>
                </div>
              )}

              {/* Focus Areas */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Focus Areas</label>
                <div className="space-y-2">
                  {focusAreaOptions.map(option => {
                    const Icon = option.icon;
                    const isSelected = selectedFocusAreas.includes(option.id);
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedFocusAreas(prev => prev.filter(id => id !== option.id));
                          } else {
                            setSelectedFocusAreas(prev => [...prev, option.id]);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                          isSelected
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", isSelected ? "text-purple-600" : "text-gray-500")} />
                        <span className={cn("flex-1 text-left", isSelected && "font-medium")}>
                          {option.label}
                        </span>
                        {isSelected && <CheckCircle className="w-5 h-5 text-purple-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {analysisStatus || 'Analyzing Deck...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Start AI Analysis
                  </>
                )}
              </Button>

              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          </PremiumCard>

          {/* Deck Summary */}
          <PremiumCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Deck Summary</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Deck Name</span>
                  <p className="font-medium">{deck.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Format</span>
                  <p className="font-medium">{deck.format}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Cards</span>
                  <p className="font-medium">
                    {deck.cards.reduce((sum: number, dc: any) => sum + dc.quantity, 0)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Pokemon / Trainers / Energy</span>
                  <p className="font-medium">
                    {deck.cards.filter((dc: any) => dc.card.supertype === 'POKEMON').reduce((sum: number, dc: any) => sum + dc.quantity, 0)} / 
                    {deck.cards.filter((dc: any) => dc.card.supertype === 'TRAINER').reduce((sum: number, dc: any) => sum + dc.quantity, 0)} / 
                    {deck.cards.filter((dc: any) => dc.card.supertype === 'ENERGY').reduce((sum: number, dc: any) => sum + dc.quantity, 0)}
                  </p>
                </div>
                {userAge && (
                  <div>
                    <span className="text-sm text-gray-500">Analysis Mode</span>
                    <p className="font-medium">
                      {parseInt(userAge) < 10 && '🌟 Young Trainer Mode'}
                      {parseInt(userAge) >= 10 && parseInt(userAge) < 13 && '✨ Junior Trainer Mode'}
                      {parseInt(userAge) >= 13 && parseInt(userAge) < 18 && '🎯 Teen Trainer Mode'}
                      {parseInt(userAge) >= 18 && '🏆 Master Trainer Mode'}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex gap-2 text-blue-600">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Pro Tip</p>
                    <p>Select focus areas to get more detailed insights on specific aspects of your deck.</p>
                  </div>
                </div>
              </div>
            </div>
          </PremiumCard>
        </div>
      ) : isAnalyzing ? (
        /* Analysis in Progress */
        <div className="space-y-4">
          <PremiumCard>
            <AnalysisStatus status={analysisStatus} error={error} />
          </PremiumCard>
          
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => router.push('/analysis/history')}
              variant="outline"
            >
              View Analysis History
            </Button>
            <Button
              onClick={() => {
                if (pollingInterval.current) {
                  clearInterval(pollingInterval.current);
                }
                setIsAnalyzing(false);
                setAnalysisStatus('');
              }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        /* Analysis Results */
        <div className="space-y-6">
          {/* Overall Rating */}
          <PremiumCard>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">Overall Analysis</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {analysis.executiveSummary}
                  </p>
                </div>
                <div className="text-center ml-6">
                  <div className="text-4xl font-bold mb-2">{analysis.overallRating}/100</div>
                  <span className={cn("inline-block text-lg px-3 py-1 rounded-full font-semibold", tierColors[analysis.tierRating])}>
                    Tier {analysis.tierRating}
                  </span>
                </div>
              </div>
              
              {/* Download Button */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleDownloadAnalysis}
                  variant="outline"
                  className="w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Analysis Report
                </Button>
              </div>
            </div>
          </PremiumCard>

          {/* Strengths & Weaknesses */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Strengths */}
            <PremiumCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Strengths
                </h3>
                <div className="space-y-3">
                  {analysis.strengths.map((strength, idx) => (
                    <div key={idx} className="border-l-2 border-green-500 pl-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium">{strength.title}</h4>
                        <span className={cn("text-sm", impactColors[strength.impact])}>
                          {strength.impact} impact
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {strength.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </PremiumCard>

            {/* Weaknesses */}
            <PremiumCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Weaknesses
                </h3>
                <div className="space-y-3">
                  {analysis.weaknesses.map((weakness, idx) => (
                    <div key={idx} className="border-l-2 border-red-500 pl-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium">{weakness.title}</h4>
                        <span className={cn("text-sm", severityColors[weakness.severity])}>
                          {weakness.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {weakness.description}
                      </p>
                      <p className="text-sm font-medium text-blue-600">
                        💡 {weakness.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </PremiumCard>
          </div>

          {/* Improvements */}
          {analysis.improvements.length > 0 && (
            <PremiumCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recommended Improvements</h3>
                <div className="space-y-4">
                  {analysis.improvements.map((improvement, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "inline-block px-2 py-1 text-xs font-semibold rounded-full",
                          improvement.priority === 'immediate' 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        )}>
                          {improvement.priority}
                        </span>
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-600">
                          {improvement.category}
                        </span>
                      </div>
                      <p className="font-medium mb-2">{improvement.suggestion}</p>
                      
                      {(improvement.cardChanges.remove || improvement.cardChanges.add) && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Card Replacements:</p>
                          <div className="space-y-2">
                            {(() => {
                              const removes = improvement.cardChanges.remove || [];
                              const adds = improvement.cardChanges.add || [];
                              const maxLength = Math.max(removes.length, adds.length);
                              
                              return Array.from({ length: maxLength }, (_, i) => {
                                const removeCard = removes[i];
                                const addCard = adds[i];
                                
                                if (removeCard && addCard) {
                                  // Paired replacement
                                  return (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                      <span className="text-red-600">- {removeCard.quantity}x {removeCard.card}</span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-600">+ {addCard.quantity}x {addCard.card}</span>
                                    </div>
                                  );
                                } else if (removeCard) {
                                  // Only removal (shouldn't happen with proper 1:1)
                                  return (
                                    <div key={i} className="text-sm text-red-600">
                                      - {removeCard.quantity}x {removeCard.card}
                                    </div>
                                  );
                                } else if (addCard) {
                                  // Only addition (shouldn't happen with proper 1:1)
                                  return (
                                    <div key={i} className="text-sm text-green-600">
                                      + {addCard.quantity}x {addCard.card}
                                    </div>
                                  );
                                }
                                return null;
                              });
                            })()}
                          </div>
                          {/* Show reasons if available */}
                          {(improvement.cardChanges.remove?.[0]?.reason || improvement.cardChanges.add?.[0]?.reason) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                              {improvement.cardChanges.remove?.[0]?.reason || improvement.cardChanges.add?.[0]?.reason}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-500 mt-2">
                        <strong>Expected Impact:</strong> {improvement.expectedImpact}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </PremiumCard>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => setAnalysis(null)}
              variant="outline"
            >
              Run Another Analysis
            </Button>
            <Button
              onClick={handleDownloadAnalysis}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Report
            </Button>
            <Button
              onClick={() => router.push(`/decks/${deck.id}/analyze`)}
              variant="outline"
            >
              Compare Analysis Types
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}