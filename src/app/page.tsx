'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRightIcon, StarIcon, CheckIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { ThemeToggle } from '@/components/providers/ThemeProvider';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Background Pattern */}
      <BackgroundPattern variant="pokeball" opacity={0.03} />
      
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg backdrop-saturate-150 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Pokemon TCG Deck Builder
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/cards" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Cards
              </Link>
              <Link href="/decks" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Discover
              </Link>
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Pricing
              </Link>
              <ThemeToggle />
              <div className="flex items-center gap-4">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                      Sign In
                    </button>
                  </SignInButton>
                  <Link
                    href="/get-started"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    Get Started
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    Dashboard
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Bars3Icon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            </button>
          </nav>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-2">
              <Link href="/cards" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded">
                Cards
              </Link>
              <Link href="/decks" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded">
                Discover
              </Link>
              <Link href="/pricing" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded">
                Pricing
              </Link>
              <SignedOut>
                <div className="pt-2 space-y-2">
                  <SignInButton mode="modal">
                    <button className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      Sign In
                    </button>
                  </SignInButton>
                  <Link
                    href="/get-started"
                    className="block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
                  >
                    Get Started
                  </Link>
                </div>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded"
                >
                  Dashboard
                </Link>
              </SignedIn>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h2 
              className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Build Winning Pokemon TCG Decks with AI
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-600 dark:text-gray-400 mb-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Advanced deck analysis, collection tracking, and AI-powered recommendations 
              to help you dominate tournaments and optimize your gameplay.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <SignedOut>
                <Link
                  href="/get-started"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 text-lg font-medium text-center shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-105 focus-ring"
                >
                  Start Building Free
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/deck-builder/create"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 text-lg font-medium text-center shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-105 focus-ring"
                >
                  Create New Deck
                </Link>
              </SignedIn>
              <Link
                href="/cards"
                className="px-6 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white rounded-lg hover:bg-white dark:hover:bg-gray-600 transition-all duration-300 text-lg font-medium text-center border border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md transform hover:scale-105 focus-ring"
              >
                Browse Cards
              </Link>
            </motion.div>
            <div className="mt-8 flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 border-2 border-white"
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  10,000+ players
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <StarIcon key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                ))}
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  4.9/5 rating
                </span>
              </div>
            </div>
          </motion.div>
          <motion.div 
            className="relative lg:h-[600px]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-3xl blur-xl" />
            <div className="relative h-full flex items-center justify-center">
              <motion.div 
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 p-8 max-w-md w-full border border-gray-200 dark:border-gray-700"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <h3 className="text-xl font-bold mb-4">Quick Deck Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Consistency Score</span>
                    <span className="text-2xl font-bold text-green-600">92%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
                    <span className="text-2xl font-bold text-blue-600">78%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Meta Score</span>
                    <span className="text-2xl font-bold text-purple-600">A+</span>
                  </div>
                  <div className="mt-6 pt-6 border-t">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Deck Composition</div>
                    <div className="flex gap-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-red-400 to-red-600" style={{ width: '33%' }} />
                      <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: '27%' }} />
                      <div className="h-2 rounded-full bg-gradient-to-r from-gray-400 to-gray-600" style={{ width: '40%' }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>Pokemon</span>
                      <span>Trainers</span>
                      <span>Energy</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16 lg:py-24 border-t">
        <div className="text-center mb-12">
          <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Everything You Need to Master the Game
          </h3>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Professional tools used by top players to build, analyze, and optimize their decks
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            title="AI-Powered Deck Builder"
            description="Create competitive decks with our intelligent builder. Get real-time suggestions, validation, and format legality checking as you build."
            icon="🎴"
            features={["Drag & drop interface", "Real-time validation", "Smart suggestions"]}
          />
          <FeatureCard
            title="Advanced Analysis Engine"
            description="Deep dive into your deck performance with consistency calculations, matchup predictions, and strategic insights."
            icon="🤖"
            features={["Consistency calculator", "Matchup analysis", "Meta positioning"]}
          />
          <FeatureCard
            title="Collection Manager"
            description="Track your entire collection with value monitoring, set completion, and smart trading recommendations."
            icon="📚"
            features={["Price tracking", "Want list", "Trade matching"]}
          />
          <FeatureCard
            title="Testing Simulator"
            description="Test your deck with opening hand simulations, mulligan analysis, and probability calculations."
            icon="🎲"
            features={["Hand simulator", "Draw probability", "Setup analysis"]}
          />
          <FeatureCard
            title="Meta Insights"
            description="Stay ahead with real-time meta analysis, trending decks, and tournament results from around the world."
            icon="📊"
            features={["Tournament data", "Trending cards", "Meta reports"]}
          />
          <FeatureCard
            title="Community Features"
            description="Share decks, trade with players, and learn from the community with guides and deck techs."
            icon="🤝"
            features={["Deck sharing", "Trade system", "Deck guides"]}
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 lg:py-24 border-t">
        <div className="text-center mb-12">
          <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Start Building in Minutes
          </h3>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Get from idea to tournament-ready deck in just a few steps
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            <ProcessStep
              number="1"
              title="Choose Your Strategy"
              description="Select from popular archetypes or build from scratch. Our AI helps you find the perfect starting point."
            />
            <ProcessStep
              number="2"
              title="Build Your Deck"
              description="Add cards with our intuitive builder. Get real-time feedback on consistency, legality, and synergies."
            />
            <ProcessStep
              number="3"
              title="Analyze & Optimize"
              description="Use our analysis tools to find weaknesses and get AI-powered suggestions for improvements."
            />
            <ProcessStep
              number="4"
              title="Test & Perfect"
              description="Simulate games, test opening hands, and refine your strategy before taking it to tournaments."
            />
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="container mx-auto px-4 py-16 lg:py-24 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
        <div className="text-center mb-12">
          <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h3>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Start free and upgrade as you grow
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard
            name="Free"
            price="$0"
            description="Perfect for casual players"
            features={[
              "Build up to 3 decks",
              "Basic deck analysis",
              "Collection tracking",
              "Community features"
            ]}
            cta="Start Free"
            ctaLink="/get-started"
          />
          <PricingCard
            name="Pro"
            price="$9.99"
            period="/month"
            description="For competitive players"
            features={[
              "Unlimited decks",
              "Advanced analysis",
              "AI recommendations",
              "Priority support",
              "Meta insights",
              "Export tools"
            ]}
            cta="Start Pro Trial"
            ctaLink="/get-started?plan=pro"
            highlighted
          />
          <PricingCard
            name="Team"
            price="$29.99"
            period="/month"
            description="For teams and groups"
            features={[
              "Everything in Pro",
              "Team collaboration",
              "Shared collection",
              "Tournament tools",
              "Custom reports",
              "API access"
            ]}
            cta="Contact Sales"
            ctaLink="/contact"
          />
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-16 lg:py-24 border-t">
        <div className="text-center mb-12">
          <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Trusted by Champions
          </h3>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            See what top players say about our platform
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <TestimonialCard
            quote="This deck builder completely changed how I prepare for tournaments. The analysis tools are game-changing."
            author="Sarah Chen"
            title="Regional Champion 2024"
            rating={5}
          />
          <TestimonialCard
            quote="The AI recommendations helped me find card synergies I never would have discovered on my own."
            author="Mike Rodriguez"
            title="Top 8 Worlds 2023"
            rating={5}
          />
          <TestimonialCard
            quote="Managing my collection and tracking values has never been easier. Essential tool for any serious player."
            author="Emma Thompson"
            title="League Challenge Winner"
            rating={5}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl p-8 lg:p-16 text-center text-white">
          <h3 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Build Your Championship Deck?
          </h3>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of players who are already building better decks with our advanced tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/get-started"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-all duration-300 text-lg font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Started Free
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white/10 transition-all duration-300 text-lg font-medium backdrop-blur-sm hover:backdrop-blur-md transform hover:scale-105"
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="/features" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Pricing</Link></li>
                <li><Link href="/changelog" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Changelog</Link></li>
                <li><Link href="/roadmap" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Roadmap</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><Link href="/guides" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Guides</Link></li>
                <li><Link href="/api" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">API Docs</Link></li>
                <li><Link href="/blog" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Blog</Link></li>
                <li><Link href="/community" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Community</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">About</Link></li>
                <li><Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Contact</Link></li>
                <li><Link href="/careers" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Careers</Link></li>
                <li><Link href="/press" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Press</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Terms</Link></li>
                <li><Link href="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cookies</Link></li>
                <li><Link href="/licenses" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Licenses</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-gray-600 dark:text-gray-400">
            <p>© 2024 Pokemon TCG Deck Builder. Not affiliated with Nintendo, Creatures, or GAMEFREAK.</p>
            <p className="mt-2 text-sm">
              Pokemon and Pokemon character names are trademarks of Nintendo.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  title, 
  description, 
  icon, 
  features 
}: { 
  title: string; 
  description: string; 
  icon: string;
  features: string[];
}) {
  return (
    <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-gray-200/50 dark:border-gray-700/50">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">{icon}</div>
        <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{description}</p>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProcessStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 group">
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/25 group-hover:shadow-xl group-hover:shadow-blue-500/30 transition-all duration-300">
        {number}
      </div>
      <div>
        <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{title}</h4>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function PricingCard({ 
  name, 
  price, 
  period,
  description, 
  features, 
  cta, 
  ctaLink,
  highlighted 
}: { 
  name: string; 
  price: string;
  period?: string;
  description: string; 
  features: string[]; 
  cta: string; 
  ctaLink: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl p-8 transition-all duration-300 ${
      highlighted 
        ? 'ring-2 ring-blue-600 shadow-2xl scale-105 border-blue-500' 
        : 'shadow-lg hover:shadow-xl border border-gray-200/50 dark:border-gray-700/50'
    }`}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white text-sm font-medium px-4 py-1 rounded-full shadow-lg">
            Most Popular
          </div>
        </div>
      )}
      <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{name}</h4>
      <div className="mb-4">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">{price}</span>
        {period && <span className="text-gray-600 dark:text-gray-400">{period}</span>}
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600 dark:text-gray-400">{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaLink}
        className={`block text-center px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
          highlighted 
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg' 
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function TestimonialCard({ quote, author, title, rating }: { quote: string; author: string; title: string; rating: number }) {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50">
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <StarIcon key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        ))}
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4 italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="font-semibold text-gray-900 dark:text-white">{author}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      </div>
    </div>
  );
}