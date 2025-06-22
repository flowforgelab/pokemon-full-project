// Service Worker Manager for client-side registration and management

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  
  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }
  
  async register(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }
    
    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });
      
      console.log('Service Worker registered successfully');
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check for updates periodically
      this.startUpdateCheck();
      
      // Request notification permission
      await this.requestNotificationPermission();
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  
  private setupEventListeners(): void {
    if (!this.registration) return;
    
    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            this.notifyUpdate();
          }
        });
      }
    });
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });
  }
  
  private startUpdateCheck(): void {
    // Check for updates every hour
    this.updateInterval = setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000);
  }
  
  private async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
  
  private notifyUpdate(): void {
    // Notify user about available update
    const updateBanner = document.createElement('div');
    updateBanner.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50';
    updateBanner.innerHTML = `
      <p class="mb-2">A new version is available!</p>
      <button onclick="window.location.reload()" class="bg-white text-blue-600 px-4 py-2 rounded">
        Update Now
      </button>
    `;
    document.body.appendChild(updateBanner);
  }
  
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'CACHE_UPDATED':
        console.log('Cache updated:', data);
        break;
      case 'OFFLINE_READY':
        console.log('Offline mode ready');
        break;
      default:
        console.log('Service Worker message:', type, data);
    }
  }
  
  // Public methods
  
  async update(): Promise<void> {
    await this.registration?.update();
  }
  
  async unregister(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    await this.registration?.unregister();
    this.registration = null;
  }
  
  async clearCache(): Promise<void> {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
  
  async getCacheSize(): Promise<number> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return 0;
    }
    
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  
  async requestBackgroundSync(tag: string): Promise<void> {
    if (!this.registration || !('sync' in this.registration)) {
      console.warn('Background sync not supported');
      return;
    }
    
    try {
      await (this.registration as any).sync.register(tag);
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
  
  async requestPeriodicSync(tag: string, minInterval: number): Promise<void> {
    if (!this.registration || !('periodicSync' in this.registration)) {
      console.warn('Periodic sync not supported');
      return;
    }
    
    try {
      await (this.registration as any).periodicSync.register(tag, {
        minInterval,
      });
    } catch (error) {
      console.error('Periodic sync registration failed:', error);
    }
  }
}

// Browser storage utilities
export class BrowserStorage {
  // LocalStorage with compression and encryption
  static async setLocal<T>(key: string, value: T, encrypt = false): Promise<void> {
    try {
      let data = JSON.stringify(value);
      
      // Compress if large
      if (data.length > 1024) {
        const { compress } = await import('@/lib/utils/compression');
        data = (await compress(data)).toString('base64');
      }
      
      // Encrypt if requested
      if (encrypt) {
        const { encrypt: encryptData } = await import('@/lib/utils/encryption');
        data = await encryptData(data);
      }
      
      localStorage.setItem(key, data);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }
  
  static async getLocal<T>(key: string, encrypted = false): Promise<T | null> {
    try {
      let data = localStorage.getItem(key);
      if (!data) return null;
      
      // Decrypt if encrypted
      if (encrypted) {
        const { decrypt } = await import('@/lib/utils/encryption');
        data = await decrypt(data);
      }
      
      // Decompress if needed
      try {
        // Try to parse directly first
        return JSON.parse(data);
      } catch {
        // If parse fails, try decompressing
        const { decompress } = await import('@/lib/utils/compression');
        const decompressed = await decompress(Buffer.from(data, 'base64'));
        return JSON.parse(decompressed);
      }
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return null;
    }
  }
  
  // SessionStorage helpers
  static setSession<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to sessionStorage:', error);
    }
  }
  
  static getSession<T>(key: string): T | null {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get from sessionStorage:', error);
      return null;
    }
  }
  
  // IndexedDB for large datasets
  static async openDB(name: string, version: number, upgradeCallback?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        upgradeCallback?.(db);
      };
    });
  }
  
  static async setIndexedDB<T>(dbName: string, storeName: string, key: string, value: T): Promise<void> {
    const db = await this.openDB(dbName, 1, (db) => {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    });
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    await store.put(value, key);
    
    db.close();
  }
  
  static async getIndexedDB<T>(dbName: string, storeName: string, key: string): Promise<T | null> {
    const db = await this.openDB(dbName, 1);
    
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }
  
  // Storage quota management
  static async getStorageQuota(): Promise<{
    usage: number;
    quota: number;
    percentage: number;
  }> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return { usage: 0, quota: 0, percentage: 0 };
    }
    
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    
    return {
      usage,
      quota,
      percentage: quota > 0 ? (usage / quota) * 100 : 0,
    };
  }
  
  static async requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator && 'persist' in navigator.storage)) {
      return false;
    }
    
    return await navigator.storage.persist();
  }
}

// Export singleton instance
export const serviceWorkerManager = ServiceWorkerManager.getInstance();