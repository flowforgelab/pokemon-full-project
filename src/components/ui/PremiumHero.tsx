'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Button from './Button';
import { ChevronDown, Sparkles, Zap, Shield, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumHeroProps {
  title?: React.ReactNode;
  subtitle?: string;
  ctaPrimary?: {
    text: string;
    href: string;
  };
  ctaSecondary?: {
    text: string;
    href: string;
  };
  variant?: 'default' | 'gradient' | 'particles' | 'video';
}

export const PremiumHero: React.FC<PremiumHeroProps> = ({
  title = (
    <>
      Build{' '}
      <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
        Legendary
      </span>{' '}
      Decks
    </>
  ),
  subtitle = 'Advanced AI-powered deck building, collection tracking, and competitive analysis for Pokemon TCG masters',
  ctaPrimary = { text: 'Start Building Free', href: '/sign-up' },
  ctaSecondary = { text: 'Watch Demo', href: '#demo' },
  variant = 'gradient',
}) => {
  return (
    <section className={cn(
      'relative min-h-screen flex items-center justify-center overflow-hidden',
      variant === 'gradient' && 'bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900',
      variant === 'default' && 'bg-gray-50 dark:bg-gray-900',
      variant === 'particles' && 'bg-black',
      variant === 'video' && 'bg-gray-900'
    )}>
      {/* Background effects based on variant */}
      {variant === 'gradient' && <GradientBackground />}
      {variant === 'particles' && <ParticlesBackground />}
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Trusted by 10,000+ Trainers Worldwide</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={cn(
            'text-5xl md:text-7xl font-black mb-6 leading-tight',
            variant === 'gradient' || variant === 'particles' ? 'text-white' : 'text-gray-900 dark:text-white'
          )}
        >
          {title}
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className={cn(
            'text-xl md:text-2xl mb-12 max-w-2xl mx-auto leading-relaxed',
            variant === 'gradient' || variant === 'particles' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'
          )}
        >
          {subtitle}
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <Link href={ctaPrimary.href}>
            <Button variant="premium" size="xl">
              {ctaPrimary.text}
            </Button>
          </Link>
          <Link href={ctaSecondary.href}>
            <Button 
              variant="outline" 
              size="xl" 
              className={cn(
                variant === 'gradient' || variant === 'particles' 
                  ? 'border-white/30 text-white hover:bg-white/10' 
                  : ''
              )}
            >
              {ctaSecondary.text}
            </Button>
          </Link>
        </motion.div>

        {/* Feature badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-wrap justify-center gap-6"
        >
          {[
            { icon: Zap, text: 'Real-time Analysis' },
            { icon: Shield, text: 'Secure & Private' },
            { icon: TrendingUp, text: 'Meta Insights' },
          ].map((feature, index) => (
            <div
              key={feature.text}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg',
                variant === 'gradient' || variant === 'particles'
                  ? 'bg-white/10 backdrop-blur-sm text-white/80'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              )}
            >
              <feature.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{feature.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
      
      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className={cn(
          'w-6 h-6',
          variant === 'gradient' || variant === 'particles' ? 'text-white/60' : 'text-gray-400'
        )} />
      </motion.div>
    </section>
  );
};

// Gradient background with animated elements
const GradientBackground: React.FC = () => {
  return (
    <div className="absolute inset-0">
      {/* Floating particles */}
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [-20, 20, -20],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
      
      {/* Gradient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          delay: 1,
        }}
      />
      
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
};

// Particles background
const ParticlesBackground: React.FC = () => {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 100 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white/50 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [-100, 100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

// Split hero variant
export const SplitHero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-left"
        >
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            <span>New: AI-Powered Deck Suggestions</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-6 leading-tight">
            Master the Meta with{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Smart Deck Building
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            Analyze thousands of winning decks, track your collection value, 
            and get personalized recommendations to dominate your local tournaments.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Button variant="primary" size="lg">
              Start Free Trial
            </Button>
            <Button variant="outline" size="lg">
              View Features
            </Button>
          </div>
          
          <div className="flex items-center space-x-8 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>14-day free trial</span>
            </div>
          </div>
        </motion.div>
        
        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="relative z-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-4 h-32"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                />
              ))}
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400 rounded-full blur-xl opacity-50" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-400 rounded-full blur-xl opacity-50" />
        </motion.div>
      </div>
    </section>
  );
};