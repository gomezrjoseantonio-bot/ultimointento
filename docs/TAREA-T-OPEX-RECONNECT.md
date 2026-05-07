# TAREA CC · T-OPEX-RECONNECT · Reconectar OPEX a compromisosRecurrentes · v1

> **Tipo** · 1 sub-tarea única · 1 PR contra `main` · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **DB** · NO se toca · DB_VERSION sigue **69**
> **Esfuerzo** · 6-8h CC real · 1-2h tu revisión
> **Prioridad** · ALTA · 4 consumidores con regresión silenciosa · cierra deuda técnica T7
> **Predecesor** · T-AUDIT-9 · T-OPEX-INVESTIGATE · T-RECONNECT-1.1 mergeadas · `docs/AUDIT-opex-callers-2026-05-07.md` publicado

---

## 0 · Reglas inviolables

### 0.1 · DB_VERSION sin cambios
Sigue 69 · 40 stores · NO migración · NO crear stores · `compromisosRecurrentes` ya es la fuente.

### 0.2 · Mantener API surface OpexRule
**Decisión Jose Q1 · Opción A · mapping bidireccional.** NO se reescriben los 3 callers ni el `OpexRuleForm`. Se implementan helpers `mapCompromisoToOpexRule` + `mapOpexRuleToCompromiso` y el `opexService` delega al servicio real `compromisosRecurrentesService`.

### 0.3 · Caller 1 con lógica match ampliada
**Decisión Jose Q2 + Q3.** FiscalDashboard considera categoría "registrada" si:
- Existe `compromisoRecurrente` activo con esa categoría · O
- Existe `gastoInmueble` real del ejercicio (casillas relevantes) · O
- Para reparaciones/intereses · existe `prestamo` activo o `mejoraActivo` con tipo='reparacion'

### 0.4 · Eliminar `generateBaseOpexForProperty`
**Decisión Jose Q4.** Marcar deprecated · eliminar el bloque `if (opexRules.length === 0) { await generateBaseOpexForProperty(...) }` del caller 2. La UI ya detecta ausencia y propone "+ categoría" sin necesidad de placeholders.

### 0.5 · Arreglar también `operacionFiscalService.generarOperacionesDesdeRecurrentes`
**Decisión Jose Q5.** Comparte el mismo mapping · `mapCompromisoToOpexRule` ahora será real (NO null) · este flujo se arregla automáticamente por reconexión del mapping. Verificar que genera operaciones reales.

### 0.6 · Auditoría preflight obligatoria
Antes de codear · CC verifica:
- DB_VERSION = 69 · 40 stores
- `docs/AUDIT-opex-callers-2026-05-07.md` existe
- T-RECONNECT-1.1 mergeada · Mi Plan funciona sin banner
- Confirmar que los 4 consumidores siguen como dice el audit:
  - `FiscalDashboard.tsx:22, :133`
  - `InmueblePresupuestoTab.tsx:32-35, :238-241, :475, :497` (ruta real `src/components/inmuebles/InmueblePresupuestoTab.tsx`)
  - `GastosRecurrentesTab.tsx:9, :171, :217, :341` (`src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx`)
  - `operacionFiscalService.ts:177-184` · pasa por `mapCompromisoToOpexRule` (que devuelve null hoy)

### 0.7 · Stop-and-wait
1 PR único contra `main` · NO mergear sin autorización Jose.

---

## 1 · Contexto · cierre de deuda técnica T7

T7 (V60) eliminó el store `opexRules` porque su función la cubría `compromisosRecurrentes`. Pero los callers de `opexService` no se migraron · y el servicio quedó como stub legacy.

**Hoy 4 consumidores aparentan funcionar pero NO persisten datos:**

| Consumidor | Estado actual |
|---|---|
| FiscalDashboard | Chips ámbar siempre · TODAS las categorías aparecen como "faltantes" |
| InmueblePresupuestoTab | "Crear gasto recurrente" parece funcionar pero al recargar desaparece |
| GastosRecurrentesTab | KPIs siempre 0/0€/—/0 · tabla siempre vacía |
| operacionFiscalService | NO genera operaciones fiscales desde recurrentes |

**Tras este PR:** los 4 consumidores funcionan con datos reales de `compromisosRecurrentes`.

---

## 2 · Alcance · 6 piezas

### 2.1 · Implementar mappings bidireccionales en `opexService.ts`

Reescribir `mapCompromisoToOpexRule` (`src/services/opexService.ts:49-51`) · hoy retorna null. Implementar mapeo real:

```typescript
function mapCompromisoToOpexRule(compromiso: CompromisoRecurrente): OpexRule | null {
  if (compromiso.ambito !== 'inmueble') return null;
  if (!compromiso.inmuebleId) return null;
  
  return {
    id: compromiso.id,
    propertyId: compromiso.inmuebleId,
    activo: compromiso.estado === 'activo',
    categoria: mapTipoToCategoria(compromiso.tipo, compromiso.categoria),
    concepto: compromiso.concepto || compromiso.nombre,
    importeEstimado: compromiso.importeEstimado,
    frecuencia: compromiso.frecuencia,
    diaCobro: compromiso.diaCobro,
    mesInicio: compromiso.mesInicio,
    mesesCobro: compromiso.mesesCobro,
    asymmetricPayments: compromiso.asymmetricPayments,
    accountId: compromiso.accountId,
    createdAt: compromiso.createdAt,
    updatedAt: compromiso.updatedAt,
  };
}

function mapOpexRuleToCompromiso(rule: OpexRule): Partial<CompromisoRecurrente> {
  return {
    id: rule.id,
    ambito: 'inmueble',
    inmuebleId: rule.propertyId,
    estado: rule.activo ? 'activo' : 'pausado',
    tipo: mapCategoriaToTipo(rule.categoria),
    categoria: mapCategoriaToCategoriaCompromiso(rule.categoria),
    concepto: rule.concepto,
    nombre: rule.concepto,
    importeEstimado: rule.importeEstimado,
    frecuencia: rule.frecuencia,
    diaCobro: rule.diaCobro,
    mesInicio: rule.mesInicio,
    mesesCobro: rule.mesesCobro,
    asymmetricPayments: rule.asymmetricPayments,
    accountId: rule.accountId,
  };
}
```

Helpers `mapTipoToCategoria` y `mapCategoriaToTipo` deben cubrir las 7 categorías del enum `OpexRule.categoria` (`comunidad | impuesto | seguro | suministro | servicio | gestion | otro`) y los 7 valores de `CompromisoRecurrente.tipo` (`suministro | suscripcion | seguro | cuota | comunidad | impuesto | otros`). Si CC encuentra ambigüedad · STOP-REPORT con propuesta concreta.

### 2.2 · Reescribir las 4 funciones CRUD de `opexService`

Las 4 funciones delegan a `compromisosRecurrentesService` (ya validado · idempotente · genera eventos de tesorería automáticos):

```typescript
// src/services/opexService.ts
import {
  listarCompromisos,
  crearCompromiso,
  actualizarCompromiso,
  eliminarCompromiso,
} from './personal/compromisosRecurrentesService';

export async function getOpexRulesForProperty(propertyId: number): Promise<OpexRule[]> {
  const compromisos = await listarCompromisos({
    ambito: 'inmueble',
    inmuebleId: propertyId,
  });
  return compromisos
    .map(mapCompromisoToOpexRule)
    .filter((rule): rule is OpexRule => rule !== null);
}

export async function saveOpexRule(rule: OpexRule): Promise<OpexRule | null> {
  const compromisoData = mapOpexRuleToCompromiso(rule);
  const saved = rule.id
    ? await actualizarCompromiso(rule.id, compromisoData)
    : await crearCompromiso(compromisoData);
  return saved ? mapCompromisoToOpexRule(saved) : null;
}

export async function deleteOpexRule(ruleId: number): Promise<void> {
  await eliminarCompromiso(ruleId);
}

// generateBaseOpexForProperty · MARCAR @deprecated · NO ELIMINAR todavía
// (si elimina export, los imports romperán · marcar como noop documentado)
/** @deprecated · ya no necesario · UI detecta ausencia y propone "+ categoría" */
export async function generateBaseOpexForProperty(propertyId: number): Promise<void> {
  // No-op intencional · ver T-OPEX-RECONNECT
  console.info(
    '[opexService.generateBaseOpexForProperty] deprecated · noop',
    { propertyId }
  );
}
```

### 2.3 · Eliminar callsites de `generateBaseOpexForProperty` en caller 2

`InmueblePresupuestoTab.tsx:240` · eliminar el bloque condicional:

```typescript
// ANTES (eliminar)
if (opexRules.length === 0) {
  await generateBaseOpexForProperty(propertyId);
  opexRules = await getOpexRulesForProperty(propertyId);
}

// DESPUÉS · solo lectura, sin auto-creación
const opexRules = await getOpexRulesForProperty(propertyId);
```

NO eliminar el import (la función queda como deprecated · puede consumirse desde algún sitio inesperado · CC verifica con grep antes de eliminar definitivamente).

### 2.4 · Caller 1 · ampliar lógica match con 3 fuentes adicionales

`FiscalDashboard.tsx:425-427` · la lógica actual:
```typescript
const isRegistered = rules.some((r) => r.activo && cat.match(r));
```

