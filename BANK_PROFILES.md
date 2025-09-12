# BANK_PROFILES.md

## Bank Statement Import Profiles

This document describes the bank profile system used for parsing different bank statement formats in the ATLAS Treasury system.

### Overview

The system uses bank profiles (located in `/public/assets/bank-profiles.json`) to automatically detect and parse bank statements from different Spanish banks. Each profile contains patterns and rules specific to that bank's export format.

### Santander Profile

#### Format Support
- **File Types**: .xls, .xlsx, .csv
- **Encoding**: UTF-8, Latin-1 auto-detection
- **Decimal Separator**: Comma (,)
- **Thousands Separator**: Period (.)

#### Column Mapping
The Santander profile expects the following columns in the exported file:

| Column Header (Spanish) | Alternative Names | Data Type | Description |
|------------------------|-------------------|-----------|-------------|
| FECHA OPERACION / FECHA OPERACIÓN | fecha, fecha mov, f. operacion | Date | Transaction execution date |
| FECHA VALOR | fecha de valor, f. valor | Date | Value date for accounting |
| IMPORTE EUR / IMPORTE (€) | importe, cantidad, euros | Number | Transaction amount |
| CONCEPTO | descripcion, descripción, detalle | Text | Transaction description |
| SALDO | saldo disponible, saldo actual | Number | Account balance after transaction |

#### Date Formats
- Primary: `dd/mm/yyyy` (e.g., 15/03/2024)
- Alternative: `dd-mm-yyyy` (e.g., 15-03-2024)

#### Amount Handling
- Positive amounts = Credits (income)
- Negative amounts = Debits (expenses)
- Format: `1.234,56` (thousands separator: ., decimal separator: ,)

#### Example File Structure
```
EXTRACTO DE CUENTA
PERIODO: 01/01/2024 - 31/01/2024
IBAN: ES12 3456 7890 1234 5678 90

FECHA OPERACION | FECHA VALOR | CONCEPTO | IMPORTE EUR | SALDO
15/03/2024      | 15/03/2024  | NOMINA EMPRESA XYZ | 2.500,00 | 8.750,45
16/03/2024      | 16/03/2024  | RECIBO LUZ IBERDROLA | -89,32 | 8.661,13
```

### Adding New Bank Profiles

To add support for a new bank:

1. **Analyze Export Format**: Get sample exports and identify column headers and data formats

2. **Create Profile Entry**: Add to `bank-profiles.json`:
```json
{
  "bankKey": "BankName",
  "bankVersion": "2025.01.15",
  "headerAliases": {
    "date": ["fecha", "fecha operacion", "date"],
    "amount": ["importe", "cantidad", "amount"],
    "description": ["concepto", "descripcion", "description"]
  },
  "numberFormat": {
    "decimal": ",",
    "thousand": "."
  },
  "dateHints": ["dd/mm/yyyy"],
  "minScore": 3
}
```

3. **Test Import**: Verify with sample files that:
   - Headers are correctly detected
   - Amounts parse correctly
   - Dates convert properly
   - No demo data is created

### IBAN Detection

The system automatically detects IBAN codes from:
- **Filename**: Patterns like `ES1234567890123456789012`
- **File Headers**: Common IBAN positions in statement headers
- **Account References**: Cross-referencing with existing accounts

### Transfer Detection

Automatic transfer detection looks for keywords:
- `TRASPASO`, `TRANSFERENCIA`, `TRANSFER`
- `ENVÍO ENTRE CUENTAS`, `ENVIO`
- `TRF`, `TSF`

When transfers are detected between accounts in the system, they are automatically paired and marked to avoid double-counting in consolidated views.

### Error Handling

Common import errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "IBAN not found" | Account doesn't exist in system | Create account first or select manually |
| "Format not recognized" | Bank profile missing/incomplete | Update bank profile or use manual mapping |
| "Date parsing failed" | Unexpected date format | Check dateHints in profile |
| "Amount parsing failed" | Different decimal separator | Update numberFormat in profile |

### Validation Rules

The import process validates:
- ✅ No demo data creation
- ✅ IBAN format compliance
- ✅ Duplicate movement detection
- ✅ Amount balance consistency
- ✅ Date range validity

For technical implementation details, see:
- `src/services/enhancedStatementImportService.ts`
- `src/services/bankStatementParser.ts`
- `src/services/bankProfilesService.ts`