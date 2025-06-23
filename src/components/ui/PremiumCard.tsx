'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PremiumCardProps {
  variant?: 'default' | 'premium' | 'holographic' | 'floating' | 'glass';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isHoverable?: boolean;
  as?: keyof JSX.IntrinsicElements;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  (
    {
      variant = 'default',
      children,
      className,
      onClick,
      isHoverable = false,
      as: Component = 'div',
      padding = 'md',
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      'bg-white dark:bg-gray-800 rounded-xl overflow-hidden transition-all duration-300',
      onClick && 'cursor-pointer'
    );
    
    const variantClasses = {
      default: cn(
        'shadow-card border border-gray-200 dark:border-gray-700',
        isHoverable && 'hover:shadow-lg hover:-translate-y-1'
      ),
      premium: cn(
        'shadow-xl border border-gray-200 dark:border-gray-600',
        'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900',
        isHoverable && 'hover:shadow-2xl hover:-translate-y-2'
      ),
      holographic: cn(
        'shadow-holographic border border-blue-200 dark:border-blue-800',
        'bg-gradient-to-br from-blue-50 via-white to-purple-50',
        'dark:from-gray-800 dark:via-gray-800 dark:to-gray-900',
        'relative overflow-hidden',
        'before:absolute before:inset-0 before:bg-gradient-to-r',
        'before:from-transparent before:via-blue-500/10 before:to-transparent',
        'before:translate-x-[-100%] hover:before:translate-x-[100%]',
        'before:transition-transform before:duration-1000',
        isHoverable && 'hover:shadow-holographic hover:-translate-y-2'
      ),
      floating: cn(
        'shadow-floating border-0',
        'bg-white dark:bg-gray-800',
        isHoverable && 'hover:shadow-2xl hover:-translate-y-3'
      ),
      glass: cn(
        'backdrop-blur-lg bg-white/80 dark:bg-gray-800/80',
        'border border-white/20 dark:border-gray-700/50',
        'shadow-xl',
        isHoverable && 'hover:bg-white/90 dark:hover:bg-gray-800/90 hover:shadow-2xl hover:-translate-y-1'
      ),
    };
    
    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-4 sm:p-6',
      lg: 'p-6 sm:p-8',
      xl: 'p-8 sm:p-10',
    };

    const MotionComponent = motion[Component as keyof typeof motion] as any;

    return (
      <MotionComponent
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          paddingClasses[padding],
          className
        )}
        onClick={onClick}
        whileHover={isHoverable ? { scale: 1.02 } : undefined}
        whileTap={onClick ? { scale: 0.98 } : undefined}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
        {...props}
      >
        {variant === 'holographic' && (
          <>
            {/* Additional holographic effects */}
            <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none">
              <div
                className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
                style={{
                  backgroundSize: '200% 200%',
                  animation: 'holographicShift 3s ease-in-out infinite',
                }}
              />
            </div>
          </>
        )}
        
        {variant === 'glass' && (
          <>
            {/* Glass morphism noise texture */}
            <div
              className="absolute inset-0 opacity-[0.015] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              }}
            />
          </>
        )}
        
        <div className="relative z-10">{children}</div>
      </MotionComponent>
    );
  }
);

PremiumCard.displayName = 'PremiumCard';

// Hover card variant with enhanced effects
export const HoverCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className, onClick }) => {
  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      className={cn("group cursor-pointer", className)}
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-300 z-10 pointer-events-none" />
        
        {/* Shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover:left-[100%] transition-all duration-700" />
        </div>
        
        {children}
      </div>
    </motion.div>
  );
};

export default PremiumCard;