Pasa a:
```typescript
const isRegistered =
  // Fuente 1 · plantilla recurrente activa
  rules.some((r) => r.activo && cat.match(r)) ||
  // Fuente 2 · gasto real del ejercicio en casilla relevante
  hasRealGastoInCategory(propertyId, selectedYear, cat) ||
  // Fuente 3 · solo para Reparaciones e Intereses · prestamo o mejoraActivo
  (cat.id === 'reparaciones' && hasRepairAccess(propertyId, selectedYear)) ||
  (cat.id === 'intereses-hipoteca' && hasActiveLoan(propertyId));
```

Helpers nuevos en `FiscalDashboard.tsx` (o en archivo helper):
- `hasRealGastoInCategory(propertyId, year, category)` · consulta `gastosInmuebleService.getByInmuebleYEjercicio(propertyId, year)` y filtra por casillas:
  - Comunidad · casilla 0114 (V02GCOM)
  - IBI · casilla 0110 (V02TASA · "tributos no estatales")
  - Seguro · casilla 0109 (V02PRIMCONTRA)
  - Suministros · casilla 0113 (V02SERVSUMI)
  - Reparaciones · casilla 0106 (IMP1-3GCEM0)
- `hasActiveLoan(propertyId)` · consulta `prestamos` filtrado por `inmuebleId === propertyId && estado !== 'cancelado'`
- `hasRepairAccess(propertyId, year)` · `gastoInmueble` casilla 0106 OR `mejorasInmuebleService.getPorInmueble(propertyId)` con `tipo === 'reparacion'`

### 2.5 · Verificar `operacionFiscalService.generarOperacionesDesdeRecurrentes`

`src/services/operacionFiscalService.ts:177-184` · pasa por `mapCompromisoToOpexRule`. Como ahora el mapping es real (no null) · este flujo debería empezar a generar operaciones automáticamente.

CC verifica:
- Test manual · ejecutar generación · contar operaciones generadas (>0 si hay compromisos activos)
- Si NO genera tras el mapping arreglado · investigar y reportar (puede haber otro bug en cadena)

### 2.6 · Tests obligatorios

| # | Test | Verifica |
|---|---|---|
| 1 | `getOpexRulesForProperty(propertyId)` con 3 compromisos activos en ese inmueble · devuelve 3 OpexRule | Lectura mapping |
| 2 | `saveOpexRule({...})` con `id` undefined · crea CompromisoRecurrente · `getOpexRulesForProperty` lo encuentra | Escritura crear |
| 3 | `saveOpexRule({...})` con `id` existente · actualiza CompromisoRecurrente · cambios persisten | Escritura actualizar |
| 4 | `deleteOpexRule(id)` · CompromisoRecurrente desaparece · `getOpexRulesForProperty` ya no lo encuentra | Eliminación |
| 5 | `generateBaseOpexForProperty` es noop · NO crea registros · NO falla | Deprecated graceful |
| 6 | Mapping bidireccional · `mapCompromisoToOpexRule(mapOpexRuleToCompromiso(rule))` ≈ rule (campos relevantes) | Idempotencia mapping |
| 7 | FiscalDashboard isRegistered considera `gastoInmueble` real · perfil con gasto pero sin compromiso → categoría registrada | Lógica match Q2 |
| 8 | FiscalDashboard isRegistered considera `prestamo` activo para Intereses · perfil con préstamo sin compromiso → registrada | Lógica match Q3 |
| 9 | `operacionFiscalService.generarOperacionesDesdeRecurrentes` con compromisos activos genera operaciones (NO array vacío) | Cadena reparada |
| 10 | Cero regresión · tests existentes de compromisosRecurrentesService pasan | Cero regresión |

---

## 3 · Verificación post-deploy preview (Jose validará)

1. DB_VERSION = 69 · 40 stores · sin cambios
2. Tests · 10 pasan · `tsc --noEmit` pasa · App arranca sin errores
3. **Caller 1** · FiscalDashboard · entrar a Impuestos · cliente con compromisos en inmuebles · chips reflejan realidad · NO todos en ámbar
4. **Caller 2** · entrar a inmueble · pestaña Presupuesto · crear gasto recurrente · recargar página · gasto persiste · editar funciona · eliminar funciona
5. **Caller 3** · entrar a Gestión inmuebles · pestaña Gastos recurrentes · KPIs reflejan plantillas reales · tabla muestra plantillas · CRUD funciona
6. **operacionFiscalService** · DevTools console · generación operaciones desde recurrentes · log indica >0 operaciones
7. Cero regresión · Tesorería · Personal · Mi Plan · Fiscal · etc. · siguen funcionando idéntico

---

## 4 · Cómo lanzar a CC

