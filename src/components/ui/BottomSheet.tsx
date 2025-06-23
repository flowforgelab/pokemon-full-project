'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[];
  defaultSnapPoint?: number;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [0.25, 0.5, 0.9],
  defaultSnapPoint = 0.5,
  className,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentHeight, setCurrentHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen && sheetRef.current) {
      const windowHeight = window.innerHeight;
      const initialHeight = windowHeight * defaultSnapPoint;
      setCurrentHeight(initialHeight);
    }
  }, [isOpen, defaultSnapPoint]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setStartHeight(currentHeight);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaY = startY - e.touches[0].clientY;
    const newHeight = Math.max(0, Math.min(window.innerHeight, startHeight + deltaY));
    setCurrentHeight(newHeight);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const windowHeight = window.innerHeight;
    const currentPercent = currentHeight / windowHeight;
    
    // Close if dragged below minimum threshold
    if (currentPercent < 0.1) {
      onClose();
      return;
    }
    
    // Snap to nearest point
    let nearestSnapPoint = snapPoints[0];
    let minDistance = Math.abs(currentPercent - snapPoints[0]);
    
    snapPoints.forEach((point) => {
      const distance = Math.abs(currentPercent - point);
      if (distance < minDistance) {
        minDistance = distance;
        nearestSnapPoint = point;
      }
    });
    
    setCurrentHeight(windowHeight * nearestSnapPoint);
  };

  const handleBackdropClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl',
          'shadow-2xl transition-transform',
          isDragging ? '' : 'transition-all duration-300',
          className
        )}
        style={{
          height: `${currentHeight}px`,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        <div
          className="flex justify-center pt-2 pb-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>
        
        {title && (
          <div className="px-4 pb-4 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
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