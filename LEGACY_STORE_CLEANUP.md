# Legacy Store Cleanup — References to Remove

**Context:** PR #991 migrated expense data to unified stores (`gastosInmueble`, `mejorasInmueble`, `mueblesInmueble`) with dual-write. Before deleting the legacy stores, ALL runtime references below must be eliminated or redirected to the new stores.

**Target:** Once all references are removed and verified in production, activate store deletion in `db.ts` upgrade handler (v42+ slot reserved).

---

## 1. `fiscalSummaries` (31 references, 11 files)

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/services/fiscalSummaryService.ts` | 117, 131, 245, 265, 266, 296, 297, 337, 363, 368 | getAllFromIndex, put, add, invalidateCache | Rewrite to use `gastosInmueble` aggregation; remove persistence to this store |
| `src/services/declaracionDistributorService.ts` | 843, 864, 890, 923 | getAllFromIndex, put, add, invalidateCache | Already dual-writes to `gastosInmueble`; remove legacy write path |
| `src/services/aeatAmortizationService.ts` | 378, 427, 429 | getAllFromIndex, put, add | Redirect to `gastosInmueble` or inline calculation |
| `src/services/alertasFiscalesService.ts` | 99 | getAllFromIndex | Read from `gastosInmueble` |
| `src/services/rentabilidadInmuebleService.ts` | 85 | getAllFromIndex | Read from `gastosInmueble` |
| `src/services/historicalDataService.ts` | 360 | getAll | Read from `gastosInmueble` |
| `src/services/estimacionFiscalEnCursoService.ts` | 138 | getAllFromIndex | Read from `gastosInmueble` |
| `src/services/fiscalCacheService.ts` | 32 | count | Count from `gastosInmueble` |
| `src/pages/inmuebles/InmueblesAnalisis.tsx` | 1203 | getCachedStoreRecords | Read from `gastosInmueble` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 195 | getCachedStoreRecords | Read from `gastosInmueble` |

### Tests only
| File | Lines |
|------|-------|
| `src/services/fiscalSummaryService.test.ts` | 85, 89 |
| `src/services/__tests__/propertySaleService.test.ts` | 52, 724 |
| `src/services/__tests__/completeDataCleanup.test.ts` | 80 |

### Migration (keep until cleanup done)
| File | Lines |
|------|-------|
| `src/services/migracionGastosService.ts` | 28 |

---

## 2. `operacionesFiscales` (13 references, 3 files)

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/services/operacionFiscalService.ts` | 82, 91, 106, 112, 118, 131, 185, 204, 274, 339 | add, get, put, getAllFromIndex, delete | Already dual-writes to `gastosInmueble`; remove legacy write path and redirect reads |
| `src/services/navigationPerformanceService.ts` | 46 | Prefetch hint string | Update prefetch list |

### Migration (keep until cleanup done)
| File | Lines |
|------|-------|
| `src/services/migracionGastosService.ts` | 139, 140 |

---

