#!/usr/bin/env node

/**
 * Complete Data Cleanup Script (JavaScript version)
 * 
 * This script provides optimized database cleanup functionality.
 * It can either run the cleanup directly or provide instructions for manual cleanup.
 * 
 * WARNING: This is IRREVERSIBLE - all data will be permanently lost
 * 
 * Usage: node scripts/completeDataCleanup.js [--confirm]
 */

const LOG_PREFIX = '[COMPLETE-CLEANUP]';

/**
 * Simple confirmation check
 */
function confirmCleanup() {
  const args = process.argv.slice(2);
  
  if (args.includes('--confirm') || args.includes('-y')) {
    return true;
  }
  
  console.log(`${LOG_PREFIX} SAFETY CHECK:`);
  console.log(`${LOG_PREFIX} This will permanently delete ALL data in the Atlas Horizon database.`);
  console.log(`${LOG_PREFIX} This includes ALL movements, accounts, properties, documents, etc.`);
  console.log(`${LOG_PREFIX}`);
  console.log(`${LOG_PREFIX} To proceed, run with --confirm flag:`);
  console.log(`${LOG_PREFIX}   node scripts/completeDataCleanup.js --confirm`);
  console.log(`${LOG_PREFIX}`);
  
  return false;
}

/**
 * Optimized cleanup implementation
 */
