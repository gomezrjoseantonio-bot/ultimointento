// H-HOTFIX: Property Assignment Service
// Handles automatic property assignment for expenses with priority rules

import { Property } from './db';

/**
 * Priority rules for property assignment
 */
export enum PropertyAssignmentPriority {
  EXPLICIT_SELECTION = 1,    // User explicitly selected property
  SUPPLIER_MEMORY = 2,       // Remember previous assignment for this supplier
  SUPPLY_ADDRESS_MATCH = 3,  // Fuzzy match supply address to property address
  CUPS_CONTRACT_MATCH = 4,   // CUPS/contract matches active property contract
  HISTORICAL_USAGE = 5,      // Last property used with this supplier (90 days)
  NEEDS_ASSIGNMENT = 999     // No automatic assignment possible
}

export interface PropertyAssignmentResult {
  property_id: string | null;
  confidence: number;
  priority: PropertyAssignmentPriority;
  method: string;
  requires_manual_assignment: boolean;
  candidates?: Array<{
    property_id: string;
    confidence: number;
    reason: string;
  }>;
}

export interface PropertyAssignmentContext {
  supplier_name?: string;
  supplier_tax_id?: string;
  supply_address?: string;
  cups?: string;
  explicit_property_id?: string;
  user_selection?: string;
}

// In-memory cache for supplier assignments (in production, use persistent storage)
const supplierMemoryCache = new Map<string, { property_id: string; last_used: Date }>();

/**
 * Normalize address for fuzzy matching
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Replace special chars
    .replace(/\b(calle|c\/|c|avenida|av|plaza|pl|paseo|pso)\b/g, '') // Remove common prefixes
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate address similarity using simple token matching
 */
function calculateAddressSimilarity(address1: string, address2: string): number {
  const norm1 = normalizeAddress(address1);
  const norm2 = normalizeAddress(address2);
  
  if (!norm1 || !norm2) return 0;
  
  const tokens1 = norm1.split(' ');
  const tokens2 = norm2.split(' ');
  
  let matches = 0;
  const totalTokens = Math.max(tokens1.length, tokens2.length);
  
  for (const token1 of tokens1) {
    if (token1.length > 2 && tokens2.some(token2 => token2.includes(token1) || token1.includes(token2))) {
      matches++;
    }
  }
  
  return matches / totalTokens;
}

/**
 * Create supplier key for memory cache
 */
function createSupplierKey(context: PropertyAssignmentContext): string {
  const key = context.supplier_tax_id || context.supplier_name;
  return key ? normalizeAddress(key) : '';
}

/**
 * Remember property assignment for a supplier
 */
export function rememberSupplierPropertyAssignment(
  context: PropertyAssignmentContext,
  property_id: string
): void {
  const supplierKey = createSupplierKey(context);
  if (supplierKey) {
    supplierMemoryCache.set(supplierKey, {
      property_id,
      last_used: new Date()
    });
  }
}

/**
 * Get remembered property for a supplier
 */
function getRememberedProperty(context: PropertyAssignmentContext): string | null {
  const supplierKey = createSupplierKey(context);
  if (!supplierKey) return null;
  
  const remembered = supplierMemoryCache.get(supplierKey);
  if (!remembered) return null;
  
  // Check if memory is still valid (90 days)
  const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
  const age = Date.now() - remembered.last_used.getTime();
  
  if (age > maxAge) {
    supplierMemoryCache.delete(supplierKey);
    return null;
  }
  
  return remembered.property_id;
}

/**
 * Resolve property assignment using priority rules
 */
export async function resolvePropertyAssignment(
  context: PropertyAssignmentContext,
  availableProperties: Property[]
): Promise<PropertyAssignmentResult> {
  
  const candidates: PropertyAssignmentResult['candidates'] = [];
  
  // 1. Explicit selection (highest priority)
  if (context.explicit_property_id || context.user_selection) {
    const selectedId = context.explicit_property_id || context.user_selection;
    const property = availableProperties.find(p => p.id?.toString() === selectedId);
    
    if (property) {
      return {
        property_id: selectedId!,
        confidence: 1.0,
        priority: PropertyAssignmentPriority.EXPLICIT_SELECTION,
        method: 'explicit_selection',
        requires_manual_assignment: false
      };
    }
  }
  
  // 2. Supplier memory (high priority)
  const rememberedId = getRememberedProperty(context);
  if (rememberedId) {
    const property = availableProperties.find(p => p.id?.toString() === rememberedId);
    if (property) {
      candidates.push({
        property_id: rememberedId,
        confidence: 0.9,
        reason: 'supplier_memory'
      });
    }
  }
  
  // 3. Supply address fuzzy match
  if (context.supply_address) {
    for (const property of availableProperties) {
      const similarity = calculateAddressSimilarity(context.supply_address, property.address);
      if (similarity >= 0.7) { // 70% similarity threshold
        candidates.push({
          property_id: property.id!.toString(),
          confidence: similarity,
          reason: `address_match_${Math.round(similarity * 100)}%`
        });
      }
    }
  }
  
  // 4. CUPS/contract match (for utilities)
  if (context.cups) {
    // In a real implementation, this would check active contracts
    // For now, we'll skip this check as it requires contract data
  }
  
  // Sort candidates by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  // If we have high-confidence candidates, use the best one
  if (candidates.length > 0 && candidates[0].confidence >= 0.8) {
    const bestCandidate = candidates[0];
    return {
      property_id: bestCandidate.property_id,
      confidence: bestCandidate.confidence,
      priority: bestCandidate.reason === 'supplier_memory' 
        ? PropertyAssignmentPriority.SUPPLIER_MEMORY 
        : PropertyAssignmentPriority.SUPPLY_ADDRESS_MATCH,
      method: bestCandidate.reason,
      requires_manual_assignment: false,
      candidates
    };
  }
  
  // If we have multiple candidates with similar confidence, require manual assignment
  if (candidates.length >= 2 && 
      Math.abs(candidates[0].confidence - candidates[1].confidence) < 0.1) {
    return {
      property_id: null,
      confidence: 0,
      priority: PropertyAssignmentPriority.NEEDS_ASSIGNMENT,
      method: 'ambiguous_candidates',
      requires_manual_assignment: true,
      candidates
    };
  }
  
  // No candidates found - require manual assignment
  return {
    property_id: null,
    confidence: 0,
    priority: PropertyAssignmentPriority.NEEDS_ASSIGNMENT,
    method: 'no_candidates',
    requires_manual_assignment: true,
    candidates: []
  };
}

/**
 * Validate property assignment
 */
export function validatePropertyAssignment(
  property_id: string | null,
  availableProperties: Property[]
): boolean {
  if (!property_id) return false;
  return availableProperties.some(p => p.id?.toString() === property_id);
}

/**
 * Get property display name for UI
 */
export function getPropertyDisplayName(
  property_id: string,
  availableProperties: Property[]
): string {
  const property = availableProperties.find(p => p.id?.toString() === property_id);
  return property ? property.alias : `Inmueble ${property_id}`;
}