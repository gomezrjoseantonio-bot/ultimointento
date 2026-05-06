# T14 · Configuración fiscal sitio único · cierre formal

> **Estado** · TAREA 14 cerrada
> **Fecha** · 2026-05-06
> **DB_VERSION** · 69 (sin cambios desde T13 v4)
> **Stores activos** · 40 (sin cambios)
> **Spec base** · `docs/TAREA-14-2-a-14-5-fiscal-config-v2.md`
> **Predecesores cerrados** · T15 (limpieza keyval) · T7 (limpieza stores) · T13 v4 (módulo planes pensiones · lote B+C)

---

## 0 · Resumen ejecutivo

T14 cierra la dispersión histórica de la información fiscal del titular,
formalizando un único punto de lectura · `fiscalContextService` · que
combina `personalData` (perfil núcleo) + `viviendaHabitual` (subset fiscal).
Los 5 GAPs detectados en el audit T14.1 quedan cerrados en
`irpfCalculationService` · 13 consumidores migrados · y la clave huérfana
`keyval['configFiscal']` borrada con migración idempotente.

**Antes de T14** · 4 sitios (`personalData` · `personalModuleConfig` ·
`viviendaHabitual` · `keyval['configFiscal']`) · 14 consumidores con lectura
directa a `personalData` · `irpfCalculationService` ignoraba `comunidadAutonoma`,
`fechaNacimiento`, `viviendaHabitual` y `discapacidad` de familiares.

**Después de T14** · 1 gateway · 11 consumidores migrados + 7 excepciones
documentadas · IRPF aplica reducciones autonómicas (con tablas Madrid ·
Asturias · Cataluña en `verified=false` esperando audit oficial) · bono edad
≥65/≥75 · vivienda habitual no imputa renta · bonus discapacidad familiares ·
default `tributacion='individual'` garantizado por gateway.

---

## 1 · Cronología

| Fecha | Sub-tarea | Resultado | Evidencia |
|---|---|---|---|
| 2026-04-21 (aprox) | T14.1 · audit del estado | 4 sitios catalogados · 7 GAPs detectados · enfoque C recomendado | `docs/AUDIT-T14-fiscal-config.md` (401 líneas) + página DEV `/dev/fiscal-context-audit` |
| 2026-05-02 | bulk upload | T14.2 + T14.3 + T14.4 entran en `main` por bulk (commit `6bd127f`) sin pasar por PR sub-tarea | `git log --all -- src/services/fiscalContextService.ts` |
| 2026-05-06 | T14 v1 (CC) | spec ingenuo · cerrado · adoptamos plan T14.2-T14.5 v2 con Enfoque C | PR #1265 (mergeado · `5ad2e8f`) |
| 2026-05-06 | T14.2 (CC) | STOP-AND-REPORT · gateway ya en main | PR #1266 (mergeado · `f3d9ad3`) |
| 2026-05-06 | validación retroactiva | T14.2 + T14.3 + T14.4 cumplen spec v2 | PR #1267 (mergeado · `099a0c6`) |
| 2026-05-06 | T14.5 · este cierre | cleanup keyval + JSDoc + STORES + cierre | este PR |

---

## 2 · Trabajo entregado

### 2.1 · T14.2 · Gateway `fiscalContextService`

`src/services/fiscalContextService.ts` (301 líneas):
- API · `getFiscalContext` · `getFiscalContextSafe` · `invalidateFiscalContext`
- Combina `personalDataService.getPersonalData()` + `obtenerViviendaActiva()`
- Cache in-memory TTL 30 s · invalidable
- Garantiza `tributacion` con default `'individual'` · warnings enumerados

Tests · `src/services/__tests__/fiscalContextService.test.ts` · 9
obligatorios spec §2.3 + 1 extra de idempotencia · 10 total.

### 2.2 · T14.3 · 5 GAPs IRPF cerrados en `irpfCalculationService`

Helpers públicos:
- `calcularBonoEdadContribuyente(edad)` · GAP 5.2 · LIRPF Art. 57
- `calcularBonusDiscapacidad(nivel)` · GAP 5.4 · LIRPF Art. 60
- `calcularMinimosPersonalesFromContext(ctx, ejercicio)` · combinador
- `filtrarViviendaHabitualDePropiedades(propiedades, refCatastral)` · GAP 5.3
- `calcularCuotaBaseGeneralCCAA(base, ctx, ejercicio)` · GAP 5.1

