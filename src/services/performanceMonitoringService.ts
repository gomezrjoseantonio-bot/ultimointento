/**
 * Performance Monitoring Service
 * 
 * Monitors and optimizes database operations, memory usage, and application performance.
 * Addresses the requirement to improve tool performance significantly.
 */

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage?: number;
  recordCount?: number;
  timestamp: number;
}

interface DatabaseStats {
  totalStores: number;
  totalRecords: number;
  largestStore: string;
  largestStoreSize: number;
  indexedDBSize: number;
}

class PerformanceMonitoringService {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 1000; // Keep only last 1000 metrics

  /**
   * Start timing an operation
   */
  startTiming(operation: string): () => void {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    return () => {
      const duration = performance.now() - startTime;
      const endMemory = this.getMemoryUsage();
      
      this.recordMetric({
        operation,
        duration,
        memoryUsage: endMemory - startMemory,
        timestamp: Date.now()
      });
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow operations
    if (metric.duration > 1000) { // > 1 second
      console.warn(`[PERFORMANCE] Slow operation detected: ${metric.operation} took ${metric.duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get current memory usage (if available)
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    averageDurations: Record<string, number>;
    slowestOperations: PerformanceMetrics[];
    memoryTrend: number;
  } {
    const operationGroups: Record<string, number[]> = {};
    
    // Group metrics by operation
    this.metrics.forEach(metric => {
      if (!operationGroups[metric.operation]) {
        operationGroups[metric.operation] = [];
      }
      operationGroups[metric.operation].push(metric.duration);
    });

    // Calculate averages
    const averageDurations: Record<string, number> = {};
    Object.entries(operationGroups).forEach(([operation, durations]) => {
      averageDurations[operation] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });

    // Find slowest operations
    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Calculate memory trend
    const recentMetrics = this.metrics.slice(-50);
    const memoryTrend = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / recentMetrics.length 
      : 0;

    return {
      averageDurations,
      slowestOperations,
      memoryTrend
    };
  }

  /**
   * Monitor database statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    const endTiming = this.startTiming('getDatabaseStats');
    
    try {
      const { initDB } = await import('./db');
      const db = await initDB();
      
      const storeNames = Array.from(db.objectStoreNames);
      let totalRecords = 0;
      let largestStore = '';
      let largestStoreSize = 0;

      // Count records in each store
      for (const storeName of storeNames) {
        try {
          const count = await db.count(storeName);
          totalRecords += count;
          
          if (count > largestStoreSize) {
            largestStoreSize = count;
            largestStore = storeName;
          }
        } catch (error) {
          console.warn(`Could not count records in store ${storeName}:`, error);
        }
      }

      // Estimate IndexedDB size (approximation)
      const indexedDBSize = await this.estimateIndexedDBSize();

      return {
        totalStores: storeNames.length,
        totalRecords,
        largestStore,
        largestStoreSize,
        indexedDBSize
      };
    } finally {
      endTiming();
    }
  }

  /**
   * Estimate IndexedDB size
   */
  private async estimateIndexedDBSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      } catch (error) {
        console.warn('Could not estimate storage usage:', error);
      }
    }
    return 0;
  }

  /**
   * Clear old metrics to free memory
   */
  clearMetrics(): void {
    this.metrics = [];
    console.log('[PERFORMANCE] Cleared performance metrics');
  }

  /**
   * Log current performance status
   */
  logPerformanceStatus(): void {
    const report = this.getPerformanceReport();
    console.group('[PERFORMANCE] Current Status');
    console.log('Average operation durations:', report.averageDurations);
    console.log('Memory trend (bytes):', report.memoryTrend);
    console.log('Recent slow operations:', report.slowestOperations.slice(0, 3));
    console.groupEnd();
  }

  /**
   * Check if performance optimization is needed
   */
  needsOptimization(): boolean {
    const report = this.getPerformanceReport();
    
    // Check for consistently slow operations
    const avgDbOperations = Object.entries(report.averageDurations)
      .filter(([op]) => op.includes('db') || op.includes('clear') || op.includes('reset'))
      .map(([, duration]) => duration);
    
    const avgDbDuration = avgDbOperations.length > 0 
      ? avgDbOperations.reduce((a, b) => a + b, 0) / avgDbOperations.length 
      : 0;

    // Flag for optimization if average DB operations > 500ms
    return avgDbDuration > 500;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitoringService();

// Convenience wrapper for timed database operations
export function withPerformanceMonitoring<T>(
  operation: string,
  asyncFunction: () => Promise<T>
): Promise<T> {
  const endTiming = performanceMonitor.startTiming(operation);
  
  return asyncFunction().finally(() => {
    endTiming();
  });
}

// Export for use in other services
export type { PerformanceMetrics, DatabaseStats };