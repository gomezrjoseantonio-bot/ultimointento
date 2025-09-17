/**
 * Bank Profile Persistence Service
 * Auto-saves and retrieves bank column mapping profiles by file signature
 */

import { ColumnRole } from './columnRoleDetector';
import { NumberLocale } from './localeDetector';

export interface BankMappingProfile {
  id: string;
  name?: string; // Optional user-friendly name like "MiBanco X v2025"
  signature: {
    headersOrdered: string[]; // Normalized headers in order
    sampleHash: string; // Hash of first N sample rows (for headerless files)
  };
  mapping: {
    dateCol?: number;
    valueDateCol?: number;
    descCol?: number;
    counterpartyCol?: number; // Changed from "proveedor" to "contraparte"
    debitCol?: number;
    creditCol?: number;
    amountCol?: number;
    balanceCol?: number;
    refCol?: number;
    locale: NumberLocale;
    dateFormat: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    usageCount: number;
    lastUsed: string;
    confidence: number; // How well this profile worked
    filePatterns?: string[]; // Optional filename patterns
  };
}

export interface ProfileMatchResult {
  profile: BankMappingProfile;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'pattern';
  reason: string;
}

export interface ProfileCreationData {
  headers: string[];
  sampleRows: any[][];
  mapping: BankMappingProfile['mapping'];
  name?: string;
  filePattern?: string;
}

export class BankProfileService {
  
  private static readonly STORAGE_KEY = 'universal-bank-profiles';
  private static readonly MAX_PROFILES = 50; // Limit storage size
  private static readonly FUZZY_THRESHOLD = 0.9; // Similarity threshold

  /**
   * Find matching profile for headers and sample data
   */
  async findMatchingProfile(
    headers: string[], 
    sampleRows: any[][] = []
  ): Promise<ProfileMatchResult | null> {
    
    const profiles = await this.getAllProfiles();
    const normalizedHeaders = this.normalizeHeaders(headers);
    const sampleHash = this.generateSampleHash(sampleRows);

    // 1. Try exact header match
    for (const profile of profiles) {
      if (this.isExactHeaderMatch(normalizedHeaders, profile.signature.headersOrdered)) {
        await this.updateProfileUsage(profile.id);
        return {
          profile,
          confidence: 0.95,
          matchType: 'exact',
          reason: 'Exact header match found'
        };
      }
    }

    // 2. Try sample hash match (for headerless files)
    if (sampleHash) {
      for (const profile of profiles) {
        if (profile.signature.sampleHash === sampleHash) {
          await this.updateProfileUsage(profile.id);
          return {
            profile,
            confidence: 0.90,
            matchType: 'exact',
            reason: 'Sample data hash match found'
          };
        }
      }
    }

    // 3. Try fuzzy header match
    for (const profile of profiles) {
      const similarity = this.calculateHeaderSimilarity(
        normalizedHeaders, 
        profile.signature.headersOrdered
      );
      
      if (similarity >= BankProfileService.FUZZY_THRESHOLD) {
        await this.updateProfileUsage(profile.id);
        return {
          profile,
          confidence: similarity,
          matchType: 'fuzzy',
          reason: `Headers are ${Math.round(similarity * 100)}% similar`
        };
      }
    }

    return null;
  }

  /**
   * Create and save new bank profile
   */
  async createProfile(data: ProfileCreationData): Promise<string> {
    const profile: BankMappingProfile = {
      id: this.generateProfileId(),
      name: data.name,
      signature: {
        headersOrdered: this.normalizeHeaders(data.headers),
        sampleHash: this.generateSampleHash(data.sampleRows)
      },
      mapping: { ...data.mapping },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 1,
        lastUsed: new Date().toISOString(),
        confidence: 0.8, // Initial confidence
        filePatterns: data.filePattern ? [data.filePattern] : undefined
      }
    };