```
@CC ejecuta T-OPEX-RECONNECT · Reconectar 4 consumidores OPEX a compromisosRecurrentes
Spec · docs/TAREA-T-OPEX-RECONNECT.md
Predecesor · T-OPEX-INVESTIGATE mergeada · docs/AUDIT-opex-callers-2026-05-07.md publicado · T-RECONNECT-1.1 mergeada

PUNTO DE PARTIDA · auditoría preflight
- DB_VERSION = 69 · 40 stores
- Confirmar que opexService.ts es stub legacy y los 4 consumidores siguen como dice el audit
- 4 consumidores · FiscalDashboard.tsx · InmueblePresupuestoTab.tsx · GastosRecurrentesTab.tsx · operacionFiscalService.ts

ALCANCE · 6 piezas en 1 PR único
1. Implementar mapCompromisoToOpexRule + mapOpexRuleToCompromiso (bidireccional · idempotente)
2. Reescribir 4 funciones CRUD de opexService delegando a compromisosRecurrentesService
3. Eliminar callsites de generateBaseOpexForProperty (caller 2 línea 240) · marcar función como @deprecated noop
4. Caller 1 (FiscalDashboard) · ampliar lógica match · considerar también gastosInmueble del ejercicio + prestamos activos + mejorasInmueble (3 fuentes adicionales según decisiones Jose Q2/Q3)
5. Verificar operacionFiscalService.generarOperacionesDesdeRecurrentes ahora genera operaciones reales (mapping ya no devuelve null)
6. Tests · 10 obligatorios según §2.6 spec

REGLAS INVIOLABLES
- DB_VERSION sin cambios · sigue 69 · 40 stores
- NO crear stores nuevos
- NO migrar datos (compromisosRecurrentes ya tiene los datos)
- NO reescribir OpexRuleForm (Opción A · mantener API surface · decisión Jose Q1)
- Si surge ambigüedad en mapping tipo↔categoria · STOP-REPORT con propuesta
- 1 PR único contra main · stop-and-wait
- NO mergear sin autorización Jose

VERIFICACIÓN AUTOMÁTICA OBLIGATORIA AL FINAL
- DB_VERSION = 69 · 40 stores · sin cambios
- 10 tests pasan · tsc --noEmit pasa · App arranca
- FiscalDashboard chips reflejan realidad (no todos en ámbar) si hay compromisos
- InmueblePresupuestoTab CRUD persiste tras recargar
- GastosRecurrentesTab KPIs y tabla con datos reales
- operacionFiscalService genera operaciones (NO array vacío) si hay compromisos
- Cero regresión otros módulos (Tesorería · Personal · Mi Plan · etc.)

ENTREGA
- 1 PR único contra main
- Título · refactor(opex): T-OPEX-RECONNECT · 4 consumidores delegan a compromisosRecurrentes via mapping
- Descripción · referencia audit T-OPEX-INVESTIGATE · 4 consumidores reconectados · screenshots antes/después de FiscalDashboard chips · plantillas persistiendo · operacionFiscalService generando
- NO mergear · stop-and-wait

TIEMPO ESTIMADO CC real · 6-8h
```

---

## 5 · Después de T-OPEX-RECONNECT · qué viene

| Próximo paso sugerido | Por qué |
|---|---|
| **T-RECONNECT-2 · 3 vistas cierre previsto** | Aunque Mi Plan ya funciona post T-RECONNECT-1.1 · falta clarificar la diferencia entre las 3 vistas (preveo · finalmente · definitivamente) · cada pantalla con su propósito |
| **T-NOMINAS-CLEANUP** | Eliminar botón "Importar nóminas" · NominaManager · nominaAportacionHook · solo limpieza |
| **T-RECONNECT-3 · coherencia patrimonio Panel** | Hallazgos 1.A · 1.B · 1.C · 1.E · arreglar coherencia accounts ACTIVE · campo prestamo canónico · matcher valoraciones · servicio común patrimonioService |

Tras estos · resto del backlog (Necesidades 7 · 8 botón 1-click · 9 UX progresiva A→B · etc.) según prioridad cliente.

---

## 6 · Apunte · regla operativa nueva tras este caso

A partir de ahora · cuando se redacte spec de refactor que ELIMINE store o servicio:
- Sub-tarea 1 · auditar TODOS los callers
- Sub-tarea 2 · adaptar callers (NO solo crear stub temporal)
- Sub-tarea 3 · eliminar el original
- NUNCA cerrar refactor solo con "stub mientras tanto" · es deuda técnica que se olvida

Apuntado en memoria de proyecto.

---

**Fin spec T-OPEX-RECONNECT · cerrar deuda técnica T7 · 4 consumidores reconectados · 1 PR · stop-and-wait.**
