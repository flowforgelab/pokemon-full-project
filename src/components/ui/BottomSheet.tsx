'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
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
  const [currentSnapIndex, setCurrentSnapIndex] = useState(
    snapPoints.indexOf(defaultSnapPoint) !== -1 ? snapPoints.indexOf(defaultSnapPoint) : 1
  );
  
  useBodyScrollLock(isOpen);

  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const currentHeight = windowHeight * snapPoints[currentSnapIndex];

  const handleDragEnd = (event: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    
    // Determine drag direction and snap
    if (velocity > 500 || (velocity > 0 && offset > 100)) {
      // Dragging down
      if (currentSnapIndex === 0) {
        onClose();
      } else {
        setCurrentSnapIndex(Math.max(0, currentSnapIndex - 1));
      }
    } else if (velocity < -500 || (velocity < 0 && offset < -100)) {
      // Dragging up
      setCurrentSnapIndex(Math.min(snapPoints.length - 1, currentSnapIndex + 1));
    }
  };

  const handleBackdropClick = () => {
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
          
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: windowHeight - currentHeight }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300 
            }}
            drag="y"
            dragElastic={0.2}
            dragConstraints={{ top: 0, bottom: windowHeight }}
            onDragEnd={handleDragEnd}
            className={cn(
              'absolute bottom-0 left-0 right-0',
              'bg-white dark:bg-gray-800 rounded-t-2xl',
              'shadow-2xl',
              className
            )}
            style={{
              height: windowHeight,
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing">
              <motion.div 
                className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              />
            </div>
            
            {/* Header */}
            {title && (
              <div className="px-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              </div>
            )}
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-6">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};