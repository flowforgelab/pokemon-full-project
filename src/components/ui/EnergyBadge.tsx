'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type EnergyType = 
  | 'fire' 
  | 'water' 
  | 'grass' 
  | 'electric' 
  | 'psychic' 
  | 'fighting' 
  | 'darkness' 
  | 'metal' 
  | 'dragon' 
  | 'fairy' 
  | 'colorless';

interface EnergyBadgeProps {
  type: EnergyType;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  count?: number;
  className?: string;
}

const energyConfig = {
  fire: {
    bg: 'bg-energy-fire',
    icon: '🔥',
    glow: 'shadow-lg shadow-red-500/50',
  },
  water: {
    bg: 'bg-energy-water',
    icon: '💧',
    glow: 'shadow-lg shadow-blue-500/50',
  },
  grass: {
    bg: 'bg-energy-grass',
    icon: '🌿',
    glow: 'shadow-lg shadow-green-500/50',
  },
  electric: {
    bg: 'bg-energy-electric',
    icon: '⚡',
    glow: 'shadow-lg shadow-yellow-500/50',
  },
  psychic: {
    bg: 'bg-energy-psychic',
    icon: '🔮',
    glow: 'shadow-lg shadow-purple-500/50',
  },
  fighting: {
    bg: 'bg-energy-fighting',
    icon: '👊',
    glow: 'shadow-lg shadow-orange-500/50',
  },
  darkness: {
    bg: 'bg-energy-darkness',
    icon: '🌙',
    glow: 'shadow-lg shadow-gray-700/50',
  },
  metal: {
    bg: 'bg-energy-metal',
    icon: '⚙️',
    glow: 'shadow-lg shadow-gray-500/50',
  },
  dragon: {
    bg: 'bg-energy-dragon',
    icon: '🐉',
    glow: 'shadow-lg shadow-indigo-500/50',
  },
  fairy: {
    bg: 'bg-energy-fairy',
    icon: '✨',
    glow: 'shadow-lg shadow-pink-500/50',
  },
  colorless: {
    bg: 'bg-energy-colorless',
    icon: '⭐',
    glow: 'shadow-lg shadow-gray-300/50',
  },
};

export const EnergyBadge: React.FC<EnergyBadgeProps> = ({
  type,
  size = 'md',
  animated = true,
  count,
  className,
}) => {
  const config = energyConfig[type];
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
  };

  const badge = (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full',
        'text-white font-bold',
        config.bg,
        sizeClasses[size],
        animated && 'transition-all duration-300 hover:scale-110',
        animated && config.glow,
        className
      )}
    >
      <span className="filter drop-shadow-md">{config.icon}</span>
      {count && count > 1 && (
        <span className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {count}
        </span>
      )}
    </div>
  );

  if (!animated) return badge;

  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {badge}
    </motion.div>
  );
};

interface EnergyGroupProps {
  energies: { type: EnergyType; count: number }[];
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export const EnergyGroup: React.FC<EnergyGroupProps> = ({
  energies,
  size = 'md',
  animated = true,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {energies.map((energy, index) => (
        <motion.div
          key={`${energy.type}-${index}`}
          initial={animated ? { opacity: 0, scale: 0 } : undefined}
          animate={animated ? { opacity: 1, scale: 1 } : undefined}
          transition={animated ? { delay: index * 0.1 } : undefined}
        >
          <EnergyBadge
            type={energy.type}
            size={size}
            count={energy.count}
            animated={animated}
          />
        </motion.div>
      ))}
    </div>
  );
};