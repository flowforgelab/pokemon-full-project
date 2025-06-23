'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CardSkeletonProps {
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted rounded-lg w-full h-full',
        className
      )}
    >
      <div className="relative w-full h-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent shimmer" />
      </div>
    </div>
  );
};