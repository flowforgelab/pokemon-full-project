'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Premium loading spinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colorClasses = {
    primary: 'border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-400',
    secondary: 'border-yellow-200 border-t-yellow-600',
    white: 'border-gray-300 border-t-white',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <motion.div
        className={cn(
          sizeClasses[size],
          colorClasses[color],
          'border-2 rounded-full'
        )}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

// Pokeball loading spinner
interface PokeballSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PokeballSpinner: React.FC<PokeballSpinnerProps> = ({
  size = 'md',
  className,
}) => {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const actualSize = sizeMap[size];

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <motion.div
        className="relative"
        style={{ width: actualSize, height: actualSize }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        {/* Top half */}
        <div
          className="absolute inset-0 bg-red-500 rounded-t-full"
          style={{ height: '50%' }}
        />
        {/* Bottom half */}
        <div
          className="absolute bottom-0 inset-x-0 bg-white dark:bg-gray-200 rounded-b-full"
          style={{ height: '50%' }}
        />
        {/* Center line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-gray-900 dark:bg-gray-800" />
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-gray-900 dark:bg-gray-800 rounded-full">
          <div className="absolute inset-2 bg-white dark:bg-gray-200 rounded-full" />
        </div>
      </motion.div>
    </div>
  );
};

// Pulse loading animation
interface PulseLoaderProps {
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({
  count = 3,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            sizeClasses[size],
            'bg-blue-600 dark:bg-blue-400 rounded-full'
          )}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
};

// Skeleton loading placeholder
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'none';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  animation = 'pulse',
  width,
  height,
}) => {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-gray-200 dark:bg-gray-700',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: width || (variant === 'circular' ? height : '100%'),
        height: height || (variant === 'text' ? '1rem' : '100%'),
      }}
    >
      {animation === 'wave' && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
    </div>
  );
};

// Card skeleton component
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl p-6 shadow-card', className)}>
      <div className="space-y-4">
        <Skeleton variant="rectangular" height={200} className="rounded-lg" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
        <div className="flex items-center space-x-2">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
    </div>
  );
};

// List skeleton component
interface ListSkeletonProps {
  count?: number;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ count = 5, className }) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Full page loading overlay
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message,
  className,
}) => {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 bg-black/50 backdrop-blur-sm z-50',
        'flex items-center justify-center',
        className
      )}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-2xl">
        <LoadingSpinner size="lg" className="mb-4" />
        {message && (
          <p className="text-gray-700 dark:text-gray-300 text-center">
            {message}
          </p>
        )}
      </div>
    </motion.div>
  );
};

// Progress bar
interface ProgressBarProps {
  progress: number;
  className?: string;
  color?: 'primary' | 'secondary' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className,
  color = 'primary',
  size = 'md',
  showLabel = false,
}) => {
  const colorClasses = {
    primary: 'bg-blue-600 dark:bg-blue-500',
    secondary: 'bg-yellow-500',
    success: 'bg-green-600',
    error: 'bg-red-600',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
        sizeClasses[size]
      )}>
        <motion.div
          className={cn(
            'h-full rounded-full',
            colorClasses[color]
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {showLabel && (
        <span className="absolute right-0 top-full mt-1 text-xs text-gray-600 dark:text-gray-400">
          {progress}%
        </span>
      )}
    </div>
  );
};

// Deck Card Skeleton - for deck listing cards
export const DeckCardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-gray-50 dark:bg-gray-700 rounded-lg p-6', className)}>
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-5" variant="circular" />
        </div>
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </div>
  );
};

// Table Row Skeleton - for table loading states
export const TableRowSkeleton: React.FC<{ columns?: number; className?: string }> = ({ 
  columns = 5, 
  className 
}) => {
  return (
    <tr className={className}>
      <td className="px-6 py-4">
        <div className="flex items-center">
          <Skeleton className="h-10 w-8 mr-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </td>
      {Array.from({ length: columns - 1 }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton className="h-4 w-24" />
        </td>
      ))}
    </tr>
  );
};