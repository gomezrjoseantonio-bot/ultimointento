# AUDITORÍA · Por qué `treasuryEvents` está vacío · generadores desconectados

> Fecha · 2026-05-02  
> Hecho confirmado por Jose · DevTools muestra `treasuryEvents` con 0 entradas  
> Repo · main · DB_VERSION 67  
> Tipo · lectura focalizada · NO modifica código

---

## 0 · Contexto y hecho confirmado

Jose ha verificado en producción que `Application > IndexedDB > atlasdb > treasuryEvents`
muestra **"Entradas totales: 0"** pese a tener en el sistema:

- 13 préstamos activos con cuadro de amortización completo
- 15 contratos activos · renta mensual total 7.715 €
- 1 nómina activa · Orange · 117.831 €/anual
- Cuentas bancarias con saldos iniciales conciliados

La auditoría previa `docs/AUDIT-flujos-ingresos-gastos-financiacion-2026-05-02.md`
afirmó "✅ funcional" para los 5 generadores de eventos — pero verificó que el
**código existe**, no que se **invoque** desde los wizards/UI al alta.

Esta auditoría focalizada cierra ese hueco.

---

## 1 · Punto 1 · NominaWizard → generador

### Búsqueda ejecutada

```
find src -name "NominaWizard*"
→ src/pages/GestionPersonal/wizards/NominaWizard.tsx

grep -n "handleSave|nominaService|generateMonthlyForecasts|treasurySync"
```

### Evidencia

**Archivo** · `src/pages/GestionPersonal/wizards/NominaWizard.tsx`

El único punto de guardado es el botón en la línea 891:

```tsx
// NominaWizard.tsx:891
<button onClick={handleSave} ...>
  {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar nómina'}
</button>
```

`handleSave` se define en la línea 345:

```tsx
// NominaWizard.tsx:345-433
const handleSave = useCallback(async () => {
  // ... construye nominaData ...
  if (isEditing && nominaId) {
    await nominaService.updateNomina(nominaId, nominaData);  // línea 423
  } else {
    await nominaService.saveNomina(nominaData);              // línea 425
  }
  navigate('/gestion/personal');
}, [...]);
```

`nominaService.saveNomina()` en `src/services/nominaService.ts:165-191` hace:

```typescript
// nominaService.ts:165-191
async saveNomina(...): Promise<Nomina> {
  // ... persiste en store 'nominas' ...
  // V4.3: Invalidate fiscal/treasury caches so IRPF and projections refresh
  invalidateCachedStores(['nominas', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']); // línea 184
  return newNomina;
}
```

`invalidateCachedStores` limpia únicamente la caché en memoria del store
`treasuryEvents`. **No escribe ningún evento en el store.**

### Call sites de `generateMonthlyForecasts`

```
grep -rn "generateMonthlyForecasts" src/
```

| Archivo | Línea | Contexto |
|---|---|---|
| `src/components/treasury/TreasuryReconciliationView.tsx` | 285 | Click manual del usuario |
| `src/components/treasury/TesoreriaV4.tsx` | 464 | Click manual del usuario |
| `src/modules/horizon/tesoreria/services/treasurySyncService.ts` | 140 | Definición de la función |

**Conclusión Punto 1:** ❌ NominaWizard NO invoca generador de eventos al guardar.
`nominaService.saveNomina()` solo persiste la nómina e invalida caché.
`generateMonthlyForecasts` solo se ejecuta cuando el usuario hace click manual
en la vista de Tesorería.

---

## 2 · Punto 2 · Prestamos → generador

### Búsqueda ejecutada

```
find src -name "PrestamosWizard*"
→ src/modules/horizon/financiacion/components/PrestamosWizard.tsx

grep -n "handleSubmit|createPrestamo|treasurySync|treasuryEvent"
```

### Evidencia

**Archivo** · `src/modules/horizon/financiacion/components/PrestamosWizard.tsx`

El punto de guardado es `handleSubmit`:

```tsx
// PrestamosWizard.tsx:243-272
const handleSubmit = async () => {
  // ...
  const created = await prestamosService.createPrestamo(mapped);  // línea 260
  if (created && new Date(formData.fechaFirma as string) < new Date()) {
    await prestamosService.autoMarcarCuotasPagadas(created.id);
  }
  onSuccess();
};
```

`prestamosService.createPrestamo()` en `src/services/prestamosService.ts:280-319`:

```typescript
// prestamosService.ts:280-319
async createPrestamo(prestamoData): Promise<Prestamo> {
  // ... persiste en storage ...
  // AUTO-GENERATE AND PERSIST AMORTIZATION SCHEDULE ON SAVE
  const paymentPlan = prestamosCalculationService.generatePaymentSchedule(prestamo);
  // ... marca cuotas pasadas como pagadas ...
  await this.savePaymentPlan(prestamo.id, paymentPlan);
  return prestamo;  // línea 318 · fin — sin llamada a treasury
}
```

`createPrestamo` genera el cuadro de amortización en `paymentPlans` pero
**no escribe en `treasuryEvents`**.

Los eventos de cuota están implementados dentro de
`generateMonthlyForecasts` en `treasurySyncService.ts:511-582`:

```typescript
// treasurySyncService.ts:570-582
await insertEvent({
  type: 'expense' as const,
  sourceType,             // 'prestamo' o 'hipoteca'
  prestamoId: prestamo.id,
  numeroCuota: currentPeriodo?.periodo,
  // ...
});
```

Pero `generateMonthlyForecasts` **no se llama** desde `createPrestamo` ni desde
el wizard.

**Conclusión Punto 2:** ❌ PrestamosWizard NO genera eventos en `treasuryEvents`
al crear el préstamo. El generador de cuotas existe y está implementado en
`treasurySyncService.ts` pero solo se ejecuta cuando el usuario lanza
manualmente "Generar previsiones" en la UI de Tesorería.

---

## 3 · Punto 3 · Contrato → generador

### Búsqueda ejecutada

```
find src -name "*ContratoWizard*"
→ src/modules/inmuebles/wizards/NuevoContratoWizard.tsx

grep -rn "generateIncomeFromContract|treasuryCreation" src/
grep -rn "saveContract|createContract" src/services/
```

### Evidencia

**Archivo** · `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx`

El wizard tiene 5 pasos (`donde` | `inquilino` | `economico` | `documentos` | `firma`).
El único handler de guardado es `handleNext`:

```tsx
// NuevoContratoWizard.tsx:104-118
const handleNext = () => {
  if (!canAdvance) { showToastV5('Completa los campos...', 'warn'); return; }
  if (isLast) {
    showToastV5(
      `Contrato generado · ${form.inquilinoNombre} ${form.inquilinoApellidos}`,
      'success',
    );
    navigate('/contratos');  // línea 114 · FIN — sin ningún db.add / serviceCall
    return;
  }
  setStep(steps[stepIndex + 1].key);
};
```

Los imports del archivo son:

```tsx
// NuevoContratoWizard.tsx:1-12
import React, { useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { PageHead, WizardStepper, MoneyValue, DateLabel, Icons, showToastV5 }
  from '../../../design-system/v5';
import type { InmueblesOutletContext } from '../InmueblesContext';
import styles from './NuevoContratoWizard.module.css';
```

**No importa ningún servicio**. Al pulsar "Crear contrato" el wizard
muestra un toast de éxito y navega — sin escribir nada en IndexedDB.

**Nota adicional sobre `contractService.saveContract`:**  
`contractService.ts:72` sí persiste contratos y llama `generateRentaMensual`
(línea 105). Pero `generateRentaMensual` es un **stub vacío**:

```typescript
// contractService.ts:208-210
export const generateRentaMensual = async (
  _contratoId: number,
  _contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  // rentaMensual store eliminated in V62 — historic data in contract.historicoRentas[]
};
```

`generateIncomeFromContract` en `src/services/treasuryCreationService.ts:32`
escribe en el store `ingresos`, **no en `treasuryEvents`**, y tampoco la
invoca ningún wizard.

Los 15 contratos activos que Jose confirma fueron creados vía
`declaracionOnboardingService` o `contractsImportService` — no desde el
wizard `NuevoContratoWizard`.

**Conclusión Punto 3:** ❌ El wizard `NuevoContratoWizard` NO persiste el
contrato en DB en absoluto (la llamada a servicios está ausente). Incluso
por la vía `contractService.saveContract`, `generateRentaMensual` es un
no-op desde V62 y `generateIncomeFromContract` escribe en `ingresos`, no
en `treasuryEvents`.

---

## 4 · Punto 4 · ViviendaHabitual → generador

### Búsqueda ejecutada

```
grep -rn "guardarVivienda|viviendaHabitualService" src/ (no tests, no service)
find src -name "*Vivienda*" | grep -i "page|wizard|form|component"
→ src/modules/personal/pages/ViviendaPage.tsx
```