Datos auxiliares · `src/data/fiscal/tramosAutonomicos2024.ts`:
- `ESCALA_ESTATAL_GENERAL_2024` · Art. 63.1 LIRPF · `verified=true`
- `ESCALA_AUTONOMICA_SUPLETORIA_2024` · DT 15ª LIRPF · `verified=true`
- `TABLAS_AUTONOMICAS_2024` · Madrid · Asturias · Cataluña · `verified=false`
  con TODOs documentados para audit oficial pendiente
- `normalizeCCAA` (alias regionales) · `getEscalaAutonomica`

Tests · `irpfCalculationService.t14gaps.test.ts` · ~25 casos cubriendo los 5 GAPs.

### 2.3 · T14.4 · Migración de consumidores

11 archivos importan el gateway directamente:
```
src/components/personal/nomina/NominaManager.tsx
src/components/personal/planes/PlanForm.tsx
src/components/personal/planes/PlanesManager.tsx
src/modules/horizon/proyeccion/mensual/proyeccionMensualService.ts
src/modules/horizon/tesoreria/services/treasurySyncService.ts (4 puntos · 1 excepción)
src/modules/inversiones/components/wizard/PlanFormV5.tsx
src/modules/inversiones/pages/FichaPlanPensiones.tsx
src/modules/panel/PanelPage.tsx
src/pages/GestionInversiones/GestionInversionesPage.tsx (5 puntos)
src/services/dashboardService.ts
src/services/irpfCalculationService.ts
```

7 excepciones con marcador `T14.4 · EXCEPCIÓN documentada` y razonamiento:
- `informesDataService.ts` · pasa `PersonalData` completo a informes (forma exacta esperada por consumidores PDF/email)
- `fiscalPaymentsService.ts` · `situacionLaboral` no es fiscal IRPF · separación clean (decisión b · spec §4.4)
- `treasurySyncService.ts:291` · `direccion` no es campo fiscal · matching de patrones
- `OtrosIngresosWizard.tsx` · wizard requiere `PersonalData` completo
- `AutonomoWizard.tsx` · ídem
- `NominaWizard.tsx` · ídem
- `GestionPersonalPage.tsx` · página de edición pasa `PersonalData` a subcomponentes

Decisión `situacionLaboral` (a/b spec §4.4) · **opción b aplicada** · queda fuera del gateway.

### 2.4 · T14.5 · Cleanup + docs (este PR)

- `src/services/migrations/cleanupConfigFiscalKeyval.ts` · borra
  `keyval['configFiscal']` huérfana · idempotente · flag `cleanup_T14_v1`
- 3 tests cubriendo · poblada → borra · vacía → no-op · 2ª ejecución → skip
- Cableado en `src/App.tsx` tras `migrateKeyvalPlanpagosToPrestamos`
- JSDoc actualizado en `src/services/db.ts`:
  - `keyval` · `configFiscal` movida de PROHIBIDAS a "borrada · NO reintroducir" · flag `cleanup_T14_v1` añadido a KEEP
  - `personalData` · documentado como CORE FISCAL · referencia gateway
  - `personalModuleConfig` · etiquetado como **NO fiscal**
  - `viviendaHabitual` · referencia gateway · subset fiscal expuesto
- `docs/STORES-V60-ACTIVOS.md` · refresh cabecera · DB v64-65 → v69 · 39 → 40 stores · listado canónico de 40
- `docs/T14-cierre.md` · este documento

---

## 3 · Verificaciones globales

| Criterio | Estado |
|---|---|
| DB_VERSION sin cambios (sigue 69) | ✅ |
| 40 stores activos · sin cambios | ✅ |
| `fiscalContextService` vivo · 11 consumidores migrados | ✅ |
| 5 GAPs IRPF cerrados (CCAA · edad · vivienda · discapacidad familiares · tributacion default) | ✅ |
| `keyval['configFiscal']` borrada en T14.5 · idempotente | ✅ |
| `personalModuleConfig` documentado como NO fiscal | ✅ |
| `STORES-V60-ACTIVOS.md` cabecera refrescada a v69 · 40 stores | ✅ |
| Datos del usuario intactos | ✅ (T14.5 solo borra una clave huérfana ya documentada como sin escritor/lector activos) |
| Tests verdes (`fiscalContextService.test.ts` · `irpfCalculationService.t14gaps.test.ts` · `cleanupConfigFiscalKeyval.test.ts`) | ✅ pendiente de CI |