## 3. `expensesH5` (11 references, 5 files)

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 90, 214, 232, 236 | getAll, delete, put, add | Already dual-writes to `gastosInmueble`; remove legacy path, read from `gastosInmueble` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ResumenTab.tsx` | 43 | getAll | Read from `gastosInmueble` |
| `src/services/propertyExpenses.ts` | 154 | getAllFromIndex | Read from `gastosInmueble` |
| `src/services/documentFingerprintingService.ts` | 162, 163 | transaction/objectStore | Redirect or remove |

### Tests only
| File | Lines |
|------|-------|
| `src/services/__tests__/propertyExpenses.test.ts` | 18, 71, 94, 130 |
| `src/services/__tests__/completeDataCleanup.test.ts` | 78 |

---

## 4. `gastos` (treasury gastos store — 40+ references, 15+ files)

> **Note:** The string `'gastos'` appears in many non-store contexts (UI labels, section IDs, route paths). Only IDB operations are listed below.

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/services/treasuryCreationService.ts` | 256, 315, 320, 374, 712, 720 | add, get, put, getAll | Redirect to `gastosInmueble` or new treasury store |
| `src/services/treasuryForecastService.ts` | 135, 158 | get | Redirect to `gastosInmueble` |
| `src/services/fiscalConciliationService.ts` | 445 | getAll | Redirect to `gastosInmueble` |
| `src/services/propertyExpenses.ts` | 153 | getAll | Redirect to `gastosInmueble` |
| `src/services/dashboardService.ts` | 953, 1565 | getCachedStoreRecords | Redirect to `gastosInmueble` |
| `src/services/estimacionFiscalEnCursoService.ts` | 77 | getAll | Redirect to `gastosInmueble` |
| `src/services/fiscalCacheService.ts` | 36 | count | Count from `gastosInmueble` |
| `src/services/documentIngestionService.ts` | 164, 396 | add | Redirect to `gastosInmueble` |
| `src/services/enhancedTreasuryCreationService.ts` | 313 | add | Redirect to `gastosInmueble` |
| `src/services/propertySaleService.ts` | 584, 626, 870, 1017, 1120 | getAll, transaction, objectStore, put | Redirect to `gastosInmueble` |
| `src/modules/horizon/inmuebles/gastos/Gastos.tsx` | 55, 116 | getAll, add | Redirect to `gastosInmueble` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 53 | getAll | Redirect to `gastosInmueble` |
| `src/modules/horizon/tesoreria/components/GastosPanel.tsx` | 50, 115 | getAll, add | Redirect to `gastosInmueble` |

### Tests only
| File | Lines |
|------|-------|
| `src/services/__tests__/fiscalConciliationService.test.ts` | 24, 267 |
| `src/services/__tests__/propertyExpenses.test.ts` | 17, 71, 94 |
| `src/services/__tests__/propertySaleService.test.ts` | 50, 381, 426, 439 |
| `src/services/__tests__/completeDataCleanup.test.ts` | 81, 98 |

---

## 5. `reforms` (7 references, 2 files)

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 28, 79, 94, 98, 154, 162 | getAll, delete, put, add, get | Redirect to `mejorasInmueble` with `tipo='mejora'` |

### Schema only
| File | Lines |
|------|-------|
| `src/services/db.ts` | 2100-2104 (createObjectStore) |

---

## 6. `reformLineItems` (5 references, 2 files)

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 73, 75, 114, 328 | getAllFromIndex, delete | Fold into `mejorasInmueble` or create sub-items |

### Schema only
| File | Lines |
|------|-------|
| `src/services/db.ts` | 2107-2112 (createObjectStore) |

---

## 7. `propertyImprovements` (4 references, 3 files)

### Runtime — reads & writes
| File | Lines | Operation | Action needed |
|------|-------|-----------|---------------|
| `src/services/aeatAmortizationService.ts` | 195 | getAllFromIndex | Read from `mejorasInmueble` |
| `src/services/propertyDisposalTaxService.ts` | 127 | getAllFromIndex (with .catch fallback) | Read from `mejorasInmueble` |

### Tests only
| File | Lines |
|------|-------|
| `src/services/aeatAmortizationService.fallback.test.ts` | 75 |
| `src/services/__tests__/propertyDisposalTaxService.test.ts` | 49, 139 |
| `src/services/__tests__/completeDataCleanup.test.ts` | 84 |

---

## Execution order

1. **Phase A** — Remove reads from `propertyImprovements`, `reforms`, `reformLineItems` (smallest scope, ~16 refs)
2. **Phase B** — Remove reads from `expensesH5` and `operacionesFiscales` (~24 refs)
3. **Phase C** — Remove reads from `fiscalSummaries` (~31 refs, most complex — central to fiscal engine)
4. **Phase D** — Remove reads from `gastos` (~40+ refs, touches treasury/dashboard/sale services)
5. **Phase E** — Verify in production, then activate store deletion in db.ts v42+ upgrade
6. **Phase F** — Remove `createObjectStore` blocks and schema entries for deleted stores
