'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  title,
  children,
  defaultOpen = false,
  onOpenChange,
  className,
  triggerClassName,
  contentClassName,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  return (
    <div className={cn('border rounded-lg', className)}>
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center justify-between p-4',
          'hover:bg-accent/5 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
          triggerClassName
        )}
        aria-expanded={isOpen}
      >
        <div className="flex-1 text-left">{title}</div>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-muted-foreground transition-transform duration-200 ml-2',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>
      
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          isOpen ? 'max-h-[2000px]' : 'max-h-0'
        )}
      >
        <div className={cn('p-4 pt-0 border-t', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
};