'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  position?: 'center' | 'bottom' | 'top';
  dismissible?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MobileModal: React.FC<MobileModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'medium',
  position = 'center',
  dismissible = true,
  showCloseButton = true,
  children,
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useFocusTrap(modalRef, isOpen);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dismissible, isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (dismissible && e.target === e.currentTarget) {
      onClose();
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'max-w-sm max-h-[50vh]';
      case 'medium':
        return 'max-w-lg max-h-[70vh]';
      case 'large':
        return 'max-w-2xl max-h-[85vh]';
      case 'fullscreen':
        return 'w-full h-full max-w-none max-h-none';
      default:
        return 'max-w-lg max-h-[70vh]';
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'items-end';
      case 'top':
        return 'items-start';
      case 'center':
      default:
        return 'items-center justify-center';
    }
  };

  const getModalPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'rounded-t-2xl animate-slide-up';
      case 'top':
        return 'rounded-b-2xl animate-slide-down';
      case 'center':
      default:
        return 'rounded-2xl animate-scale-up';
    }
  };

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        getPositionClasses(),
        'animate-fade-in'
      )}
      onClick={handleBackdropClick}
      aria-modal
      aria-labelledby={title ? 'modal-title' : undefined}
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative bg-background flex flex-col',
          'shadow-2xl',
          getSizeClasses(),
          getModalPositionClasses(),
          size !== 'fullscreen' && 'm-4',
          className
        )}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent transition-colors ml-auto"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};