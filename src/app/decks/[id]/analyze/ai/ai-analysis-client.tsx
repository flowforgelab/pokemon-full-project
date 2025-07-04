/**
 * AI Analysis Client Component
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PremiumCard } from '@/components/ui';
import { Button } from '@/components/ui';
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Target,
  DollarSign,
  Gamepad2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Info
} from 'lucide-react';
import type { AIDeckAnalysis } from '@/lib/analysis/ai-deck-analyzer';
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

  const focusAreaOptions = [
    { id: 'competitive', label: 'Competitive Play', icon: Target },
    { id: 'budget', label: 'Budget Options', icon: DollarSign },
    { id: 'beginner', label: 'Beginner Friendly', icon: Gamepad2 },
    { id: 'synergy', label: 'Card Synergies', icon: Sparkles },
    { id: 'matchups', label: 'Matchup Analysis', icon: TrendingUp }
  ];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisStatus('Preparing your deck data...');

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout

    try {
      setAnalysisStatus('Sending to AI assistant...');
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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setAnalysisStatus('AI is analyzing your deck...');

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(data.error || `Analysis failed with status ${response.status}`);
      }

      const data = await response.json();
      setAnalysisStatus('Analysis complete!');
      setAnalysis(data.analysis);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Analysis is taking longer than expected. Please try again or select fewer focus areas.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsAnalyzing(false);
      clearTimeout(timeoutId);
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

      {!analysis ? (
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
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                    <option value="gpt-4">GPT-4 (Balanced)</option>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo (Best)</option>
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
      ) : (
        /* Analysis Results */
        <div className="space-y-6">
          {/* Overall Rating */}
          <PremiumCard>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Overall Analysis</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {analysis.executiveSummary}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">{analysis.overallRating}/100</div>
                  <span className={cn("inline-block text-lg px-3 py-1 rounded-full font-semibold", tierColors[analysis.tierRating])}>
                    Tier {analysis.tierRating}
                  </span>
                </div>
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
                      
                      {improvement.cardChanges.remove && improvement.cardChanges.remove.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-red-600 mb-1">Remove:</p>
                          <ul className="text-sm text-gray-600 dark:text-gray-400">
                            {improvement.cardChanges.remove.map((card, i) => (
                              <li key={i}>- {card.quantity}x {card.card}: {card.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {improvement.cardChanges.add && improvement.cardChanges.add.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-green-600 mb-1">Add:</p>
                          <ul className="text-sm text-gray-600 dark:text-gray-400">
                            {improvement.cardChanges.add.map((card, i) => (
                              <li key={i}>+ {card.quantity}x {card.card}: {card.reason}</li>
                            ))}
                          </ul>
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
          <div className="flex gap-4">
            <Button
              onClick={() => setAnalysis(null)}
              variant="outline"
            >
              Run Another Analysis
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