### Evidencia

**Archivo** · `src/services/personal/viviendaHabitualService.ts`

`guardarVivienda()` sí invoca `regenerarEventosVivienda()` internamente:

```typescript
// viviendaHabitualService.ts:55-97
export async function guardarVivienda(vivienda): Promise<ViviendaHabitual> {
  // ... persiste en store 'viviendaHabitual' ...
  // Regenerar eventos
  await regenerarEventosVivienda(saved);  // línea 95
  return saved;
}
```

`regenerarEventosVivienda()` en `viviendaHabitualService.ts:437-456` borra
eventos previstos existentes y escribe los nuevos correctamente en
`treasuryEvents`.

**Sin embargo, ningún componente UI llama a `guardarVivienda`:**

```
grep -rn "guardarVivienda|viviendaHabitualService" src/ (excl. service file y tests)
→ Solo aparece en:
  src/services/personal/index.ts:9  (comentado: //  obtenerViviendaActiva, guardarVivienda,)
  src/services/personal/index.ts:20 (re-export: export * from './viviendaHabitualService')
  src/services/fiscalContextService.ts:31 (importa solo obtenerViviendaActiva)
```

**Archivo** · `src/modules/personal/pages/ViviendaPage.tsx`

La única pantalla de vivienda es una página de navegación con 5 botones
que enlazan a otras secciones (financiación, contratos, etc.). No contiene
ningún formulario ni llamada a `guardarVivienda`:

```tsx
// ViviendaPage.tsx:84-195
const ViviendaPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    // Muestra 5 botones de navegación hacia otras secciones
    // Sin formulario de vivienda, sin llamada a guardarVivienda
  );
};
```

**Conclusión Punto 4:** El servicio está **correctamente implementado** —
`guardarVivienda` llama `regenerarEventosVivienda` que escribe en
`treasuryEvents`. Sin embargo, **ningún componente de la UI llama a
`guardarVivienda`**. Si Jose nunca ha configurado su vivienda habitual, el
store `viviendaHabitual` está vacío y no se generaría ningún evento de
todas formas. Este generador tiene doble problema: la UI no existe para
guardar vivienda, y aunque existiera, debe llamar al servicio (no hacer
`db.put` directo).

---

## 5 · Punto 5 · CompromisosRecurrentes → generador

### Búsqueda ejecutada

```
grep -rn "crearCompromiso|regenerarEventosCompromiso" src/services/personal/compromisosRecurrentesService.ts
grep -rn "crearCompromiso" src/ (excl. service file y tests)
find src -name "*Compromiso*" | grep -i "page|wizard|form"
```

### Evidencia

**Archivo** · `src/services/personal/compromisosRecurrentesService.ts`

`crearCompromiso()` sí invoca `regenerarEventosCompromiso()` internamente
cuando el estado es `'activo'`:

```typescript
// compromisosRecurrentesService.ts:57-81
export async function crearCompromiso(
  datos: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<CompromisoRecurrente> {
  // ... valida, persiste en DB ...
  // Genera eventos en treasuryEvents (regla #1)
  if (creado.estado === 'activo') {
    await regenerarEventosCompromiso(creado);  // línea 77
  }
  return creado;
}
```

`regenerarEventosCompromiso()` (línea 368-391) escribe correctamente en
`treasuryEvents`.

**Callers de `crearCompromiso`** en UI:

```
grep -rn "crearCompromiso" src/ (excl. service file y tests)
→ src/services/compromisoCreationService.ts:191
  (auto-detección desde movimientos bancarios)
→ No existe wizard o formulario manual
```

El único caller es `compromisoCreationService.ts:191`, que es la vía
automática de detección de compromisos desde movimientos bancarios (T9.2).
No existe ningún wizard o formulario donde el usuario cree un compromiso
recurrente manualmente.

**Conclusión Punto 5:** El servicio está **correctamente implementado** —
`crearCompromiso` genera eventos cuando el estado es `'activo'`. Pero solo
se puede invocar via la auto-detección de `compromisoCreationService`, que
requiere tener movimientos bancarios importados y aprobar las sugerencias.
Si Jose no tiene movimientos o no los ha aprobado, los compromisos no
existen y no hay eventos. En cualquier caso, esto no explica la ausencia
de eventos de nómina/préstamo/contrato.

---

## 6 · Punto 6 · Función bootstrap global

### Búsqueda ejecutada

