'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'premium';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  ripple?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      ripple = true,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled && !isLoading) {
        const rect = e.currentTarget.getBoundingClientRect();
        const newRipple = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          id: Date.now(),
        };
        
        setRipples([...ripples, newRipple]);
        
        setTimeout(() => {
          setRipples(ripples => ripples.filter(ripple => ripple.id !== newRipple.id));
        }, 1000);
      }
      
      onClick?.(e);
    };

    const baseClasses = cn(
      'inline-flex items-center justify-center font-semibold transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed',
      'relative overflow-hidden group select-none',
      fullWidth && 'w-full'
    );
    
    const variantClasses = {
      primary: cn(
        'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
        'text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5',
        'focus-visible:ring-blue-500 active:transform active:translate-y-0',
        'dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700',
        'dark:focus-visible:ring-blue-400'
      ),
      secondary: cn(
        'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600',
        'text-gray-900 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5',
        'focus-visible:ring-yellow-500 active:transform active:translate-y-0',
        'dark:focus-visible:ring-yellow-400'
      ),
      outline: cn(
        'border-2 border-gray-300 hover:border-blue-500 bg-white hover:bg-blue-50',
        'text-gray-700 hover:text-blue-600 shadow-sm hover:shadow-md',
        'focus-visible:ring-blue-500 focus-visible:border-blue-500',
        'dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700',
        'dark:text-gray-300 dark:hover:text-blue-400 dark:hover:border-blue-400',
        'dark:focus-visible:ring-blue-400'
      ),
      ghost: cn(
        'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
        'focus-visible:ring-blue-500',
        'dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-800',
        'dark:focus-visible:ring-blue-400'
      ),
      destructive: cn(
        'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
        'text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5',
        'focus-visible:ring-red-500 active:transform active:translate-y-0',
        'dark:focus-visible:ring-red-400'
      ),
      premium: cn(
        'bg-gradient-to-r from-purple-600 via-blue-600 to-blue-700',
        'hover:from-purple-700 hover:via-blue-700 hover:to-blue-800',
        'text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-1',
        'focus-visible:ring-purple-500 active:transform active:translate-y-0',
        'dark:focus-visible:ring-purple-400',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent',
        'before:via-white before:to-transparent before:opacity-0 hover:before:opacity-20',
        'before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700'
      ),
    };
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
      md: 'px-4 py-2 text-sm rounded-lg gap-2',
      lg: 'px-6 py-3 text-base rounded-lg gap-2.5',
      xl: 'px-8 py-4 text-lg rounded-xl gap-3',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        onClick={handleClick}
        disabled={disabled || isLoading}
        {...props}
      >
        <AnimatePresence>
          {ripple && ripples.map(ripple => (
            <motion.span
              key={ripple.id}
              className="absolute bg-white/30 rounded-full pointer-events-none"
              initial={{
                width: 0,
                height: 0,
                x: ripple.x,
                y: ripple.y,
                opacity: 1,
              }}
              animate={{
                width: 400,
                height: 400,
                x: ripple.x - 200,
                y: ripple.y - 200,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>

        {isLoading && (
          <svg
            className={cn(
              'animate-spin text-current',
              size === 'sm' && 'w-3 h-3',
              size === 'md' && 'w-4 h-4',
              size === 'lg' && 'w-5 h-5',
              size === 'xl' && 'w-6 h-6'
            )}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        
        {!isLoading && leftIcon && (
          <span className="flex-shrink-0">{leftIcon}</span>
        )}
        
        <span className="truncate">{children}</span>
        
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;