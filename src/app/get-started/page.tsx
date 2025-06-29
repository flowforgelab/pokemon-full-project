'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { SignInButton } from '@clerk/nextjs';
import { 
  UserCircleIcon, 
  RectangleStackIcon, 
  ChartBarIcon,
  RocketLaunchIcon,
  CheckIcon,
  StarIcon
} from '@heroicons/react/24/outline';

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Pokemon TCG Deck Builder
              </h1>
            </Link>
          </nav>
        </div>
      </header>
      
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 73px)' }}>
        <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <RocketLaunchIcon className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Start Your Journey
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Join thousands of trainers building competitive decks, tracking collections, and mastering the
            Pokemon TCG.
          </p>
        </motion.div>

        {/* Features List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8"
        >
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <RectangleStackIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Build Competitive Decks</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create and analyze decks with our advanced deck builder and AI-powered suggestions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Track Your Collection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage your cards, monitor prices, and get alerts when values change.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <UserCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Join the Community</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect with other trainers, share decks, and participate in tournaments.
                </p>
              </div>
            </div>
          </div>

          {/* Sign Up / Sign In Options */}
          <div className="border-t pt-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Choose How to Continue
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* New User */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-transparent hover:border-blue-500 transition-all"
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  I'm New Here
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your free account and start building your first deck in minutes.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    Free tier with 3 decks
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    Basic deck analysis
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    Collection tracking
                  </li>
                </ul>
                <Link
                  href="/sign-up"
                  className="block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 text-center font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Create Free Account
                </Link>
              </motion.div>

              {/* Existing User */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Already Have an Account?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Welcome back! Sign in to access your decks and continue where you left off.
                </p>
                <div className="mb-6">
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Sign in with your existing account using:
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-3 py-1 bg-white dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">Email</span>
                    <span className="px-3 py-1 bg-white dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">Google</span>
                    <span className="px-3 py-1 bg-white dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">Discord</span>
                  </div>
                </div>
                <SignInButton mode="modal">
                  <button className="w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 font-medium">
                    Sign In
                  </button>
                </SignInButton>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Free to Start Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full">
            <StarIcon className="w-5 h-5" />
            <span className="font-medium">Free to Start</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Begin with our free tier and upgrade anytime for advanced features and unlimited access.
          </p>
        </motion.div>

        {/* Terms and Privacy */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-500">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            Privacy Policy
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}