```
grep -rn "regenerateAll|bootstrapTreasury|generateAll|regenerarTesoreria" src/services/
grep -rn "treasuryBootstrap|initializeTreasury|seedTreasury" src/
grep -n "migration_.*treasury|migration_.*forecast|backfill.*treasury" src/services/db.ts
grep -rn "Regenerar|Regenerate forecast|Recalcular previsiones" src/components/ src/modules/
```

### Evidencia

**No existe** función global tipo `regenerateAllForecasts()` que recorra
todos los stores y regenere previsiones en lote.

Sí existen funciones parciales:

| Función | Archivo | Línea | Cobertura |
|---|---|---|---|
| `generateMonthlyForecasts(year, month)` | `treasurySyncService.ts` | 140 | Todos los tipos · 1 mes |
| `regenerateMonthForecast({year, month})` | `treasuryForecastService.ts` | 682 | Rentas/opex/préstamos · 1 mes |
| `regenerarTodosLosEventos()` | `compromisosRecurrentesService.ts` | 392 | Solo compromisos · todos los meses |

**Migration scripts:** No existe ningún migration en `src/services/db.ts`
que popule o bootstrappee `treasuryEvents` al crear los stores (resultado
de `grep -n "migration_.*treasury|backfill"` vacío).

**Botón "Regenerar previsiones" en UI:**

Existe en `src/modules/horizon/conciliacion/v2/components/ConciliacionHeader.tsx:30`:

```tsx
// ConciliacionHeader.tsx:30
{regenerating ? 'Regenerando…' : 'Regenerar previsiones'}
```

Este botón llama a `regenerateMonthForecast` (vía `ConciliacionPageV2.tsx:55`)
que solo regenera **el mes activo** y solo cubre rentas/opex/préstamos.
No cubre nóminas, vivienda habitual ni los meses pasados o futuros.

**Conclusión Punto 6:**
- **Función global `regenerateAllForecasts()`:** ❌ No localizada
- **Migration script que bootstrappee `treasuryEvents`:** ❌ No localizado
- **Botón "Regenerar previsiones" retroactivo multi-fuente multi-mes:** ❌ No localizado.
  El botón existente en ConciliacionPageV2 es mono-mes y cubre solo 3 tipos (rentas/opex/préstamos)

---

## 7 · Diagnóstico · tabla resumen

| Generador | Servicio existe | Wizard/UI lo invoca | Hueco |
|---|---|---|---|
| **Nómina** | ✅ `treasurySyncService.generateMonthlyForecasts` procesa nóminas activas | ❌ `NominaWizard` llama `nominaService.saveNomina()` que solo invalida caché; no invoca el generador | El generador existe pero solo se activa manualmente desde la UI de Tesorería. Todas las nóminas dadas de alta antes de que el usuario pulsara "Generar" están sin eventos |
| **Préstamo (cuotas)** | ✅ `treasurySyncService.generateMonthlyForecasts` genera cuotas con `prestamoId` + `numeroCuota` | ❌ `PrestamosWizard` llama `prestamosService.createPrestamo()` que genera el cuadro de amortización pero no llama al generador de `treasuryEvents` | Mismo problema que nómina. Los 13 préstamos no tienen eventos porque nunca se ejecutó el generador manual |
| **Contrato (rentas)** | ✅ `treasurySyncService.generateMonthlyForecasts` genera eventos `sourceType='contrato'` | ❌ `NuevoContratoWizard` no importa ningún servicio — al pulsar "Crear contrato" solo muestra un toast y navega sin escribir en DB. `contractService.saveContract` tiene `generateRentaMensual` pero es un stub vacío (V62) | Doble fallo: (1) el wizard no persiste nada, (2) incluso la vía `saveContract` no genera `treasuryEvents` |
| **Vivienda habitual** | ✅ `guardarVivienda()` llama `regenerarEventosVivienda()` que escribe en `treasuryEvents` | ❌ Ningún componente UI llama `guardarVivienda()`. `ViviendaPage.tsx` es solo una página de navegación sin formulario | La UI que permitiría al usuario guardar su vivienda habitual y disparar el generador no existe o no está conectada al servicio |
| **Compromisos recurrentes** | ✅ `crearCompromiso()` llama `regenerarEventosCompromiso()` correctamente | ⚠️ No existe wizard/formulario manual. Solo se invocan desde `compromisoCreationService` (auto-detección de movimientos bancarios) | Correcto por diseño si el flujo es auto-detección, pero si no hay movimientos importados no hay compromisos ni eventos |

