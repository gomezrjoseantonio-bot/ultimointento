/**
 * Optimized Database Service
 * 
 * High-performance database operations with automatic optimization,
 * caching, and memory management improvements.
 */

import { openDB, IDBPDatabase } from 'idb';
import { performanceMonitor, withPerformanceMonitoring } from './performanceMonitoringService';

const DB_NAME = 'AtlasHorizonDB';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 100;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class OptimizedDatabaseService {
  private dbPromise: Promise<IDBPDatabase<any>> | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxCacheSize = 1000;

  /**
   * Get database instance with connection pooling
   */
  async getDB(): Promise<IDBPDatabase<any>> {
    if (!this.dbPromise) {
      const { initDB } = await import('./db');
      this.dbPromise = initDB();
    }
    return this.dbPromise;
  }

  /**
   * Optimized bulk clear operation with progress tracking
   */
  async optimizedResetAllData(
    onProgress?: (progress: number, currentStore: string) => void
  ): Promise<void> {
    return withPerformanceMonitoring('optimizedResetAllData', async () => {
      const db = await this.getDB();
      const storeNames = Array.from(db.objectStoreNames);
      
      console.log(`[OPTIMIZED-RESET] Clearing ${storeNames.length} stores with batching`);
      
      // Clear stores in optimized batches
      const OPTIMAL_BATCH_SIZE = 6; // Optimal for most browsers
      
      for (let i = 0; i < storeNames.length; i += OPTIMAL_BATCH_SIZE) {
        const batch = storeNames.slice(i, i + OPTIMAL_BATCH_SIZE);
        const progress = Math.round((i / storeNames.length) * 100);
        
        if (onProgress) {
          onProgress(progress, batch[0]);
        }
        
        // Process batch
        await this.processClearBatch(db, batch);
        
        // Yield control to prevent UI blocking
        await this.yieldToMainThread();
      }

      // Clear caches and storage
      await this.clearApplicationCaches();
      
      if (onProgress) {
        onProgress(100, 'completed');
      }
      
      console.log('[OPTIMIZED-RESET] Reset completed successfully');
    });
  }

  /**
   * Process a batch of stores to clear
   */
  private async processClearBatch(db: IDBPDatabase<any>, storeNames: string[]): Promise<void> {
    const tx = db.transaction(storeNames, 'readwrite');
    
    const clearPromises = storeNames.map(async (storeName) => {
      const store = tx.objectStore(storeName);
      await store.clear();
      console.log(`[OPTIMIZED-RESET] ✓ Cleared ${storeName}`);
    });

    await Promise.all(clearPromises);
    await tx.done;
  }

  /**
   * Clear application caches efficiently
   */
  private async clearApplicationCaches(): Promise<void> {
    // Clear memory cache
    this.cache.clear();
    
    // Clear localStorage efficiently
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isAtlasRelatedKey(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[OPTIMIZED-RESET] Cleared ${keysToRemove.length} localStorage keys`);

    // Clear browser caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const atlasCaches = cacheNames.filter(name => this.isAtlasRelatedKey(name));
        
        await Promise.all(atlasCaches.map(name => caches.delete(name)));
        console.log(`[OPTIMIZED-RESET] Cleared ${atlasCaches.length} browser caches`);
      } catch (error) {
        console.warn('[OPTIMIZED-RESET] Could not clear browser caches:', error);
      }
    }
  }

  /**
   * Check if a key is Atlas-related
   */
  private isAtlasRelatedKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes('atlas') ||
           lowerKey.includes('horizon') ||
           lowerKey.includes('treasury') ||
           lowerKey.includes('demo') ||
           lowerKey.includes('fiscal');
  }

  /**
   * Yield control to main thread to prevent UI blocking
   */
  private async yieldToMainThread(): Promise<void> {
    return new Promise(resolve => {
      if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
        // Use modern scheduler API if available
        (window as any).scheduler.postTask(resolve, { priority: 'background' });
      } else {
        // Fallback to setTimeout
        setTimeout(resolve, 0);
      }
    });
  }

  /**
   * Cached database query with automatic invalidation
   */
  async cachedQuery<T>(
    storeName: string,
    operation: string,
    queryFn: () => Promise<T>,
    ttl: number = CACHE_TTL
  ): Promise<T> {
    const cacheKey = `${storeName}:${operation}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const result = await withPerformanceMonitoring(`cachedQuery:${cacheKey}`, queryFn);
    
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntries();
    }
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl
    });

    return result;
  }

  /**
   * Evict oldest cache entries when cache is full
   */
  private evictOldestCacheEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Bulk insert with batching for better performance
   */
  async bulkInsert<T>(
    storeName: string,
    items: T[],
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return withPerformanceMonitoring(`bulkInsert:${storeName}`, async () => {
      const db = await this.getDB();
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        await Promise.all(batch.map(item => store.add(item)));
        await tx.done;
        
        if (onProgress) {
          const progress = Math.round(((i + batch.length) / items.length) * 100);
          onProgress(progress);
        }
        
        // Yield control between batches
        await this.yieldToMainThread();
      }
    });
  }

  /**
   * Get database statistics efficiently
   */
  async getDatabaseStats(): Promise<{
    storeStats: Record<string, number>;
    totalRecords: number;
    estimatedSize: number;
  }> {
    return this.cachedQuery('stats', 'getDatabaseStats', async () => {
      const db = await this.getDB();
      const storeNames = Array.from(db.objectStoreNames);
      const storeStats: Record<string, number> = {};
      let totalRecords = 0;

      // Count records in parallel batches
      const STATS_BATCH_SIZE = 8;
      for (let i = 0; i < storeNames.length; i += STATS_BATCH_SIZE) {
        const batch = storeNames.slice(i, i + STATS_BATCH_SIZE);
        
        const counts = await Promise.all(
          batch.map(async (storeName) => {
            try {
              const count = await db.count(storeName);
              return { storeName, count };
            } catch (error) {
              console.warn(`Could not count ${storeName}:`, error);
              return { storeName, count: 0 };
            }
          })
        );

        counts.forEach(({ storeName, count }) => {
          storeStats[storeName] = count;
          totalRecords += count;
        });
      }

      // Estimate database size
      let estimatedSize = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          estimatedSize = estimate.usage || 0;
        } catch (error) {
          console.warn('Could not estimate storage:', error);
        }
      }

      return { storeStats, totalRecords, estimatedSize };
    }, 30000); // Cache for 30 seconds
  }

  /**
   * Force cache invalidation
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(pattern)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.cache.clear();
    this.dbPromise = null;
  }
}

// Export singleton instance
export const optimizedDbService = new OptimizedDatabaseService();
export { OptimizedDatabaseService };