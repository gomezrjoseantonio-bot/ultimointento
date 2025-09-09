/**
 * Demo Data Cleanup Service
 * 
 * Provides secure access to demo data cleanup functionality
 * Only enabled in development/local environments with explicit confirmation
 */

import { FLAGS } from '../config/flags';

// Import the cleanup function from the script
async function importCleanupFunction() {
  try {
    const cleanupModule = await import('../../scripts/cleanupDemoData');
    return cleanupModule.cleanupDemoData;
  } catch (error) {
    console.error('Failed to import cleanup module:', error);
    return null;
  }
}

interface CleanupServiceResult {
  success: boolean;
  message: string;
  stats?: {
    demoMovements: number;
    orphanedMovements: number;
    demoAccounts: number;
    accountsRecalculated: number;
    errors: number;
  };
}

/**
 * Secure cleanup service with environment validation
 */
export class DemoDataCleanupService {
  
  /**
   * Check if cleanup is allowed in current environment
   */
  static isCleanupAllowed(): boolean {
    // Only allow in development/local environments
    const isDev = process.env.NODE_ENV === 'development';
    const isLocalhost = window?.location?.hostname === 'localhost' || 
                       window?.location?.hostname === '127.0.0.1';
    
    // Must be development environment AND localhost
    return isDev && isLocalhost;
  }

  /**
   * Perform demo data cleanup with security checks
   */
  static async performCleanup(confirmationToken?: string): Promise<CleanupServiceResult> {
    // Security check: only allow in dev/local environment
    if (!this.isCleanupAllowed()) {
      return {
        success: false,
        message: 'Cleanup is only allowed in development environment on localhost'
      };
    }

    // If demo mode is enabled, require explicit confirmation
    if (FLAGS.DEMO_MODE && confirmationToken !== 'CONFIRM_CLEANUP_DEMO_DATA') {
      return {
        success: false,
        message: 'Demo mode is enabled. Cleanup requires explicit confirmation token.'
      };
    }

    try {
      console.log('🧹 [CLEANUP] Starting demo data cleanup...');
      
      const cleanupFunction = await importCleanupFunction();
      if (!cleanupFunction) {
        return {
          success: false,
          message: 'Cleanup function not available'
        };
      }

      const stats = await cleanupFunction();
      
      return {
        success: true,
        message: `Cleanup completed successfully. Removed ${stats.demoMovements} demo movements, ${stats.orphanedMovements} orphaned movements, and ${stats.demoAccounts} demo accounts.`,
        stats
      };
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      return {
        success: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Trigger cleanup via URL parameter (for hidden access)
   * Usage: ?cleanup=1 or ?cleanup=confirm
   */
  static async handleURLCleanup(): Promise<boolean> {
    if (!this.isCleanupAllowed()) {
      return false;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const cleanupParam = urlParams.get('cleanup');
    
    if (cleanupParam === '1' || cleanupParam === 'confirm') {
      try {
        const result = await this.performCleanup('CONFIRM_CLEANUP_DEMO_DATA');
        
        if (result.success) {
          alert(`Cleanup completed!\n\n${result.message}`);
          // Remove the parameter from URL
          urlParams.delete('cleanup');
          const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, '', newUrl);
          
          // Reload to reflect changes
          window.location.reload();
        } else {
          alert(`Cleanup failed: ${result.message}`);
        }
        
        return result.success;
      } catch (error) {
        console.error('URL cleanup error:', error);
        alert('Cleanup failed with error - check console');
        return false;
      }
    }
    
    return false;
  }
}

// Auto-trigger cleanup on app startup if URL parameter is present
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    DemoDataCleanupService.handleURLCleanup();
  });
}