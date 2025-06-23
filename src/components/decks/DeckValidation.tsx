'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface ValidationMessage {
  id: string;
  message: string;
  type: 'error' | 'warning';
}

interface DeckValidationProps {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  className?: string;
}

export const DeckValidation: React.FC<DeckValidationProps> = ({
  errors,
  warnings,
  className,
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {errors.map((error) => (
        <div
          key={error.id}
          className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-xs font-medium">{error.message}</p>
        </div>
      ))}
      
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-500"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-xs font-medium">{warning.message}</p>
        </div>
      ))}
    </div>
  );
};