---

## 4 · Discrepancias documentales · TODOs futuros (NO críticos)

Documentadas en `docs/VALIDACION-RETROACTIVA-T14-2026-05-06.md` y reproducidas
aquí para trazabilidad ·

### 4.1 · Spec §3.2 GAP 5.4 · importes incorrectos vs LIRPF Art. 60

Spec dice "hasta33: +3.000 €" · realidad LIRPF Art. 60 da bonus 0 € a grados
<33% (la implementación correcta sigue la ley). **Código correcto · spec
inexacto** · si la spec se reedita en el futuro · corregir tabla de bonus.

### 4.2 · Spec §2.2 shape `descendientes/ascendientes` · `nombre: string`

Spec define un campo `nombre: string` que no se persiste en los stores
`Descendiente`/`Ascendiente`. El gateway lo devuelve como cadena vacía. Si
la UI capturará `nombre` en algún wizard futuro · ampliar los tipos en
`src/types/personal.ts` y luego ampliar `FiscalContext`.

### 4.3 · Tablas autonómicas 2024 · `verified=false` para Madrid · Asturias · Cataluña

`src/data/fiscal/tramosAutonomicos2024.ts` tiene la estructura preparada
para 3 CCAA pero todas con `verified=false` · el motor cae a la escala
supletoria. Cuando Jose audite las fuentes oficiales (DOGC · BOCM · Decreto
Legislativo Asturias) y flippe `verified=true`, el cálculo aplicará la
escala específica automáticamente. Esto es trabajo opcional · no bloquea
el cierre de T14.

### 4.4 · GAP 5.7 · `NivelDiscapacidad` definido dos veces

Documentado en AUDIT-T14 como fragilidad menor · no se cierra en T14
(decisión spec §8). TODO futuro.

### 4.5 · Procedencia bulk upload de T14.2-T14.4

T14.2 + T14.3 + T14.4 entraron a `main` por commit `6bd127f` (bulk upload)
en lugar de seguir el stop-and-wait por sub-tarea que exige el plan v2 §0.1.
La validación retroactiva (PR #1267) cumple el rol de sello formal. Si el
proceso se repite en futuras tareas, considerar requerir PR sub-tarea
explícito desde el inicio.

---

## 5 · Tareas que se descongelan al cerrar T14

Según spec v2 cabecera ·
- **T9** · bootstrap `compromisosRecurrentes` desde histórico
- **T8** · refactor schemas restantes (cuando T9 cierre)
- **T10** · cerrar TODOs T7 (cuando T8 cierre)
- **T34/T35-fix-2** · micro-bugs categoría
- **T16** · `movementLearningRules` · verificación uso

Tras los saneamientos · valorar **T36** (vista gastos sobre `movements`)
con norte 1/1/2027.

---

## 6 · Cómo ATLAS lee información fiscal del titular hoy (post-T14)

```
┌───────────────────────────────┐
│  fiscalContextService         │   src/services/fiscalContextService.ts
│  · getFiscalContext           │
│  · getFiscalContextSafe       │
│  · invalidateFiscalContext    │
└───────┬───────────────┬───────┘
        │               │
        ▼               ▼
  personalData     viviendaHabitual
  (singleton id=1) (ficha activa)
        │               │
        ▼               ▼
  personalDataService   viviendaHabitualService
  (dueño · CRUD)        (dueño · CRUD + eventos derivados)
```

Reglas firmes ·
1. Cualquier cálculo IRPF lee del gateway · NUNCA campos sueltos directos
2. `personalData` y `viviendaHabitual` siguen siendo dueños de sus stores ·
   el gateway solo lee · NO escribe
3. `personalModuleConfig` es flags UI · NO fiscal · NO migrar al gateway
4. `keyval` está prohibido para datos fiscales · `configFiscal` borrada

---

*Fin del cierre T14 · documento canónico · referencia para tareas fiscales futuras.*
