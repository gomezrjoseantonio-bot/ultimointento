# Complete Data Cleanup Guide

This guide provides instructions for performing a **COMPLETE** cleanup of ALL data in the Atlas Horizon database, addressing the requirement to have a completely empty database with no historical data.

## ⚠️ IMPORTANT WARNING

**THIS CLEANUP IS IRREVERSIBLE AND WILL PERMANENTLY DELETE ALL DATA:**
- All bank accounts and movements 
- All properties and real estate data
- All documents and contracts
- All financial records and transactions
- All demo data AND real data
- All user preferences and settings

## Quick Start

### Option 1: NPM Scripts (Recommended)
```bash
# Show safety warning and instructions
npm run cleanup:complete

# Perform actual cleanup (IRREVERSIBLE)
npm run cleanup:complete:confirm
```

### Option 2: Direct Script Execution
```bash
# Show safety warning
node scripts/completeDataCleanup.js

# Perform actual cleanup (IRREVERSIBLE)
node scripts/completeDataCleanup.js --confirm
```

### Option 3: From Browser Console (For Web Interface)
1. Open the application in your browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Run this command:
```javascript
// Method A: Clear database completely
localStorage.clear(); 
indexedDB.deleteDatabase('AtlasHorizonDB'); 
location.reload();

// Method B: Use the application's built-in function (if available)
// This requires the app to be loaded
import { resetAllData } from './src/services/db';
await resetAllData();
```

## What Gets Cleaned

### Database Object Stores (All Cleared)
- ✅ `accounts` - Bank accounts
- ✅ `movements` - Financial movements
- ✅ `properties` - Real estate properties
- ✅ `documents` - Document storage
- ✅ `contracts` - Rental contracts
- ✅ `expenses` & `expensesH5` - Expense records
- ✅ `rentCalendar` & `rentPayments` - Rental data
- ✅ `treasuryEvents` & `treasuryRecommendations` - Treasury data
- ✅ `ingresos`, `gastos`, `capex` - Financial categories
- ✅ `budgets`, `budgetLines` - Budget planning
- ✅ `fiscalSummaries` - Tax summaries
- ✅ `reforms`, `reformLineItems` - Property improvements
- ✅ `importBatches`, `importLogs` - Import history
- ✅ `keyval` - Application configuration
- ✅ And 10+ additional object stores

### Local Storage (All Atlas-Related Items Cleared)
- ✅ `atlas-inbox-documents`
- ✅ `atlas-horizon-settings`
- ✅ `atlas-user-preferences`
- ✅ `classificationRules`
- ✅ `bankProfiles`
- ✅ `demo-mode`
- ✅ `treasury-cache`
- ✅ All items containing "atlas", "horizon", "treasury", or "demo"

## When to Use Complete Cleanup

### ✅ Use This When:
- Starting fresh with a completely empty database
- Removing all demo data AND all real data
- Preparing for new user account creation
- Database corruption or inconsistency issues
- Testing or development environment reset

### ❌ Do NOT Use When:
- You want to keep any existing data
- You only want to remove demo data (use the demo cleanup instead)
- You're unsure about losing data permanently

## Safety Features

### 1. Confirmation Requirement
- Scripts require `--confirm` flag to execute
- No accidental execution possible
- Clear warnings before any action

### 2. Comprehensive Logging
```
[COMPLETE-CLEANUP] Found 27 object stores to clear:
[COMPLETE-CLEANUP]   - accounts: 5 records
[COMPLETE-CLEANUP]   - movements: 150 records
[COMPLETE-CLEANUP]   - properties: 3 records
[COMPLETE-CLEANUP] Total records to be removed: 158
[COMPLETE-CLEANUP] ✅ Complete cleanup SUCCESS!
```

### 3. Error Handling
- Graceful handling of missing stores
- Detailed error reporting
- Verification after cleanup

## Technical Implementation

The complete cleanup uses an enhanced `resetAllData()` function that:

1. **Dynamically discovers all object stores** in the database
2. **Clears every single object store** found
3. **Removes all Atlas-related localStorage items**
4. **Verifies cleanup was successful**
5. **Provides detailed logging and error reporting**

```typescript
// Enhanced resetAllData implementation
export const resetAllData = async (): Promise<void> => {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames);
  
  // Clear all stores dynamically
  const tx = db.transaction(storeNames, 'readwrite');
  const clearPromises = storeNames.map(storeName => 
    tx.objectStore(storeName).clear()
  );
  await Promise.all(clearPromises);
  
  // Clear localStorage items
  // ... comprehensive localStorage cleanup
}
```

## Comparison with Demo Cleanup

| Feature | Demo Cleanup | Complete Cleanup |
|---------|--------------|------------------|
| Scope | Demo data only | ALL data |
| Accounts | Demo accounts only | ALL accounts |
| Movements | Demo movements only | ALL movements |
| Properties | Demo properties only | ALL properties |
| Documents | Demo documents only | ALL documents |
| localStorage | Selective | Complete |
| Safety | Moderate | Maximum |
| Use Case | Production cleanup | Fresh start |

## Troubleshooting

### "Database not found" Error
- Ensure the application has been run at least once
- Check that IndexedDB is enabled in your browser
- Try refreshing the page and running again

### Cleanup Doesn't Remove Everything
- Check browser console for error messages
- Ensure you're using the `--confirm` flag
- Try the browser console method as backup

### Permission Errors
- Close all browser tabs with the application
- Clear browser cache and cookies
- Restart browser and try again

## Support

For issues with the complete cleanup:

1. Check the console logs for detailed error messages
2. Verify the safety confirmation flag is used
3. Try alternative cleanup methods (browser console)
4. Contact support with specific error messages

---

**Remember: This cleanup is IRREVERSIBLE. Make sure you want to delete ALL data before proceeding.**