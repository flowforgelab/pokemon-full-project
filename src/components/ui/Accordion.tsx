'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
  allowMultiple: boolean;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

interface AccordionProps {
  children: React.ReactNode;
  allowMultiple?: boolean;
  defaultExpanded?: string[];
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  children,
  allowMultiple = false,
  defaultExpanded = [],
  className,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  }, [allowMultiple]);

  return (
    <AccordionContext.Provider value={{ expandedItems, toggleItem, allowMultiple }}>
      <div className={cn('space-y-2', className)}>{children}</div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  id,
  children,
  className,
}) => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('AccordionItem must be used within Accordion');
  }

  const isExpanded = context.expandedItems.has(id);

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        isExpanded && 'shadow-sm',
        className
      )}
      data-state={isExpanded ? 'open' : 'closed'}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            isExpanded,
            onToggle: () => context.toggleItem(id),
          });
        }
        return child;
      })}
    </div>
  );
};

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const AccordionTrigger: React.FC<AccordionTriggerProps> = ({
  children,
  className,
  isExpanded = false,
  onToggle,
}) => {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between p-4 text-left',
        'hover:bg-accent/5 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
        className
      )}
      aria-expanded={isExpanded}
    >
      {children}
      <ChevronDown
        className={cn(
          'w-5 h-5 text-muted-foreground transition-transform duration-200',
          isExpanded && 'transform rotate-180'
        )}
      />
    </button>
  );
};

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
  isExpanded?: boolean;
}

export const AccordionContent: React.FC<AccordionContentProps> = ({
  children,
  className,
  isExpanded = false,
}) => {
  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-200 ease-out',
        isExpanded ? 'max-h-[2000px]' : 'max-h-0'
      )}
    >
      <div className={cn('p-4 pt-0', className)}>{children}</div>
    </div>
  );
};