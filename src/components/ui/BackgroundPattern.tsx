'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BackgroundPatternProps {
  variant?: 'pokeball' | 'energy' | 'cards' | 'grid';
  className?: string;
  opacity?: number;
}

export const BackgroundPattern: React.FC<BackgroundPatternProps> = ({
  variant = 'pokeball',
  className,
  opacity = 0.05,
}) => {
  const renderPattern = () => {
    switch (variant) {
      case 'pokeball':
        return (
          <svg
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="pokeball-pattern"
                x="0"
                y="0"
                width="100"
                height="100"
                patternUnits="userSpaceOnUse"
              >
                <g opacity={opacity}>
                  {/* Pokeball circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="30"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-400 dark:text-gray-600"
                  />
                  {/* Center line */}
                  <line
                    x1="20"
                    y1="50"
                    x2="80"
                    y2="50"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-400 dark:text-gray-600"
                  />
                  {/* Center circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-400 dark:text-gray-600"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="5"
                    fill="currentColor"
                    className="text-gray-400 dark:text-gray-600"
                  />
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pokeball-pattern)" />
          </svg>
        );

      case 'energy':
        return (
          <svg
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="energy-pattern"
                x="0"
                y="0"
                width="120"
                height="120"
                patternUnits="userSpaceOnUse"
              >
                <g opacity={opacity}>
                  {/* Energy symbols at different positions */}
                  <circle cx="30" cy="30" r="15" fill="currentColor" className="text-red-400" />
                  <circle cx="90" cy="30" r="15" fill="currentColor" className="text-blue-400" />
                  <circle cx="30" cy="90" r="15" fill="currentColor" className="text-yellow-400" />
                  <circle cx="90" cy="90" r="15" fill="currentColor" className="text-green-400" />
                  <circle cx="60" cy="60" r="15" fill="currentColor" className="text-purple-400" />
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#energy-pattern)" />
          </svg>
        );

      case 'cards':
        return (
          <svg
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="cards-pattern"
                x="0"
                y="0"
                width="100"
                height="140"
                patternUnits="userSpaceOnUse"
              >
                <g opacity={opacity}>
                  {/* Card shape */}
                  <rect
                    x="20"
                    y="20"
                    width="60"
                    height="80"
                    rx="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-400 dark:text-gray-600"
                    transform="rotate(-10 50 60)"
                  />
                  <rect
                    x="20"
                    y="20"
                    width="60"
                    height="80"
                    rx="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-400 dark:text-gray-600"
                    transform="rotate(10 50 60)"
                  />
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cards-pattern)" />
          </svg>
        );

      case 'grid':
        return (
          <svg
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="grid-pattern"
                x="0"
                y="0"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <g opacity={opacity}>
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-gray-400 dark:text-gray-600"
                  />
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        );
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className
      )}
    >
      {renderPattern()}
    </div>
  );
};