**Diagnóstico global:** Los 5 generadores de eventos tienen el código de
generación implementado. El problema es que **ninguno de los wizards
principales** (NominaWizard, PrestamosWizard, NuevoContratoWizard) llama
al generador al guardar. Dos servicios adicionales (vivienda habitual,
compromisos recurrentes) sí llaman al generador desde su propio código
CRUD — pero sus UIs no llaman al servicio de forma correcta o no tienen UI.

La consecuencia es que `treasuryEvents` solo se puebla cuando el usuario
hace click manual en "Generar previsiones" en la vista de Tesorería para
un mes concreto — y solo si lo hace **después** de dar de alta los datos.
Los 13 préstamos, 15 contratos y 1 nómina se dieron de alta sin que el
usuario hubiera pulsado ese botón para los meses relevantes.

---

## 8 · Propuesta · Vía A · cablear wizards

Por cada generador desconectado, lo que habría que modificar:

### A.1 · NominaWizard

- **Wizard a modificar:** `src/pages/GestionPersonal/wizards/NominaWizard.tsx`
- **Punto de invocación:** Después de `await nominaService.saveNomina(nominaData)` (línea 425) y `updateNomina` (línea 423), añadir llamada al generador
- **Función a invocar:** `generateMonthlyForecasts(year, month)` de `src/modules/horizon/tesoreria/services/treasurySyncService.ts`, ejecutada para los próximos N meses
- **Estimación esfuerzo:** 1-2h
- **Riesgo:** Usuarios con nóminas ya guardadas tienen 0 eventos — los datos pasados seguirán sin eventos (ver Vía B para retroactivo)

### A.2 · PrestamosWizard

- **Wizard a modificar:** `src/modules/horizon/financiacion/components/PrestamosWizard.tsx`
- **Punto de invocación:** Después de `prestamosService.createPrestamo(mapped)` (línea 260) y `updatePrestamo` (línea 255)
- **Función a invocar:** `generateMonthlyForecasts(year, month)` para los meses del horizonte de previsión
- **Estimación esfuerzo:** 1-2h
- **Riesgo:** Mismo que A.1 — datos pre-fix sin eventos

### A.3 · NuevoContratoWizard

- **Wizard a modificar:** `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx`
- **Punto de invocación:** `handleNext` cuando `isLast === true`, antes del `navigate('/contratos')`
- **Función a invocar:** Primero hay que llamar a `contractService.saveContract(...)` (actualmente ausente), y después al generador. El generador de contratos es `generateMonthlyForecasts(year, month)` (cubre `sourceType='contrato'`)
- **Estimación esfuerzo:** 3-4h (requiere primero implementar el guardado del contrato, que actualmente no existe)
- **Riesgo:** Mayor que A.1/A.2 — el wizard completo no guarda en DB, hay que implementar la capa de servicio

### A.4 · ViviendaHabitual

- **Componente a crear/modificar:** Crear formulario de vivienda habitual que llame a `guardarVivienda()`
- **Función a invocar:** `guardarVivienda()` de `src/services/personal/viviendaHabitualService.ts` (ya llama internamente a `regenerarEventosVivienda`)
- **Estimación esfuerzo:** 4-6h (requiere crear UI)
- **Riesgo:** Bajo una vez que existe la UI — el servicio ya está correctamente implementado

### A.5 · CompromisosRecurrentes

- **Estado actual:** `crearCompromiso()` ya genera eventos correctamente. El flujo de auto-detección ya está cableado
- **Si se quiere formulario manual:** Crear wizard/modal de "nuevo compromiso" que llame a `crearCompromiso()`
- **Estimación esfuerzo:** 2-3h
- **Riesgo:** Bajo — el servicio ya valida, persiste y genera eventos

### Nota común a toda la Vía A

La Vía A **no resuelve** los datos pasados: los 13 préstamos, 15 contratos y
1 nómina ya guardados no tendrán eventos aunque se cablee el wizard. Para
los datos existentes es necesaria la Vía B (bootstrap retroactivo) o que
el usuario pulse manualmente "Generar previsiones" mes a mes.

---

## 9 · Propuesta · Vía B · bootstrap retroactivo

### Función propuesta

```
regenerateAllTreasuryForecasts(
  desde: Date,
  hasta: Date
): Promise<{ created: number; skipped: number; errors: string[] }>
```

### Pasos lógicos (sin implementar)

