/**
 * Treasury Analytics - FIX PACK v1.0
 * Analytics tracking for Treasury Movements module
 */

import { telemetry } from '../services/telemetryService';
import { MovementFilters } from './movementFilters';

export interface EmptyStateAnalytics {
  filters: MovementFilters;
  searchTerm: string;
  totalMovements: number;
  filteredMovements: number;
  activeAccounts: number;
  timestamp: string;
}

export interface FilterActionAnalytics {
  action: 'cta_click' | 'filter_reset' | 'filter_change';
  ctaType?: 'show_all_accounts' | 'show_last_90_days' | 'show_all_states' | 'reset_filters';
  previousFilters: MovementFilters;
  newFilters?: MovementFilters;
  resultCount?: number;
}

/**
 * Track when users encounter empty states
 */
export function trackEmptyState(analytics: EmptyStateAnalytics): void {
  telemetry.measurePerformance('treasury_empty_state', 0, {
    type: 'empty_state_shown',
    filters: analytics.filters,
    searchTerm: analytics.searchTerm || null,
    totalMovements: analytics.totalMovements,
    filteredMovements: analytics.filteredMovements,
    activeAccounts: analytics.activeAccounts,
    hasRestrictiveFilters: hasRestrictiveFilters(analytics.filters),
    emptyStateReasons: getEmptyStateReasons(analytics.filters)
  });
}

/**
 * Track smart CTA clicks and their effectiveness
 */
export function trackFilterAction(analytics: FilterActionAnalytics): void {
  telemetry.measurePerformance('treasury_filter_action', 0, {
    type: analytics.action,
    ctaType: analytics.ctaType || null,
    previousFilters: analytics.previousFilters,
    newFilters: analytics.newFilters || null,
    resultCount: analytics.resultCount || null,
    wasEffective: analytics.resultCount ? analytics.resultCount > 0 : null
  });
}

/**
 * Track filter usage patterns
 */
export function trackFilterUsage(filters: MovementFilters, resultCount: number): void {
  telemetry.measurePerformance('treasury_filter_usage', 0, {
    type: 'filter_applied',
    accountFilter: filters.accountId,
    dateRange: filters.dateRange,
    statusFilter: filters.status,
    excludePersonal: filters.excludePersonal,
    hasCustomDate: filters.dateRange === 'custom',
    resultCount,
    isRestrictive: hasRestrictiveFilters(filters)
  });
}

/**
 * Track movements creation and import success
 */
export function trackMovementCreation(
  method: 'manual' | 'import',
  count: number,
  metadata?: Record<string, any>
): void {
  telemetry.measurePerformance('treasury_movement_creation', 0, {
    type: 'movement_created',
    method,
    count,
    ...metadata
  });
}

/**
 * Track cache invalidation events
 */
export function trackCacheInvalidation(
  reason: 'account_change' | 'movement_creation' | 'import_complete' | 'manual_refresh',
  impactedMovements?: number
): void {
  telemetry.measurePerformance('treasury_cache_invalidation', 0, {
    type: 'cache_invalidated',
    reason,
    impactedMovements: impactedMovements || null
  });
}

/**
 * Analyze if current filters are restrictive
 */
function hasRestrictiveFilters(filters: MovementFilters): boolean {
  return (
    filters.accountId !== 'all' ||
    filters.status !== 'Todos' ||
    filters.excludePersonal ||
    filters.dateRange === 'custom' ||
    filters.dateRange === 'last30days'
  );
}

/**
 * Identify specific reasons for empty state
 */
function getEmptyStateReasons(filters: MovementFilters): string[] {
  const reasons: string[] = [];
  
  if (filters.accountId !== 'all') {
    reasons.push('specific_account');
  }
  
  if (filters.status !== 'Todos') {
    reasons.push('status_filter');
  }
  
  if (filters.excludePersonal) {
    reasons.push('exclude_personal');
  }
  
  if (filters.dateRange === 'custom') {
    reasons.push('custom_date_range');
  } else if (filters.dateRange === 'last30days') {
    reasons.push('short_date_range');
  }
  
  return reasons;
}

/**
 * Get analytics summary for dashboard
 */
export function getAnalyticsSummary(): {
  emptyStates: number;
  filterActions: number;
  movementCreations: number;
  cacheInvalidations: number;
} {
  const events = telemetry.exportSessionData();
  
  if (!events) {
    return {
      emptyStates: 0,
      filterActions: 0,
      movementCreations: 0,
      cacheInvalidations: 0
    };
  }
  
  const performanceEvents = events.filter(e => e.type === 'performance');
  
  return {
    emptyStates: performanceEvents.filter(e => 
      e.metadata?.type === 'empty_state_shown'
    ).length,
    filterActions: performanceEvents.filter(e => 
      e.metadata?.type === 'filter_applied' || e.metadata?.action === 'cta_click'
    ).length,
    movementCreations: performanceEvents.filter(e => 
      e.metadata?.type === 'movement_created'
    ).length,
    cacheInvalidations: performanceEvents.filter(e => 
      e.metadata?.type === 'cache_invalidated'
    ).length
  };
}