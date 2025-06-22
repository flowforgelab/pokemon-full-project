import { DragItem, DropZone, CardEntry } from './types';
import { Card } from '@prisma/client';

export class DragDropManager {
  private draggedItem: DragItem | null = null;
  private activeDropZones: Set<string> = new Set();
  private dragListeners: Map<string, Function> = new Map();
  private dropListeners: Map<string, Function> = new Map();
  private dragCounter = 0;

  // Initialize drag and drop
  initialize(): void {
    // Add global drag event listeners
    document.addEventListener('dragend', this.handleGlobalDragEnd.bind(this));
    document.addEventListener('drop', this.handleGlobalDrop.bind(this));
    document.addEventListener('dragover', this.handleGlobalDragOver.bind(this));
  }

  // Clean up
  destroy(): void {
    document.removeEventListener('dragend', this.handleGlobalDragEnd.bind(this));
    document.removeEventListener('drop', this.handleGlobalDrop.bind(this));
    document.removeEventListener('dragover', this.handleGlobalDragOver.bind(this));
    this.dragListeners.clear();
    this.dropListeners.clear();
  }

  // Start dragging
  startDrag(item: DragItem, event: DragEvent): void {
    this.draggedItem = item;
    
    // Set drag data
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('application/json', JSON.stringify(item));
    
    // Create custom drag image
    const dragImage = this.createDragImage(item);
    event.dataTransfer!.setDragImage(dragImage, 50, 50);
    
    // Clean up drag image after a delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
    
    // Notify listeners
    this.notifyDragListeners('start', item);
  }

  // End dragging
  endDrag(): void {
    this.draggedItem = null;
    this.activeDropZones.clear();
    this.notifyDragListeners('end', null);
  }

