'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { useState } from 'react';
import { ChevronRightIcon, StarIcon, CheckIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
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
              <Link href="/decks/discover" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Discover
              </Link>
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Pricing
              </Link>
              <div className="flex items-center gap-4">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                      Sign In
                    </button>
                  </SignInButton>
                  <Link
                    href="/sign-up"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              <Bars3Icon className="h-6 w-6" />
            </button>
          </nav>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-2">
              <Link href="/cards" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded">
                Cards
              </Link>
              <Link href="/decks/discover" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded">
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
                    href="/sign-up"
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
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Build Winning Pokemon TCG Decks with AI
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              Advanced deck analysis, collection tracking, and AI-powered recommendations 
              to help you dominate tournaments and optimize your gameplay.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <SignedOut>
                <Link
                  href="/sign-up"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium text-center"
                >
                  Start Building Free
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/deck-builder/create"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium text-center"
                >
                  Create New Deck
                </Link>
              </SignedIn>
              <Link
                href="/cards"
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-lg font-medium text-center"
              >
                Browse Cards
              </Link>
            </div>
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
                  <StarIcon key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                ))}
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  4.9/5 rating
                </span>
              </div>
            </div>
          </div>
          <div className="relative lg:h-[600px]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-3xl" />
            <div className="relative h-full flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
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
                      <div className="flex-1 bg-red-500 h-2 rounded-full" style={{ width: '33%' }} />
                      <div className="flex-1 bg-blue-500 h-2 rounded-full" style={{ width: '27%' }} />
                      <div className="flex-1 bg-gray-500 h-2 rounded-full" style={{ width: '40%' }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>Pokemon</span>
                      <span>Trainers</span>
                      <span>Energy</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
      <section className="container mx-auto px-4 py-16 lg:py-24 border-t bg-gray-50 dark:bg-gray-800/50">
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
            ctaLink="/sign-up"
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
            ctaLink="/sign-up?plan=pro"
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
              href="/sign-up"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors text-lg font-medium"
            >
              Get Started Free
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white/10 transition-colors text-lg font-medium"
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900">
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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
      <div className="text-4xl mb-4">{icon}</div>
      <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckIcon className="w-4 h-4 text-green-500" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProcessStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
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
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-8 ${highlighted ? 'ring-2 ring-blue-600 shadow-xl scale-105' : 'shadow-lg'}`}>
      {highlighted && (
        <div className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
          Most Popular
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
        className={`block text-center px-6 py-3 rounded-lg font-medium transition-colors ${
          highlighted 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <StarIcon key={i} className="w-5 h-5 text-yellow-500 fill-current" />
        ))}
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4 italic">&ldquo;{quote}&rdquo;</p>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{author}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      </div>
    </div>
  );
}