
// Performance monitoring utility for runtime optimization
export class PerformanceMonitor {
  private metrics: { [key: string]: number } = {};
  private observer: PerformanceObserver | null = null;
  
  constructor() {
    this.initializeObserver();
  }
  
  private initializeObserver() {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(entry.name, entry.duration);
          
          // Log slow operations in development
          if (process.env.NODE_ENV === 'development' && entry.duration > 100) {
            console.warn('[PERF] Slow operation detected:', entry.name, `${entry.duration.toFixed(2)}ms`);
          }
        }
      });
      
      this.observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
    }
  }
  
  recordMetric(name: string, value: number) {
    this.metrics[name] = value;
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    return fn().finally(() => {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      
      if (duration > 100) {
        console.warn(`[PERF] Async operation '${name}' took ${duration.toFixed(2)}ms`);
      }
    });
  }
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      
      if (duration > 50) {
        console.warn(`[PERF] Operation '${name}' took ${duration.toFixed(2)}ms`);
      }
    }
  }
  
  dispose() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