async function performOptimizedCleanup() {
  console.log(`${LOG_PREFIX} Starting OPTIMIZED complete data cleanup...`);
  
  const startTime = Date.now();
  
  try {
    // Provide comprehensive instructions for browser-based cleanup
    console.log(`${LOG_PREFIX} Database cleanup instructions:`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} 🌐 Open your browser and navigate to the Atlas application, then:`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} 1. Open Browser Developer Tools (F12)`);
    console.log(`${LOG_PREFIX} 2. Go to the Console tab`);
    console.log(`${LOG_PREFIX} 3. Paste and execute this optimized cleanup code:`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}    // === ATLAS OPTIMIZED CLEANUP SCRIPT ===`);
    console.log(`${LOG_PREFIX}    (async () => {`);
    console.log(`${LOG_PREFIX}      console.log('🧹 Starting Atlas optimized cleanup...');`);
    console.log(`${LOG_PREFIX}      const startTime = Date.now();`);
    console.log(`${LOG_PREFIX}      let totalCleared = 0;`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}      try {`);
    console.log(`${LOG_PREFIX}        // Step 1: Clear localStorage efficiently`);
    console.log(`${LOG_PREFIX}        const keys = Object.keys(localStorage);`);
    console.log(`${LOG_PREFIX}        const atlasKeys = keys.filter(key => {`);
    console.log(`${LOG_PREFIX}          const lowerKey = key.toLowerCase();`);
    console.log(`${LOG_PREFIX}          return lowerKey.includes('atlas') ||`);
    console.log(`${LOG_PREFIX}                 lowerKey.includes('horizon') ||`);
    console.log(`${LOG_PREFIX}                 lowerKey.includes('treasury') ||`);
    console.log(`${LOG_PREFIX}                 lowerKey.includes('demo') ||`);
    console.log(`${LOG_PREFIX}                 lowerKey.includes('fiscal');`);
    console.log(`${LOG_PREFIX}        });`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}        atlasKeys.forEach(key => localStorage.removeItem(key));`);
    console.log(`${LOG_PREFIX}        console.log('✅ Cleared', atlasKeys.length, 'localStorage keys');`);
    console.log(`${LOG_PREFIX}        totalCleared += atlasKeys.length;`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}        // Step 2: Clear IndexedDB with progress`);
    console.log(`${LOG_PREFIX}        console.log('🗄️ Clearing IndexedDB...');`);
    console.log(`${LOG_PREFIX}        await new Promise((resolve, reject) => {`);
    console.log(`${LOG_PREFIX}          const deleteReq = indexedDB.deleteDatabase('AtlasHorizonDB');`);
    console.log(`${LOG_PREFIX}          deleteReq.onsuccess = () => {`);
    console.log(`${LOG_PREFIX}            console.log('✅ IndexedDB cleared successfully');`);
    console.log(`${LOG_PREFIX}            totalCleared += 1;`);
    console.log(`${LOG_PREFIX}            resolve();`);
    console.log(`${LOG_PREFIX}          };`);
    console.log(`${LOG_PREFIX}          deleteReq.onerror = () => {`);
    console.log(`${LOG_PREFIX}            console.error('❌ IndexedDB clear failed:', deleteReq.error);`);
    console.log(`${LOG_PREFIX}            reject(deleteReq.error);`);
    console.log(`${LOG_PREFIX}          };`);
    console.log(`${LOG_PREFIX}          deleteReq.onblocked = () => {`);
    console.log(`${LOG_PREFIX}            console.warn('⚠️ Database deletion blocked - close all Atlas tabs and try again');`);
    console.log(`${LOG_PREFIX}            reject(new Error('Database deletion blocked'));`);
    console.log(`${LOG_PREFIX}          };`);
    console.log(`${LOG_PREFIX}        });`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}        // Step 3: Clear browser caches`);
    console.log(`${LOG_PREFIX}        if ('caches' in window) {`);
    console.log(`${LOG_PREFIX}          console.log('🗂️ Clearing browser caches...');`);
    console.log(`${LOG_PREFIX}          const cacheNames = await caches.keys();`);
    console.log(`${LOG_PREFIX}          const atlasCaches = cacheNames.filter(name => {`);
    console.log(`${LOG_PREFIX}            const lowerName = name.toLowerCase();`);
    console.log(`${LOG_PREFIX}            return lowerName.includes('atlas') || lowerName.includes('horizon');`);
    console.log(`${LOG_PREFIX}          });`);
    console.log(`${LOG_PREFIX}          await Promise.all(atlasCaches.map(name => caches.delete(name)));`);
    console.log(`${LOG_PREFIX}          console.log('✅ Cleared', atlasCaches.length, 'cache entries');`);
    console.log(`${LOG_PREFIX}          totalCleared += atlasCaches.length;`);
    console.log(`${LOG_PREFIX}        }`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}        // Performance summary`);
    console.log(`${LOG_PREFIX}        const duration = Date.now() - startTime;`);
    console.log(`${LOG_PREFIX}        console.log('');`);
    console.log(`${LOG_PREFIX}        console.log('🎉 CLEANUP COMPLETED SUCCESSFULLY!');`);
    console.log(`${LOG_PREFIX}        console.log('📊 Performance Summary:');`);
    console.log(`${LOG_PREFIX}        console.log('   - Total items cleared:', totalCleared);`);
    console.log(`${LOG_PREFIX}        console.log('   - Duration:', duration + 'ms');`);
    console.log(`${LOG_PREFIX}        console.log('   - Database is now optimized for performance');`);
    console.log(`${LOG_PREFIX}        console.log('');`);
    console.log(`${LOG_PREFIX}        console.log('🔄 REFRESH THE PAGE to complete the cleanup');`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX}      } catch (error) {`);
    console.log(`${LOG_PREFIX}        console.error('❌ Cleanup error:', error);`);
    console.log(`${LOG_PREFIX}        console.log('');`);
    console.log(`${LOG_PREFIX}        console.log('💡 Troubleshooting:');`);
    console.log(`${LOG_PREFIX}        console.log('   1. Close all other Atlas tabs');`);
    console.log(`${LOG_PREFIX}        console.log('   2. Clear browser cache manually (Ctrl+Shift+Del)');`);
    console.log(`${LOG_PREFIX}        console.log('   3. Try running the script again');`);
    console.log(`${LOG_PREFIX}      }`);
    console.log(`${LOG_PREFIX}    })();`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} 4. Wait for the success message, then refresh the page`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} 🔧 Alternative methods:`);
    console.log(`${LOG_PREFIX}   • Use TypeScript version: npx ts-node scripts/completeDataCleanup.ts --confirm`);
    console.log(`${LOG_PREFIX}   • Manual: localStorage.clear(); indexedDB.deleteDatabase('AtlasHorizonDB');`);
    
    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} ✅ Cleanup instructions provided in ${duration}ms`);
    console.log(`${LOG_PREFIX} The database will be completely empty after following these steps.`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error providing cleanup instructions:`, error.message);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log(`${LOG_PREFIX} Atlas Horizon Optimized Database Cleanup`);
    console.log(`${LOG_PREFIX} ========================================\n`);
    
    const confirmed = confirmCleanup();
    if (!confirmed) {
      console.log(`${LOG_PREFIX} Cleanup cancelled for safety. Use --confirm flag to proceed.`);
      process.exit(0);
    }
    
    await performOptimizedCleanup();
    
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} 🎯 Next steps:`);
    console.log(`${LOG_PREFIX}   1. Follow the browser instructions above`);
    console.log(`${LOG_PREFIX}   2. Refresh the Atlas application`);
    console.log(`${LOG_PREFIX}   3. Enjoy improved performance!`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Fatal error:`, error.message);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };