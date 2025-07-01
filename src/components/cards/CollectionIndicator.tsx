'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, Plus, Minus, Edit2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/utils/api';
import { useToastNotification } from '@/hooks/useToastNotification';

interface CollectionIndicatorProps {
  cardId: string;
  cardName: string;
  inCollection: boolean;
  quantity: number;
  quantityFoil: number;
  isBasicEnergy?: boolean;
  onQuantityChange?: (quantity: number, quantityFoil: number) => void;
  className?: string;
  layout?: 'grid' | 'list';
}

export function CollectionIndicator({
  cardId,
  cardName,
  inCollection,
  quantity: initialQuantity,
  quantityFoil: initialQuantityFoil,
  isBasicEnergy = false,
  onQuantityChange,
  className,
  layout = 'grid',
}: CollectionIndicatorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [quantityFoil, setQuantityFoil] = useState(initialQuantityFoil);
  const [tempQuantity, setTempQuantity] = useState(initialQuantity);
  const [tempQuantityFoil, setTempQuantityFoil] = useState(initialQuantityFoil);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const foilInputRef = useRef<HTMLInputElement>(null);
  const toast = useToastNotification();
  const utils = api.useUtils();

  useEffect(() => {
    setQuantity(initialQuantity);
    setQuantityFoil(initialQuantityFoil);
  }, [initialQuantity, initialQuantityFoil]);

  const updateQuantity = api.collection.updateQuantityByCardId.useMutation({
    onSuccess: (data) => {
      setQuantity(data.quantity);
      setQuantityFoil(data.quantityFoil);
      utils.collection.checkCardsInCollection.invalidate();
      onQuantityChange?.(data.quantity, data.quantityFoil);
      
      if (data.deleted) {
        toast?.success('Removed from collection', `${cardName} has been removed from your collection`);
      } else {
        toast?.success('Collection updated', `Updated ${cardName} quantity`);
      }
    },
    onError: (error) => {
      console.error('Failed to update quantity:', error);
      // Reset to original values
      setQuantity(initialQuantity);
      setQuantityFoil(initialQuantityFoil);
      toast?.error('Failed to update', error.message || 'Please try again');
    },
  });

  const handleEdit = () => {
    if (isBasicEnergy) return;
    setIsEditing(true);
    setTempQuantity(quantity);
    setTempQuantityFoil(quantityFoil);
    setTimeout(() => quantityInputRef.current?.select(), 50);
  };

  const handleSave = () => {
    const newQuantity = Math.max(0, Math.min(9999, tempQuantity));
    const newQuantityFoil = Math.max(0, Math.min(9999, tempQuantityFoil));
    
    if (newQuantity !== quantity || newQuantityFoil !== quantityFoil) {
      updateQuantity.mutate({
        cardId,
        quantity: newQuantity,
        quantityFoil: newQuantityFoil,
      });
    }
    
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempQuantity(quantity);
    setTempQuantityFoil(quantityFoil);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleQuickAdd = () => {
    if (isBasicEnergy) return;
    const newQuantity = quantity + 1;
    updateQuantity.mutate({
      cardId,
      quantity: newQuantity,
      quantityFoil,
    });
  };

  const handleQuickRemove = () => {
    if (isBasicEnergy || quantity === 0) return;
    const newQuantity = Math.max(0, quantity - 1);
    updateQuantity.mutate({
      cardId,
      quantity: newQuantity,
      quantityFoil,
    });
  };

  const totalQuantity = quantity + quantityFoil;

  if (isBasicEnergy) {
    return (
      <div className={cn(
        layout === 'grid' ? 'absolute top-0 right-0 z-20' : 'relative',
        layout === 'grid' ? 'rounded-bl-lg rounded-tr-lg' : 'rounded-full',
        'flex items-center gap-1.5 px-2 py-1',
        'bg-green-500 text-white',
        'text-xs font-medium',
        className
      )}>
        <Check className="w-3 h-3" />
        <span>∞</span>
      </div>
    );
  }

  if (layout === 'list') {
    // List layout - more horizontal space
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                ref={quantityInputRef}
                type="number"
                value={tempQuantity}
                onChange={(e) => setTempQuantity(parseInt(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                className="w-12 px-1 py-0.5 text-sm text-center border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                min="0"
                max="9999"
                placeholder="Reg"
              />
              <span className="text-xs text-gray-500">Reg</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={foilInputRef}
                type="number"
                value={tempQuantityFoil}
                onChange={(e) => setTempQuantityFoil(parseInt(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                className="w-12 px-1 py-0.5 text-sm text-center border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                min="0"
                max="9999"
                placeholder="Foil"
              />
              <span className="text-xs text-gray-500">Foil</span>
            </div>
            <button
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {totalQuantity > 0 ? (
              <>
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-full',
                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                  'text-xs font-medium'
                )}>
                  <Check className="w-3 h-3" />
                  <span>{quantity > 0 && quantity}</span>
                  {quantityFoil > 0 && (
                    <>
                      {quantity > 0 && '+'}
                      <span className="font-bold">{quantityFoil}✨</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleQuickRemove}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Remove one"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleEdit}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit quantities"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleQuickAdd}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Add one"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={handleQuickAdd}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full',
                  'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                  'text-gray-600 dark:text-gray-400 text-xs font-medium',
                  'transition-colors'
                )}
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Grid layout - more compact
  return (
    <div className={cn('absolute top-0 right-0 z-20', className)}>
      {isEditing ? (
        <div className="absolute top-2 right-2 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border dark:border-gray-700">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={quantityInputRef}
                type="number"
                value={tempQuantity}
                onChange={(e) => setTempQuantity(parseInt(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                className="w-16 px-2 py-1 text-sm text-center border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                min="0"
                max="9999"
                placeholder="0"
              />
              <span className="text-xs text-gray-500 w-8">Reg</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={foilInputRef}
                type="number"
                value={tempQuantityFoil}
                onChange={(e) => setTempQuantityFoil(parseInt(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                className="w-16 px-2 py-1 text-sm text-center border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                min="0"
                max="9999"
                placeholder="0"
              />
              <span className="text-xs text-gray-500 w-8">Foil</span>
            </div>
            <div className="flex gap-1 justify-end">
              <button
                onClick={handleSave}
                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : totalQuantity > 0 ? (
        <button
          onClick={handleEdit}
          className={cn(
            'rounded-bl-lg rounded-tr-lg',
            'flex items-center gap-1 px-2 py-1.5',
            'bg-green-500 hover:bg-green-600 text-white',
            'text-xs font-medium',
            'transition-all hover:brightness-110',
            'shadow-sm',
            'min-w-[32px]'
          )}
        >
          <Check className="w-3 h-3 flex-shrink-0" />
          <span className="font-medium">
            {quantity > 0 && quantity}
            {quantityFoil > 0 && (
              <>
                {quantity > 0 && '+'}
                <span className="font-bold">{quantityFoil}✨</span>
              </>
            )}
          </span>
        </button>
      ) : (
        <button
          onClick={handleQuickAdd}
          className={cn(
            'rounded-bl-lg rounded-tr-lg',
            'w-8 h-8',
            'bg-gray-800/70 hover:bg-gray-800/90 dark:bg-gray-700/70 dark:hover:bg-gray-600/90',
            'flex items-center justify-center',
            'transition-all hover:brightness-110',
            'shadow-sm'
          )}
          title="Add to collection"
        >
          <Plus className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  );
}