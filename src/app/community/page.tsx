'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import Link from 'next/link';
import { 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon,
  TrophyIcon,
  BookOpenIcon,
  CalendarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

export default function CommunityPage() {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Community', href: '/community' },
  ];

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Forums',
      description: 'Discuss strategies, share deck ideas, and get advice from experienced players.',
      link: '#',
      linkText: 'Join Discussion',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: TrophyIcon,
      title: 'Tournaments',
      description: 'Participate in weekly tournaments and compete for prizes and glory.',
      link: '#',
      linkText: 'View Tournaments',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: BookOpenIcon,
      title: 'Deck Guides',
      description: 'Learn from detailed guides written by top players and content creators.',
      link: '#',
      linkText: 'Browse Guides',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: UserGroupIcon,
      title: 'Trading Hub',
      description: 'Find trading partners, complete your collection, and make fair deals.',
      link: '#',
      linkText: 'Start Trading',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: CalendarIcon,
      title: 'Events',
      description: 'Stay updated on local and online Pokemon TCG events near you.',
      link: '#',
      linkText: 'View Events',
      color: 'from-pink-500 to-pink-600',
    },
    {
      icon: SparklesIcon,
      title: 'Featured Decks',
      description: 'Explore tournament-winning decks and innovative strategies.',
      link: '/decks',
      linkText: 'Explore Decks',
      color: 'from-indigo-500 to-indigo-600',
    },
  ];

  const stats = [
    { label: 'Active Members', value: '10,234' },
    { label: 'Deck Guides', value: '456' },
    { label: 'Forum Posts', value: '28.5K' },
    { label: 'Trades Completed', value: '3,847' },
  ];

  return (
    <MainLayout title="Community" breadcrumbs={breadcrumbs}>
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 mb-8 text-white">
          <h1 className="text-4xl font-bold mb-4">Join the Pokemon TCG Community</h1>
          <p className="text-xl opacity-90 mb-6 max-w-3xl">
            Connect with thousands of players, share strategies, trade cards, and participate in tournaments. 
            Our community is here to help you become a better player.
          </p>
          
          {/* Community Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm opacity-75 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {feature.description}
                </p>
                <Link
                  href={feature.link}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
                >
                  {feature.linkText}
                  <span className="text-sm">→</span>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Recent Activity Section */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Recent Community Activity</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-semibold">Alex Chen</span> posted a new guide: 
                  <span className="text-blue-600 dark:text-blue-400"> "Mastering Lugia VSTAR in the Current Meta"</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">2 hours ago</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <TrophyIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-semibold">Tournament Alert:</span> Regional Championship Qualifier starts in 3 days
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">5 hours ago</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-semibold">Sarah Martinez</span> is looking to trade: 
                  <span className="text-green-600 dark:text-green-400"> Charizard ex for Pikachu ex</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Yesterday</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
              View All Activity →
            </button>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Join Our Community?</h2>
          <p className="text-lg opacity-90 mb-6 max-w-2xl mx-auto">
            Start connecting with players, sharing your decks, and improving your game today.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/sign-up"
              className="px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 font-medium transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/decks"
              className="px-6 py-3 bg-white/20 text-white rounded-lg hover:bg-white/30 font-medium transition-colors backdrop-blur-sm"
            >
              Browse Decks
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}