    await this.saveProfile(profile);
    return profile.id;
  }

  /**
   * Update existing profile
   */
  async updateProfile(
    profileId: string, 
    updates: Partial<BankMappingProfile>
  ): Promise<void> {
    const profiles = await this.getAllProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    
    if (index === -1) {
      throw new Error(`Profile ${profileId} not found`);
    }

    profiles[index] = {
      ...profiles[index],
      ...updates,
      metadata: {
        ...profiles[index].metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString()
      }
    };

    await this.saveAllProfiles(profiles);
  }

  /**
   * Delete profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    const profiles = await this.getAllProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    await this.saveAllProfiles(filtered);
  }

  /**
   * Get all profiles
   */
  async getAllProfiles(): Promise<BankMappingProfile[]> {
    try {
      const stored = localStorage.getItem(BankProfileService.STORAGE_KEY);
      if (!stored) {
        return [];
      }
      
      const profiles = JSON.parse(stored) as BankMappingProfile[];
      
      // Sort by usage and recency
      return profiles.sort((a, b) => {
        const aScore = a.metadata.usageCount * 0.6 + (new Date(a.metadata.lastUsed).getTime() / 1000000) * 0.4;
        const bScore = b.metadata.usageCount * 0.6 + (new Date(b.metadata.lastUsed).getTime() / 1000000) * 0.4;
        return bScore - aScore;
      });
    } catch (error) {
      console.error('Error loading bank profiles:', error);
      return [];
    }
  }

  /**
   * Clean up old profiles (keep only most recent/used)
   */
  async cleanupProfiles(): Promise<void> {
    const profiles = await this.getAllProfiles();
    
    if (profiles.length <= BankProfileService.MAX_PROFILES) {
      return;
    }

    // Keep top profiles by usage and recency
    const toKeep = profiles.slice(0, BankProfileService.MAX_PROFILES);
    await this.saveAllProfiles(toKeep);
  }

  /**
   * Export profiles for backup
   */
  async exportProfiles(): Promise<string> {
    const profiles = await this.getAllProfiles();
    return JSON.stringify(profiles, null, 2);
  }

  /**
   * Import profiles from backup
   */
  async importProfiles(profilesJson: string, merge: boolean = false): Promise<void> {
    const importedProfiles = JSON.parse(profilesJson) as BankMappingProfile[];
    
    if (merge) {
      const existingProfiles = await this.getAllProfiles();
      const existingIds = new Set(existingProfiles.map(p => p.id));
      
      const newProfiles = importedProfiles.filter(p => !existingIds.has(p.id));
      const mergedProfiles = [...existingProfiles, ...newProfiles];
      
      await this.saveAllProfiles(mergedProfiles);
    } else {
      await this.saveAllProfiles(importedProfiles);
    }
  }

  /**
   * Save individual profile
   */
  private async saveProfile(profile: BankMappingProfile): Promise<void> {
    const profiles = await this.getAllProfiles();
    
    // Remove existing profile with same ID
    const filtered = profiles.filter(p => p.id !== profile.id);
    filtered.push(profile);
    
    await this.saveAllProfiles(filtered);
  }

  /**
   * Save all profiles to storage
   */
  private async saveAllProfiles(profiles: BankMappingProfile[]): Promise<void> {
    try {
      localStorage.setItem(BankProfileService.STORAGE_KEY, JSON.stringify(profiles));
      await this.cleanupProfiles();
    } catch (error) {
      console.error('Error saving bank profiles:', error);
      throw new Error('Failed to save bank profiles');
    }
  }

  /**
   * Update profile usage statistics
   */
  private async updateProfileUsage(profileId: string): Promise<void> {
    try {
      const profiles = await this.getAllProfiles();
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        profile.metadata.usageCount++;
        profile.metadata.lastUsed = new Date().toISOString();
        profile.metadata.updatedAt = new Date().toISOString();
        await this.saveAllProfiles(profiles);
      }
    } catch (error) {
      console.warn('Failed to update profile usage:', error);
    }
  }

  /**
   * Generate unique profile ID
   */
  private generateProfileId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `profile_${timestamp}_${random}`;
  }

  /**
   * Normalize headers for comparison
   */
  private normalizeHeaders(headers: string[]): string[] {
    return headers.map(h => 
      h.toLowerCase()
        .trim()
        .replace(/[()]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[áàâä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/ñ/g, 'n')
    );
  }

  /**
   * Generate hash for sample rows
   */
  private generateSampleHash(sampleRows: any[][]): string {
    if (!sampleRows || sampleRows.length === 0) {
      return '';
    }

    // Use first 3 rows for signature
    const signatureRows = sampleRows.slice(0, 3);
    const normalized = signatureRows.map(row => 
      row.map(cell => 
        cell?.toString().toLowerCase().trim() || ''
      ).join('|')
    ).join('||');

    return this.simpleHash(normalized);
  }

  /**
   * Check exact header match
   */
  private isExactHeaderMatch(headers1: string[], headers2: string[]): boolean {
    if (headers1.length !== headers2.length) {
      return false;
    }
    
    return headers1.every((header, index) => header === headers2[index]);
  }

  /**
   * Calculate header similarity (0-1)
   */
  private calculateHeaderSimilarity(headers1: string[], headers2: string[]): number {
    const maxLength = Math.max(headers1.length, headers2.length);
    if (maxLength === 0) return 1;

    let matches = 0;
    const minLength = Math.min(headers1.length, headers2.length);

    // Check positional matches
    for (let i = 0; i < minLength; i++) {
      if (headers1[i] === headers2[i]) {
        matches++;
      } else if (this.isSimilarHeader(headers1[i], headers2[i])) {
        matches += 0.8; // Partial match
      }
    }

    return matches / maxLength;
  }

  /**
   * Check if two headers are similar
   */
  private isSimilarHeader(header1: string, header2: string): boolean {
    // Remove common variations
    const clean1 = header1.replace(/[().,]/g, '').replace(/\s+/g, '');
    const clean2 = header2.replace(/[().,]/g, '').replace(/\s+/g, '');
    
    return clean1.includes(clean2) || clean2.includes(clean1);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export const bankProfileService = new BankProfileService();