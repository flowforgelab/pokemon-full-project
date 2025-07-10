'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AcademicCapIcon, 
  SparklesIcon,
  ChartBarIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import { Brain } from 'lucide-react';

interface AnalysisSelectorProps {
  deckId: string;
  deckName: string;
}

export function AnalysisSelector({ deckId, deckName }: AnalysisSelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<'basic' | 'advanced' | 'ai' | null>(null);

  // Since we only have AI analysis, automatically redirect
  useEffect(() => {
    router.push(`/decks/${deckId}/analyze/ai`);
  }, [deckId, router]);

  const options = [
    {
      id: 'ai' as const,
      title: 'AI Expert Analysis',
      subtitle: 'Powered by GPT-4 (Free for now!)',
      description: 'Get nuanced insights from an AI trained on competitive Pokemon TCG knowledge. Provides conversational analysis beyond rule-based systems. Currently available to all users!',
      icon: Brain,
      color: 'green',
      features: [
        '🤖 Advanced AI insights',
        '💬 Conversational analysis',
        '🎯 Custom focus areas',
        '📈 Adaptive recommendations'
      ],
      requiresSubscription: false,
      badge: 'FREE'
    }
  ];

  const handleAnalyze = () => {
    if (selected === 'basic') {
      router.push(`/decks/${deckId}/analyze/basic`);
    } else if (selected === 'advanced') {
      router.push(`/decks/${deckId}/analyze`);
    } else if (selected === 'ai') {
      router.push(`/decks/${deckId}/analyze/ai`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <BeakerIcon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Choose Your Analysis Type
        </h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Analyzing: {deckName}
        </p>
      </div>

      <div className="max-w-md mx-auto mb-8">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selected === option.id;
          
          return (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`
                relative p-6 rounded-xl border-2 transition-all text-left
                ${isSelected 
                  ? option.color === 'blue' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : option.color === 'purple'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              {isSelected && (
                <div className={`absolute top-4 right-4 w-6 h-6 ${option.color === 'blue' ? 'bg-blue-500' : option.color === 'purple' ? 'bg-purple-500' : 'bg-green-500'} rounded-full flex items-center justify-center`}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <Icon className={`h-10 w-10 ${isSelected ? (option.color === 'blue' ? 'text-blue-600' : option.color === 'purple' ? 'text-purple-600' : 'text-green-600') : 'text-gray-400'}`} />
                {option.badge && (
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    option.badge === 'FREE' 
                      ? 'text-blue-700 bg-blue-100' 
                      : 'text-green-700 bg-green-100'
                  }`}>
                    {option.badge}
                  </span>
                )}
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                {option.title}
              </h3>
              <p className={`text-sm font-medium mb-3 ${isSelected ? (option.color === 'blue' ? 'text-blue-600' : option.color === 'purple' ? 'text-purple-600' : 'text-green-600') : 'text-gray-500'}`}>
                {option.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {option.description}
              </p>

              <div className="space-y-2">
                {option.features.map((feature, idx) => (
                  <p key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                    {feature}
                  </p>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleAnalyze}
          disabled={!selected}
          className={`
            px-8 py-3 rounded-lg font-medium text-white transition-all
            ${selected 
              ? 'bg-blue-600 hover:bg-blue-700 shadow-lg transform hover:scale-105' 
              : 'bg-gray-400 cursor-not-allowed'
            }
          `}
        >
          {selected ? `Start ${selected === 'basic' ? 'Basic' : selected === 'advanced' ? 'Advanced' : 'AI'} Analysis` : 'Select an Analysis Type'}
        </button>
      </div>
    </div>
  );
}