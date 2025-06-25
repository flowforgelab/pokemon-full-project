'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { api } from '@/utils/api';
import { 
  UserCircleIcon, 
  RectangleStackIcon, 
  ChartBarIcon, 
  CheckIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState({
    displayName: user?.firstName || '',
    experience: '',
    favoriteFormat: '',
    goals: [] as string[],
  });

  const updateUserMutation = api.user.updatePreferences.useMutation({
    onSuccess: () => {
      router.push('/dashboard');
    },
  });

  const steps = [
    {
      title: 'Welcome to Pokemon TCG Deck Builder!',
      description: "Let's get you set up in just a few steps.",
      icon: UserCircleIcon,
    },
    {
      title: 'Tell us about yourself',
      description: 'This helps us personalize your experience.',
      icon: RectangleStackIcon,
    },
    {
      title: 'Set your goals',
      description: 'What would you like to achieve?',
      icon: ChartBarIcon,
    },
  ];

  const experienceLevels = [
    { value: 'beginner', label: 'New Player', description: 'Just starting my Pokemon TCG journey' },
    { value: 'intermediate', label: 'Casual Player', description: 'Play for fun with friends' },
    { value: 'competitive', label: 'Competitive Player', description: 'Participate in tournaments' },
    { value: 'collector', label: 'Collector', description: 'Focus on collecting cards' },
  ];

  const formats = [
    { value: 'standard', label: 'Standard', description: 'Most recent sets only' },
    { value: 'expanded', label: 'Expanded', description: 'Wider card pool' },
    { value: 'unlimited', label: 'Unlimited', description: 'All cards allowed' },
    { value: 'theme', label: 'Theme Deck', description: 'Pre-constructed decks' },
  ];

  const goals = [
    { value: 'build-decks', label: 'Build competitive decks' },
    { value: 'track-collection', label: 'Track my collection' },
    { value: 'analyze-meta', label: 'Analyze the meta' },
    { value: 'trade-cards', label: 'Trade with others' },
    { value: 'learn-game', label: 'Learn the game' },
    { value: 'tournament-prep', label: 'Prepare for tournaments' },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      updateUserMutation.mutate({
        displayName: preferences.displayName,
        preferences: {
          experience: preferences.experience,
          favoriteFormat: preferences.favoriteFormat,
          goals: preferences.goals,
        },
      });
    }
  };

  const toggleGoal = (goal: string) => {
    setPreferences(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal],
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    index <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      index < currentStep
                        ? 'bg-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            {(() => {
              const Icon = steps[currentStep].icon;
              return (
                <Icon className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              );
            })()}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {steps[currentStep].title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Step 1: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-lg text-gray-700 dark:text-gray-300">
                  Welcome, {user?.firstName || 'Trainer'}! We're excited to have you here.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-blue-800 dark:text-blue-300">
                    Pokemon TCG Deck Builder helps you build winning decks, track your collection, 
                    and analyze the meta with powerful AI-driven tools.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    What should we call you?
                  </span>
                  <input
                    type="text"
                    value={preferences.displayName}
                    onChange={(e) => setPreferences({ ...preferences, displayName: e.target.value })}
                    className="mt-1 block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your display name"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Experience & Format */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  What's your experience level?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {experienceLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setPreferences({ ...preferences, experience: level.value })}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        preferences.experience === level.value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{level.label}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {level.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  What's your favorite format?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formats.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => setPreferences({ ...preferences, favoriteFormat: format.value })}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        preferences.favoriteFormat === format.value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{format.label}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {format.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Goals */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  What are your goals? (Select all that apply)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {goals.map((goal) => (
                    <button
                      key={goal.value}
                      onClick={() => toggleGoal(goal.value)}
                      className={`p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                        preferences.goals.includes(goal.value)
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        preferences.goals.includes(goal.value)
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {preferences.goals.includes(goal.value) && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-gray-900 dark:text-white">{goal.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                currentStep === 0
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Back
            </button>
            
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 0 && !preferences.displayName) ||
                (currentStep === 1 && (!preferences.experience || !preferences.favoriteFormat)) ||
                (currentStep === 2 && preferences.goals.length === 0) ||
                updateUserMutation.isLoading
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? (
                updateUserMutation.isLoading ? 'Starting...' : 'Get Started'
              ) : (
                <>
                  Next
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Skip Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}