1. Calcular el rango de meses entre `desde` y `hasta` (ej. últimos 24 meses + próximos 12)
2. Para cada mes del rango, llamar a `generateMonthlyForecasts(year, month)` de `treasurySyncService.ts`
   - Esta función ya cubre: nóminas, otros ingresos, contratos, autónomo, préstamos/hipotecas, inversiones
   - Ya tiene idempotencia interna: si el evento existe y está `confirmed`, lo salta
3. Adicionalmente, para vivienda habitual y compromisos recurrentes (que no cubre
   `generateMonthlyForecasts`):
   - Leer todos los registros del store `viviendaHabitual` con `activa=true`
   - Por cada uno llamar `regenerarEventosVivienda()` de `viviendaHabitualService.ts`
   - Leer todos los `compromisosRecurrentes` con `estado='activo'`
   - Por cada uno llamar `regenerarEventosCompromiso()` de `compromisosRecurrentesService.ts`
4. Retornar estadísticas de eventos creados, saltados y errores

### Idempotencia

`generateMonthlyForecasts` ya verifica duplicados:

```typescript
// treasurySyncService.ts:155-182 (función isDuplicate + insertEvent)
async function isDuplicate(sourceType, sourceId): Promise<boolean> {
  const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
  const currentMonthEvent = existing.find(
    e => e.sourceType === sourceType && e.predictedDate.startsWith(monthPrefix),
  );
  if (currentMonthEvent?.status === 'confirmed') return true;
  // ...
}
```

Para vivienda y compromisos, `regenerarEventosVivienda` y
`regenerarEventosCompromiso` borran primero los eventos `predicted` y
regeneran, respetando los `confirmed`.

### UI

- **Opción 1:** Botón en Ajustes / Mantenimiento "Regenerar todas las previsiones"
  que abre diálogo de confirmación y rango de fechas
- **Opción 2:** Auto-ejecución al detectar `treasuryEvents` vacío con datos en
  `nominas` + `contracts` + `prestamos`

### Estimación esfuerzo · 6-8h

- 2h: función `regenerateAllTreasuryForecasts` que orqueste el bucle de meses
- 2h: cubrir vivienda y compromisos (que `generateMonthlyForecasts` no procesa)
- 2h: UI (botón + diálogo + feedback de progreso)
- 2h: tests y verificación manual

### Riesgo

- Si el horizonte de generación es fijo (ej. 24 meses desde hoy), los eventos
  de meses más antiguos que el horizonte no se generarán
- Si hay muchos meses × muchas fuentes, el proceso puede ser lento (mitigable
  con progreso visual)
- Re-ejecutar en instalaciones con datos ya confirmados es seguro (los eventos
  `confirmed` se respetan)

---

## 10 · Recomendación

Esta auditoría **no recomienda una sola vía**. Se listan pros y contras para
que Jose decida.

### Pros y contras

| | Vía A · Cablear wizards | Vía B · Bootstrap retroactivo |
|---|---|---|
| **Resuelve datos existentes** | ❌ No (13 préstamos, 15 contratos, 1 nómina ya guardados siguen sin eventos) | ✅ Sí (rellena el pasado) |
| **Resuelve datos futuros** | ✅ Sí (cada alta nueva genera eventos al instante) | ⚠️ Solo si se ejecuta periódicamente o al detectar datos nuevos |
| **Complejidad** | Media — 4 wizards a modificar, uno (NuevoContratoWizard) requiere implementar guardado primero | Media-alta — función de orquestación + UI |
| **Esfuerzo total** | ~10-12h (A.1+A.2+A.3+A.4) | ~6-8h |
| **Riesgo duplicados** | Bajo — idempotencia delegada a `generateMonthlyForecasts` | Bajo — `generateMonthlyForecasts` ya tiene `isDuplicate` |
| **Retroactividad** | ❌ No cubre datos pre-fix | ✅ Cubre cualquier rango de fechas |
| **Independencia** | Cada wizard es independiente — se puede hacer incrementalmente | Todo-o-nada en la primera ejecución |

### Recomendación de combinación (sin elegir por Jose)

Las dos vías son complementarias, no excluyentes:

- **Vía B primero**: bootstrap retroactivo resuelve el estado actual (0 eventos)
  para los 13 préstamos + 15 contratos + 1 nómina existentes
- **Vía A después**: cablear cada wizard garantiza que los datos futuros generen
  eventos en el momento del alta

Jose decide el orden y si implementar ambas o solo una.

---

*Generated by Claude Code (auditoría TreasuryGen-pre) · 2026-05-02*
