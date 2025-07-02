'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AcademicCapIcon, 
  SparklesIcon,
  ChartBarIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

interface AnalysisSelectorProps {
  deckId: string;
  deckName: string;
}

export function AnalysisSelector({ deckId, deckName }: AnalysisSelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<'basic' | 'advanced' | null>(null);

  const options = [
    {
      id: 'basic' as const,
      title: 'Basic Deck Helper',
      subtitle: 'For young trainers (Ages 6-12)',
      description: 'Get simple tips to make your deck better! Learn what cards to add and why.',
      icon: SparklesIcon,
      color: 'blue',
      features: [
        '🎯 Easy to understand advice',
        '😊 Friendly explanations',
        '🌟 Fun facts about Pokemon',
        '💡 Simple card suggestions'
      ]
    },
    {
      id: 'advanced' as const,
      title: 'Advanced Deck Analyzer',
      subtitle: 'For competitive players',
      description: 'Deep analysis with meta matchups, statistical probabilities, and tournament optimization.',
      icon: ChartBarIcon,
      color: 'purple',
      features: [
        '📊 Detailed statistics',
        '🎮 Meta game analysis',
        '💰 Budget recommendations',
        '🏆 Tournament sideboards'
      ]
    }
  ];

  const handleAnalyze = () => {
    if (selected === 'basic') {
      router.push(`/decks/${deckId}/analyze/basic`);
    } else if (selected === 'advanced') {
      router.push(`/decks/${deckId}/analyze`);
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

      <div className="grid md:grid-cols-2 gap-6 mb-8">
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
                    : 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              {isSelected && (
                <div className={`absolute top-4 right-4 w-6 h-6 ${option.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'} rounded-full flex items-center justify-center`}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              <Icon className={`h-10 w-10 mb-4 ${isSelected ? (option.color === 'blue' ? 'text-blue-600' : 'text-purple-600') : 'text-gray-400'}`} />
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                {option.title}
              </h3>
              <p className={`text-sm font-medium mb-3 ${isSelected ? (option.color === 'blue' ? 'text-blue-600' : 'text-purple-600') : 'text-gray-500'}`}>
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
          {selected ? `Start ${selected === 'basic' ? 'Basic' : 'Advanced'} Analysis` : 'Select an Analysis Type'}
        </button>
      </div>
    </div>
  );
}