  // Handle drop
  handleDrop(
    dropZoneId: string,
    event: DragEvent,
    onDrop: (item: DragItem, index?: number) => void
  ): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.draggedItem) return;
    
    // Calculate drop index based on mouse position
    const dropIndex = this.calculateDropIndex(event);
    
    // Call the drop handler
    onDrop(this.draggedItem, dropIndex);
    
    // Clean up
    this.endDrag();
  }

  // Register drop zone
  registerDropZone(
    dropZone: DropZone,
    element: HTMLElement,
    onDrop: (item: DragItem, index?: number) => void
  ): () => void {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      this.dragCounter++;
      
      if (this.canDrop(dropZone)) {
        this.activeDropZones.add(dropZone.id);
        element.classList.add('drop-zone-active');
        this.notifyDropListeners(dropZone.id, 'enter');
      }
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      this.dragCounter--;
      
      if (this.dragCounter === 0) {
        this.activeDropZones.delete(dropZone.id);
        element.classList.remove('drop-zone-active');
        this.notifyDropListeners(dropZone.id, 'leave');
      }
    };
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      
      if (this.canDrop(dropZone)) {
        e.dataTransfer!.dropEffect = 'move';
        
        // Show drop indicator
        this.showDropIndicator(element, e);
      } else {
        e.dataTransfer!.dropEffect = 'none';
      }
    };
    
    const handleDrop = (e: DragEvent) => {
      this.dragCounter = 0;
      this.handleDrop(dropZone.id, e, onDrop);
      element.classList.remove('drop-zone-active');
    };
    
    // Add event listeners
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('dragenter', handleDragEnter);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }

  // Make element draggable
  makeDraggable(
    element: HTMLElement,
    item: DragItem,
    options?: {
      handle?: string;
      preview?: () => HTMLElement;
      onDragStart?: () => void;
      onDragEnd?: () => void;
    }
  ): () => void {
    element.draggable = true;
    
    const handle = options?.handle ? element.querySelector(options.handle) : element;
    if (!handle) return () => {};
    
    const handleDragStart = (e: DragEvent) => {
      // Only drag from handle if specified
      if (options?.handle && e.target !== handle) {
        e.preventDefault();
        return;
      }
      
      this.startDrag(item, e);
      element.classList.add('dragging');
      options?.onDragStart?.();
    };
    
    const handleDragEnd = (e: DragEvent) => {
      element.classList.remove('dragging');
      this.endDrag();
      options?.onDragEnd?.();
    };
    
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    
    // Touch support
    this.addTouchSupport(element, item, options);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('dragstart', handleDragStart);
      element.removeEventListener('dragend', handleDragEnd);
      element.draggable = false;
    };
  }

  // Multi-select support
  private selectedItems: Set<string> = new Set();
  
  toggleSelection(cardId: string): void {
    if (this.selectedItems.has(cardId)) {
      this.selectedItems.delete(cardId);
    } else {
      this.selectedItems.add(cardId);
    }
  }
  
  clearSelection(): void {
    this.selectedItems.clear();
  }
  
  getSelectedItems(): string[] {
    return Array.from(this.selectedItems);
  }
  
  isSelected(cardId: string): boolean {
    return this.selectedItems.has(cardId);
  }

  // Touch support for mobile
  private addTouchSupport(
    element: HTMLElement,
    item: DragItem,
    options?: any
  ): void {
    let touchItem: HTMLElement | null = null;
    let touchOffset = { x: 0, y: 0 };
    
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      
      // Create a clone for dragging
      touchItem = element.cloneNode(true) as HTMLElement;
      touchItem.style.position = 'fixed';
      touchItem.style.zIndex = '9999';
      touchItem.style.opacity = '0.8';
      touchItem.style.pointerEvents = 'none';
      touchItem.style.transform = 'scale(1.05)';
      
      // Calculate offset
      const rect = element.getBoundingClientRect();
      touchOffset.x = touch.clientX - rect.left;
      touchOffset.y = touch.clientY - rect.top;
      
      // Position the clone
      touchItem.style.left = `${touch.clientX - touchOffset.x}px`;
      touchItem.style.top = `${touch.clientY - touchOffset.y}px`;
      
      document.body.appendChild(touchItem);
      
      element.classList.add('dragging');
      this.draggedItem = item;
      options?.onDragStart?.();
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchItem) return;
      
      const touch = e.touches[0];
      touchItem.style.left = `${touch.clientX - touchOffset.x}px`;
      touchItem.style.top = `${touch.clientY - touchOffset.y}px`;
      
      // Find element under touch point
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elementBelow) {
        const dropZone = elementBelow.closest('[data-drop-zone]');
        if (dropZone) {
          dropZone.classList.add('drop-zone-active');
        }
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchItem) return;
      
      const touch = e.changedTouches[0];
      
      // Find drop target
      touchItem.style.display = 'none';
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      touchItem.style.display = '';
      
      if (elementBelow) {
        const dropZone = elementBelow.closest('[data-drop-zone]');
        if (dropZone) {
          const dropEvent = new DragEvent('drop', {
            clientX: touch.clientX,
            clientY: touch.clientY,
          });
          dropZone.dispatchEvent(dropEvent);
        }
      }
      
      // Clean up
      document.body.removeChild(touchItem);
      touchItem = null;
      element.classList.remove('dragging');
      this.endDrag();
      options?.onDragEnd?.();
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
  }

  // Helper methods
  private canDrop(dropZone: DropZone): boolean {
    if (!this.draggedItem) return false;
    return dropZone.accepts.includes(this.draggedItem.type);
  }

  private createDragImage(item: DragItem): HTMLElement {
    const dragImage = document.createElement('div');
    dragImage.className = 'drag-preview';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.zIndex = '-1';
    
    // Create card preview
    const cardPreview = document.createElement('div');
    cardPreview.className = 'card-preview';
    cardPreview.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${item.card.images?.small}" alt="${item.card.name}" />
        ${item.quantity ? `<span class="quantity">×${item.quantity}</span>` : ''}
      </div>
    `;
    
    dragImage.appendChild(cardPreview);
    document.body.appendChild(dragImage);
    
    return dragImage;
  }

  private calculateDropIndex(event: DragEvent): number {
    const dropTarget = event.target as HTMLElement;
    const container = dropTarget.closest('[data-drop-container]');
    
    if (!container) return -1;
    
    const cards = Array.from(container.querySelectorAll('[data-card-index]'));
    const mouseY = event.clientY;
    
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLElement;
      const rect = card.getBoundingClientRect();
      const cardMiddle = rect.top + rect.height / 2;
      
      if (mouseY < cardMiddle) {
        return i;
      }
    }
    
    return cards.length;
  }

  private showDropIndicator(element: HTMLElement, event: DragEvent): void {
    // Remove existing indicators
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.position = 'absolute';
    indicator.style.height = '2px';
    indicator.style.backgroundColor = 'var(--primary-color)';
    indicator.style.left = '0';
    indicator.style.right = '0';
    indicator.style.pointerEvents = 'none';
    
    const rect = element.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    
    if (relativeY < rect.height / 2) {
      indicator.style.top = '0';
    } else {
      indicator.style.bottom = '0';
    }
    
    element.appendChild(indicator);
  }

  private handleGlobalDragEnd(event: DragEvent): void {
    // Clean up any remaining states
    document.querySelectorAll('.drop-zone-active').forEach(el => {
      el.classList.remove('drop-zone-active');
    });
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  }

  private handleGlobalDrop(event: DragEvent): void {
    // Prevent default browser behavior
    event.preventDefault();
  }

  private handleGlobalDragOver(event: DragEvent): void {
    // Prevent default to allow drop
    event.preventDefault();
  }

  // Event listeners
  onDragStart(callback: (item: DragItem) => void): () => void {
    const id = Date.now().toString();
    this.dragListeners.set(id, callback);
    return () => this.dragListeners.delete(id);
  }

  onDropZoneChange(callback: (zoneId: string, state: string) => void): () => void {
    const id = Date.now().toString();
    this.dropListeners.set(id, callback);
    return () => this.dropListeners.delete(id);
  }

  private notifyDragListeners(event: string, item: DragItem | null): void {
    this.dragListeners.forEach(callback => callback({ event, item }));
  }

  private notifyDropListeners(zoneId: string, state: string): void {
    this.dropListeners.forEach(callback => callback(zoneId, state));
  }

  // Auto-scroll support
  enableAutoScroll(container: HTMLElement): () => void {
    let scrollInterval: NodeJS.Timeout | null = null;
    
    const handleDragOver = (e: DragEvent) => {
      const rect = container.getBoundingClientRect();
      const scrollZone = 50; // pixels from edge to trigger scroll
      const scrollSpeed = 10; // pixels per frame
      
      const mouseY = e.clientY;
      const mouseX = e.clientX;
      
      // Clear existing scroll
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
      
      // Check vertical scroll
      if (mouseY < rect.top + scrollZone) {
        // Scroll up
        scrollInterval = setInterval(() => {
          container.scrollTop -= scrollSpeed;
        }, 16);
      } else if (mouseY > rect.bottom - scrollZone) {
        // Scroll down
        scrollInterval = setInterval(() => {
          container.scrollTop += scrollSpeed;
        }, 16);
      }
      
      // Check horizontal scroll
      else if (mouseX < rect.left + scrollZone) {
        // Scroll left
        scrollInterval = setInterval(() => {
          container.scrollLeft -= scrollSpeed;
        }, 16);
      } else if (mouseX > rect.right - scrollZone) {
        // Scroll right
        scrollInterval = setInterval(() => {
          container.scrollLeft += scrollSpeed;
        }, 16);
      }
    };
    
    const handleDragLeave = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };
    
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDragLeave);
    
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDragLeave);
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }
}