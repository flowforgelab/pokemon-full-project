'use client';

import React, { useState } from 'react';
import { 
  Button, 
  PremiumCard, 
  HoverCard,
  PageTransition,
  StaggeredGrid,
  FadeIn,
  SlideIn,
  ScaleIn,
  LoadingSpinner,
  PulseLoader,
  Skeleton,
  CardSkeleton,
  ListSkeleton,
  LoadingOverlay,
  ProgressBar,
  PremiumNavigation,
  PremiumHero,
  SplitHero,
  PremiumModal,
  Drawer,
  Tooltip,
  Popover,
} from '@/components/ui';
import { ThemeToggle } from '@/components/providers/ThemeProvider';
import { 
  Sparkles, 
  Zap, 
  Shield, 
  TrendingUp,
  ChevronRight,
  Download,
  Heart,
  Share2,
  Settings,
} from 'lucide-react';

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [progress, setProgress] = useState(65);

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PremiumNavigation />
        
        {/* Hero Section Demo */}
        <section className="mb-24">
          <PremiumHero />
        </section>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-24">
          {/* Typography Section */}
          <FadeIn>
            <section className="space-y-8">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Typography</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Premium typography system with carefully selected font families and sizes.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h1 className="text-6xl font-black text-gray-900 dark:text-white">Display Heading</h1>
                  <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Page Title</h2>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Section Header</h3>
                  <h4 className="text-xl font-medium text-gray-900 dark:text-white">Subsection</h4>
                  <p className="text-base text-gray-700 dark:text-gray-300">
                    Body text with optimal readability. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Small text for captions and secondary information.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-card">
                    <h3 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Gradient Text
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Create stunning text effects with gradient colors.
                    </p>
                    <code className="font-mono text-sm bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded">
                      .text-gradient
                    </code>
                  </div>
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Colors Section */}
          <SlideIn direction="up">
            <section className="space-y-8">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Color Palette</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Sophisticated color system inspired by Pokemon energy types.
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.entries({
                  Primary: '#3b82f6',
                  Secondary: '#eab308',
                  Fire: '#ff6b6b',
                  Water: '#4ecdc4',
                  Grass: '#51cf66',
                  Electric: '#ffd43b',
                  Psychic: '#c77dff',
                  Dark: '#495057',
                }).map(([name, color]) => (
                  <div key={name} className="text-center">
                    <div
                      className="w-full h-24 rounded-lg shadow-md mb-2"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">{color}</p>
                  </div>
                ))}
              </div>
            </section>
          </SlideIn>

          {/* Buttons Section */}
          <ScaleIn>
            <section className="space-y-8">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Buttons</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Premium button components with multiple variants and states.
                </p>
              </div>
              
              <div className="space-y-6">
                {/* Button Variants */}
                <div className="flex flex-wrap gap-4">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="premium">Premium</Button>
                </div>
                
                {/* Button Sizes */}
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                  <Button size="xl">Extra Large</Button>
                </div>
                
                {/* Button States */}
                <div className="flex flex-wrap gap-4">
                  <Button leftIcon={<Download className="w-4 h-4" />}>Download</Button>
                  <Button rightIcon={<ChevronRight className="w-4 h-4" />}>Continue</Button>
                  <Button isLoading>Loading...</Button>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
            </section>
          </ScaleIn>

          {/* Cards Section */}
          <section className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Cards</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Premium card components with various styles and effects.
              </p>
            </div>
            
            <StaggeredGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
              {[
                { variant: 'default' as const, title: 'Default Card' },
                { variant: 'premium' as const, title: 'Premium Card' },
                { variant: 'holographic' as const, title: 'Holographic Card' },
                { variant: 'floating' as const, title: 'Floating Card' },
                { variant: 'glass' as const, title: 'Glass Card' },
              ].map((card) => (
                <PremiumCard key={card.variant} variant={card.variant} isHoverable>
                  <h3 className="text-xl font-semibold mb-3">{card.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This is a {card.variant} card with hover effects and premium styling.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      Variant: {card.variant}
                    </span>
                    <div className="flex gap-2">
                      <Heart className="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer" />
                      <Share2 className="w-5 h-5 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer" />
                    </div>
                  </div>
                </PremiumCard>
              ))}
              
              <HoverCard>
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-3">Hover Card</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Special hover card with shine effect and gradient overlay.
                  </p>
                </div>
              </HoverCard>
            </StaggeredGrid>
          </section>

          {/* Loading States */}
          <section className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Loading States</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Premium loading indicators and skeleton screens.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <PremiumCard>
                <h3 className="text-lg font-semibold mb-6">Loading Indicators</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Spinner</span>
                    <LoadingSpinner size="md" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pulse</span>
                    <PulseLoader />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Progress Bar</span>
                    <ProgressBar progress={progress} color="primary" showLabel />
                  </div>
                </div>
              </PremiumCard>
              
              <div className="space-y-4">
                <CardSkeleton />
                <ListSkeleton count={3} />
              </div>
            </div>
          </section>

          {/* Modals & Overlays */}
          <section className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Modals & Overlays</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Premium modal and drawer components.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
              <Button variant="outline" onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
              
              <Tooltip content="This is a tooltip!">
                <Button variant="ghost">Hover for Tooltip</Button>
              </Tooltip>
              
              <Popover
                content={
                  <div className="space-y-2">
                    <h4 className="font-semibold">Popover Content</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This is a popover with rich content.
                    </p>
                    <Button size="sm" fullWidth>Action</Button>
                  </div>
                }
              >
                <Button variant="outline">Click for Popover</Button>
              </Popover>
            </div>
          </section>

          {/* Theme Toggle Demo */}
          <section className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Theme System</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Sophisticated dark mode with smooth transitions.
              </p>
              <div className="flex items-center gap-6">
                <ThemeToggle />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Toggle between light and dark themes
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Modals */}
        <PremiumModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Premium Modal"
          description="This is a premium modal with smooth animations"
          footer={
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              This modal demonstrates the premium design system with beautiful animations,
              backdrop blur, and responsive design.
            </p>
            <PremiumCard variant="glass">
              <p className="text-sm">Glass morphism card inside modal</p>
            </PremiumCard>
          </div>
        </PremiumModal>

        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Settings"
          position="right"
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-2">Preferences</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm">Notifications</span>
                  <input type="checkbox" className="rounded" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm">Auto-save</span>
                  <input type="checkbox" className="rounded" defaultChecked />
                </label>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Theme</h4>
              <ThemeToggle variant="menu" />
            </div>
          </div>
        </Drawer>
      </div>
    </PageTransition>
  );
}