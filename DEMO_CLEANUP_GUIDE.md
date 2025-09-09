# Demo Data Cleanup Guide

This guide explains how to clean up demo data from Atlas Horizon and prevent future demo data creation.

## Quick Start

### Run Cleanup Script

```bash
# Show help and instructions
node scripts/cleanupDemoData.js

# Run simulation to see what would be cleaned
node scripts/cleanupDemoData.js --simulate

# For the actual cleanup (when integrated with database):
# Import the TypeScript function in your application
import { cleanupDemoData } from './scripts/cleanupDemoData';
await cleanupDemoData();
```

### Environment Configuration

Ensure demo mode is disabled in production:

```bash
# In .env or environment variables
REACT_APP_DEMO_MODE=false  # Always false in production
```

## What Gets Cleaned Up

### 1. Demo Movements
- Movements with descriptions containing: `demo`, `test`, `sample`
- Movements with demo patterns in counterparty names
- Manual movements with demo characteristics

### 2. Orphaned Movements
- Movements linked to accounts that no longer exist
- Broken foreign key relationships

### 3. Demo Accounts
- Accounts with names containing: `demo`, `test`, `sample`, `ejemplo`
- Accounts with demo bank names
- Accounts with demo IBAN patterns (containing: `9999`, `0000`, `1111`)
- Deleted accounts with demo patterns

### 4. Balance Recalculation
- Recalculates balances for all remaining accounts
- Updates account metadata with cleanup timestamp

## Prevention Measures

### 1. Environment Flag Control
- `APP_DEMO_MODE=false` prevents demo data creation
- Default is `false` for production safety
- Only enable for development/testing when needed

### 2. Import Validation
- Bank statement imports reject demo movements
- Account validation prevents demo account selection
- Clear error messages for rejected data

### 3. UI Filtering
- Account selectors show only real accounts
- Demo accounts hidden unless demo mode enabled
- Inactive/deleted accounts require explicit toggle

## Script Features

### Idempotent Execution
- Safe to run multiple times
- No data corruption on repeated runs
- Handles empty database gracefully

### Comprehensive Logging
```
[CLEANUP-DEMO] Starting demo data cleanup...
[CLEANUP-DEMO] Found 150 accounts and 5,430 movements
[CLEANUP-DEMO] Marking movement 234 for deletion (demo description): Demo payment for testing
[CLEANUP-DEMO] Marking account 45 for deletion (demo account name): Demo Test Account
[CLEANUP-DEMO] Deleted 12 movements
[CLEANUP-DEMO] Deleted 3 accounts
[CLEANUP-DEMO] Recalculated balance for account 1: 2,456.78 EUR

==================================================
[CLEANUP-DEMO] CLEANUP RESULTS
==================================================
Demo movements deleted: 8
Orphaned movements deleted: 4
Demo accounts deleted: 3
Accounts recalculated: 147
Errors encountered: 0
==================================================
```

### Error Handling
- Graceful handling of database errors
- Continues processing on individual failures
- Detailed error reporting and statistics

## Integration Guide

### Frontend Integration

```typescript
import { cleanupDemoData } from './scripts/cleanupDemoData';
import { isDemoModeEnabled } from './config/envFlags';

// In an admin panel or maintenance section
const handleCleanup = async () => {
  if (isDemoModeEnabled()) {
    alert('Cannot cleanup while demo mode is enabled');
    return;
  }
  
  const stats = await cleanupDemoData();
  console.log('Cleanup completed:', stats);
};
```

### Account Filtering

```typescript
import { filterAccountsForUI, getSafeAccountList } from './services/accountValidationService';

// In account selector components
const [accounts, setAccounts] = useState([]);

useEffect(() => {
  loadAccounts();
}, []);

const loadAccounts = async () => {
  const allAccounts = await db.getAll('accounts');
  const { accounts: safeAccounts } = await getSafeAccountList(allAccounts);
  setAccounts(safeAccounts);
};
```

### Movement Validation

```typescript
import { validateAccountForMovements } from './services/accountValidationService';

// Before creating movements
const validation = validateAccountForMovements(account);
if (!validation.valid) {
  throw new Error(validation.error);
}
```

## Testing

### Run Tests

```bash
# Test cleanup functionality
npm test -- --testPathPattern="cleanupDemoData"

# Test account validation
npm test -- --testPathPattern="accountValidation"

# Test bank import demo prevention
npm test -- --testPathPattern="bankImportDemo"
```

### Test Coverage
- ✅ Demo account detection patterns
- ✅ Demo movement identification
- ✅ Orphaned data cleanup
- ✅ Idempotent execution
- ✅ Error handling
- ✅ Account validation
- ✅ Import prevention
- ✅ UI filtering

## Security Notes

### Production Safety
- Demo mode disabled by default
- Clear warnings in development logs
- Validation prevents accidental demo data
- Safe cleanup with comprehensive logging

### Data Protection
- No destructive operations without validation
- Backup recommended before cleanup
- Reversible account deactivation vs deletion
- Audit trail in logs

## Troubleshooting

### Common Issues

**Script fails with "Database not found"**
- Ensure application has run and created IndexedDB
- Check browser developer tools for database existence

**Demo data still appears after cleanup**
- Verify demo mode is disabled: `REACT_APP_DEMO_MODE=false`
- Check for new demo patterns not covered by cleanup
- Run cleanup script again (idempotent)

**Accounts missing from selectors**
- Check account validation filters
- Verify accounts are active and not deleted
- Use admin view to see all accounts including inactive

### Support
For issues or questions:
1. Check the demo prevention tests for expected behavior
2. Review cleanup script logs for detailed information
3. Use the simulation mode to preview changes before execution