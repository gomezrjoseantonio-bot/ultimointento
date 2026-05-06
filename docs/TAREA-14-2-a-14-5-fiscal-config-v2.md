# TAREA CC · TAREA 14.2 a 14.5 · Configuración fiscal sitio único · Enfoque C + cierre gaps · v2 (DB v69)

> **Refresh sobre v1** · cabecera actualizada de DB v65 a v69 · predecesores actualizados (T13 v4 · lote A · lote B+C cerrados) · STORES count actualizado (40 stores · sin cambios respecto a v1) · resto del plan v1 intacto y validado.
>
> **Tipo** · sub-tareas 14.2 · 14.3 · 14.4 · 14.5 · cada una en su PR con STOP-AND-WAIT
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · cada sub-tarea desde `main` actualizado tras la anterior · NO rama madre · NO acumular
>
> **Alcance global** · enfoque C (híbrido) según AUDIT-T14 · crear `fiscalContextService` gateway sobre `personalData` + `viviendaHabitual` · migrar `irpfCalculationService` aplicando los 5 GAPs fiscales detectados · migrar 13 consumidores restantes al gateway · borrar `keyval['configFiscal']` · documentar `personalModuleConfig` como NO fiscal · cerrar T14
>
> **Tiempo estimado total**
> - **CC real** · 2-4h espaciadas · 4 sub-tareas con stop-and-wait
> - **Tu revisión** · 5-8h en total
> - **Horas-humanas equivalentes** · 10-15h
>
> **Prioridad** · MEDIA-ALTA · cierre arquitectónico + bugs fiscales reales que afectan a tu IRPF
>
> **Predecesores cerrados** · T15 ✅ · T14.1 (AUDIT) ✅ · T13 v4 ✅ · T13 lote A ✅ · T13 lote B+C ✅
>
> **DB** · NO se toca · DB_VERSION sigue en **69** · 40 stores · solo limpieza de keyval en 14.5
>
> **Tareas congeladas que se descongelan al cerrar T14** · T9 (compromisosRecurrentes) · T8 (refactor schemas) · T10 (TODOs T7) · T34/T35-fix-2 (micro-bugs categoría) · T16 (movementLearningRules)

---

## 0 · Reglas inviolables (idénticas T17 / T20 / T15)

### 0.1 · STOP-AND-WAIT estricto entre sub-tareas
CC implementa una sub-tarea · publica PR · DETIENE EJECUCIÓN · espera revisión Jose en deploy preview · NO empieza la siguiente hasta merge + autorización. NO acumular en rama madre · cada PR contra `main` directo.

### 0.2 · NO inventar
Si CC encuentra ambigüedad · PARAR · comentar PR · esperar input. Si encuentra bug fuera de scope · documentar TODO · seguir.

### 0.3 · Datos del usuario intactos
T14 no migra ningún dato · solo añade gateway de lectura · adapta consumidores · borra 1 clave huérfana de keyval. Si en algún punto un dato real desaparece · es BUG · revertir.

### 0.4 · Idempotencia
Cualquier limpieza/migración debe ser ejecutable N veces sin efecto secundario.

### 0.5 · Cero hex hardcoded en archivos nuevos
Tokens v5 obligatorios. UI nueva (si la hay) cumple guía v5.

### 0.6 · Auditoría preflight obligatoria por sub-tarea
ANTES de codear cada sub-tarea · CC verifica:
- DB_VERSION actual = 69 (no debe cambiar en ninguna sub-tarea)
- 40 stores activos (no debe cambiar)
- Predecesoras cerradas según indicado en cabecera
- Estado real de los archivos a tocar (no asumir desde la spec · grep antes)

Si la auditoría detecta divergencia · PARAR y reportar.

---

## 1 · Datos verificados del AUDIT-T14 (resumen)

### 1.1 · 14 consumidores de `personalData`
Servicios · `irpfCalculationService` · `fiscalPaymentsService` · `informesDataService` · `dashboardService` · `proyeccionMensualService` · `treasurySyncService` (×5)
Componentes · `NominaManager` · `PlanesManager` · `PlanForm` · `AutonomoWizard` · `NominaWizard` · `OtrosIngresosWizard` · `GestionPersonalPage` · `GestionInversionesPage`

### 1.2 · 5 GAPs fiscales accionables
- **GAP 5.1 CRÍTICO** · `comunidadAutonoma` ignorada por `irpfCalculationService` · reducciones autonómicas no aplicadas
- **GAP 5.2** · `fechaNacimiento` ignorada · bono ≥65/≥75 no calculado (TODO en línea 1028)
- **GAP 5.3** · `viviendaHabitual` no integrada en cálculo IRPF (servicio existe pero `irpfCalculationService` no lo importa)
- **GAP 5.4** · `Descendiente.discapacidad` y `Ascendiente.discapacidad` se almacenan pero no se usan en mínimos
- **GAP 5.6** · `tributacion` opcional sin guard · si vacío puede romper o usar default silencioso

### 1.3 · Hallazgos confirmados (sin acción adicional)
- `keyval['configFiscal']` · huérfano (sin escritor ni lector) · borrar limpia
- `personalModuleConfig` · flags UI no fiscales · NO migra
- `viviendaHabitual` · servicio dedicado completo · cuestión es solo cablearlo a IRPF

---

## 2 · SUB-TAREA 14.2 · Crear `fiscalContextService` gateway

### 2.1 · Alcance

Crear servicio nuevo que centraliza lectura de contexto fiscal del usuario · expone API tipada · NO toca consumidores existentes (eso es 14.4).

### 2.2 · Archivo nuevo · `src/services/fiscalContextService.ts`

#### API pública

```typescript
import type { PersonalData, NivelDiscapacidad, TipoTributacion } from '../types/personal';
import type { ViviendaHabitual, ViviendaHabitualData } from '../types/viviendaHabitual';

export interface FiscalContext {
  // Identidad fiscal
  personalDataId: number;
  nombre: string;
  apellidos: string;
  dni: string;
  
  // Tributación
  tributacion: TipoTributacion;          // garantizado · default 'individual' si null en source
  comunidadAutonoma: string | null;      // null si no informada · UI debe pedirla
  fechaNacimiento: string | null;        // ISO · null si no informada
  edadActual: number | null;             // calculada · null si fechaNacimiento ausente
  
  // Mínimos personales
  descendientes: Array<{
    nombre: string;
    fechaNacimiento: string;
    edadActual: number;
    discapacidad: NivelDiscapacidad;
  }>;
  ascendientes: Array<{
    nombre: string;
    fechaNacimiento: string;
    edadActual: number;
    discapacidad: NivelDiscapacidad;
  }>;
  discapacidadTitular: NivelDiscapacidad;
  
  // Vivienda habitual (subset fiscalmente relevante)
  viviendaHabitual: {
    activa: boolean;
    referenciaCatastral: string | null;
    valorCatastral: number | null;
    porcentajeTitularidad: number | null;
    fechaAdquisicion: string | null;
    precioAdquisicion: number | null;
    gastosAdquisicion: number | null;
    ibiAnual: number | null;
  } | null;
  
  // Metadatos
  fechaActualizacion: string;
  warnings: string[];                     // lista de campos que faltan o son inconsistentes
}

/**
 * Obtiene el contexto fiscal completo del usuario.
 * Combina personalData + viviendaHabitual en un objeto unificado.
 * 
 * Garantías:
 * - tributacion siempre tiene valor (default 'individual')
 * - edades calculadas si fechaNacimiento disponible
 * - viviendaHabitual=null si no hay ficha activa
 * - warnings[] enumera campos críticos faltantes
 * 
 * @throws Error si no hay personalData en el sistema
 */
export async function getFiscalContext(): Promise<FiscalContext>;

/**
 * Versión que tolera ausencia de personalData (devuelve null).
 * Útil para componentes que pueden estar antes del onboarding.
 */
export async function getFiscalContextSafe(): Promise<FiscalContext | null>;

/**
 * Invalida cualquier cache interno · llamar tras escrituras a personalData o viviendaHabitual.
 */
export function invalidateFiscalContext(): void;
```

#### Implementación

1. **Lectura combinada** · `personalDataService.getPersonalData()` + buscar `ViviendaHabitual` activa por `personalDataId` (filtro `activa === true`)
2. **Cálculo de edades** · helper interno `calcularEdad(fechaNacimiento)` · usa fecha actual de sistema · null si fecha ausente
3. **Default `tributacion`** · si null · usar `'individual'` · añadir warning `"tributacion no informada · default individual"`
4. **Warnings** · construir array con todos los campos críticos ausentes · ej · `comunidadAutonoma not informed`, `fechaNacimiento not informed`, `viviendaHabitual not registered`
5. **Cache opcional** · in-memory con TTL 30s · invalidable vía `invalidateFiscalContext()` · NO persistir
6. **Manejo de errores** · si `personalDataService.getPersonalData()` retorna null · `getFiscalContext()` lanza error · `getFiscalContextSafe()` retorna null

### 2.3 · Tests · `src/services/__tests__/fiscalContextService.test.ts`

- Test 1 · personalData completo + vivienda activa · context completo · warnings vacío
- Test 2 · personalData sin `comunidadAutonoma` · context con `comunidadAutonoma=null` · warning correspondiente
- Test 3 · personalData sin `tributacion` · context con `tributacion='individual'` (default) · warning correspondiente
- Test 4 · personalData sin `fechaNacimiento` · `edadActual=null` · warning
- Test 5 · sin vivienda habitual · `viviendaHabitual=null` · warning
- Test 6 · 2 viviendas habituales (1 activa · 1 inactiva) · context lee solo la activa
- Test 7 · descendientes con `fechaNacimiento` · edades calculadas correctamente
- Test 8 · `getFiscalContext()` sin personalData · throws · `getFiscalContextSafe()` retorna null
- Test 9 · cache · 2 llamadas seguidas · 2ª desde cache · `invalidateFiscalContext()` invalida correctamente

### 2.4 · Verificación 14.2

- [ ] DB_VERSION sigue en 69 · 40 stores
- [ ] `tsc --noEmit` pasa
- [ ] Tests pasan
- [ ] App arranca sin errores
- [ ] Cero consumidores nuevos · solo gateway disponible
- [ ] Página `/dev/fiscal-context-audit` (existente desde T14.1) sigue funcionando · invocar gateway nuevo y mostrar context resultante

### 2.5 · PR 14.2

Título · `feat(fiscal): T14.2 · fiscalContextService gateway · sin consumidores`

Descripción · gateway disponible · próxima sub-tarea integra cálculo IRPF · ningún consumidor migrado todavía.

**STOP-AND-WAIT** · publicar PR · Jose valida en deploy preview que la página de audit ahora muestra el contexto desde el gateway · NO arrancar 14.3 hasta merge.

---

## 3 · SUB-TAREA 14.3 · Cerrar 5 GAPs IRPF en `irpfCalculationService`

### 3.1 · Alcance

Modificar `src/services/irpfCalculationService.ts` para usar `fiscalContextService` y cerrar los 5 GAPs fiscales identificados en AUDIT-T14 §5.

### 3.2 · Cambios uno a uno

#### GAP 5.1 · `comunidadAutonoma` → reducciones autonómicas

- Crear helper `getReduccionesAutonomicas(ccaa, ejercicio)` con tabla por CCAA
- **CC investiga fuentes oficiales 2025** · BOE · agencia tributaria autonómica · NO inventa
- Si CC no encuentra fuente para una CCAA · marca TODO con número de la CCAA · cubre las que pueda con fuente
- Aplicar al cálculo · `ctx.comunidadAutonoma` decide tabla · si null · solo estatales

#### GAP 5.2 · `fechaNacimiento` → bono edad

- Reemplazar TODO en línea 1028 (o equivalente actualizado)
- Si `ctx.edadActual >= 65 && ctx.edadActual < 75` · aplicar bono mínimo personal +1.150 €
- Si `ctx.edadActual >= 75` · bono +2.550 € (acumulativo)
- Si `ctx.edadActual === null` · NO aplicar · log warning

#### GAP 5.3 · `viviendaHabitual` → integración cálculo

- Si `ctx.viviendaHabitual !== null && ctx.viviendaHabitual.activa`:
  - Marcar inmueble como vivienda habitual · NO imputa renta
  - Aplicar deducciones autonómicas vivienda habitual si CCAA las tiene (parte de GAP 5.1)
- Si null · todos los inmuebles imputables según régimen normal

#### GAP 5.4 · discapacidad descendientes/ascendientes → mínimos

- Para cada `ctx.descendientes[]` · si `discapacidad !== 'ninguna'` · aplicar bono adicional según nivel:
  - `hasta33` · +3.000 €
  - `entre33y65` · +9.000 €
  - `mas65` · +12.000 €
- Idem `ctx.ascendientes[]`

#### GAP 5.6 · `tributacion` guard

- `fiscalContextService` ya garantiza valor (default `'individual'`) · NO se necesita guard adicional
- Documentar en JSDoc del método de cálculo · "tributacion siempre tiene valor desde gateway"

### 3.3 · Tests · `src/services/__tests__/irpfCalculationService.test.ts`

Crear tests específicos por GAP con casos sintéticos:
- Test GAP 5.1 · usuario en Asturias · cálculo aplica reducción Asturias · vs usuario sin CCAA
- Test GAP 5.2 · usuario 70 años · mínimo personal incluye bono ≥65
- Test GAP 5.3 · usuario con vivienda habitual · NO imputa renta · vs sin vivienda
- Test GAP 5.4 · descendiente con discapacidad `entre33y65` · mínimo descendiente +9.000 €
- Test GAP 5.6 · usuario sin `tributacion` · gateway entrega `'individual'` default · cálculo NO falla

### 3.4 · Verificación 14.3

- [ ] DB_VERSION sigue en 69 · 40 stores
- [ ] `tsc --noEmit` pasa
- [ ] Tests pasan
- [ ] Tu cálculo IRPF en deploy preview con tu personalData real muestra diferencia esperada vs cálculo anterior
- [ ] Cada GAP marcado en checklist con commit hash que lo cierra
- [ ] CCAA · al menos las CCAA principales con fuente oficial citada · resto con TODO documentado

### 3.5 · PR 14.3

Título · `feat(fiscal): T14.3 · 5 GAPs IRPF cerrados · CCAA · edad · vivienda · discapacidad familiar`

Descripción · diff esperado en cálculo (es bug que se cierra · NO regresión) · Jose valida con su declaración real 2024.

**STOP-AND-WAIT** · publicar PR · Jose valida diff de cálculo en deploy preview con su personalData · NO arrancar 14.4 hasta merge.

---

## 4 · SUB-TAREA 14.4 · Migrar 13 consumidores restantes a `fiscalContextService`

### 4.1 · Alcance

Sustituir lecturas directas a `personalDataService.getPersonalData()` por `fiscalContextService.getFiscalContextSafe()` en los 13 consumidores restantes (irpfCalculationService ya migrado en 14.3).

### 4.2 · Lista de los 13 consumidores

**Servicios** (5)
- `fiscalPaymentsService`
- `informesDataService`
- `dashboardService`
- `proyeccionMensualService`
- `treasurySyncService` (5 usos · contar como 1 archivo)

**Componentes** (8)
- `NominaManager`
- `PlanesManager`
- `PlanForm`
- `AutonomoWizard`
- `NominaWizard`
- `OtrosIngresosWizard`
- `GestionPersonalPage`
- `GestionInversionesPage`

### 4.3 · Patrón de migración por consumidor

1. Identificar campos exactos que lee
2. Verificar que `FiscalContext` los expone (si no · ampliar 14.2 retroactivamente · documentar)
3. Sustituir lectura
4. Test existente debe seguir pasando · si cambia · ajustar test con justificación

### 4.4 · Casos especiales

#### `situacionLaboral`
NO está en `FiscalContext` porque es del titular pero no estrictamente fiscal (afecta a obligaciones M130/M303 pero no al cálculo IRPF). Decisión:
- (a) Añadirlo a `FiscalContext` para que sea el único punto de acceso
- (b) Dejar consumidores que solo necesitan `situacionLaboral` leyendo directamente de `personalDataService`

CC propone una de las dos · Jose decide en revisión PR.

#### Componentes que leen `id` solo
Estos son triviales · `getFiscalContextSafe()` y `ctx.personalDataId`. Migración mecánica.

#### `informesDataService` que pasa el objeto entero a un informe
Si el informe espera la forma exacta de `PersonalData`, mantener la lectura directa allí · NO forzar el gateway · documentar como excepción legítima. El gateway no es prescriptivo · es facilidad para los casos de cálculo fiscal.

### 4.5 · Verificación 14.4

- [ ] DB_VERSION sigue en 69 · 40 stores
- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Tests existentes siguen verdes
- [ ] Cero regresión visual ni funcional en módulos afectados
- [ ] Lista de los 13 consumidores · marcado uno a uno · "migrado" o "excepción documentada"
- [ ] Decisión sobre `situacionLaboral` (a/b) tomada y aplicada

### 4.6 · PR 14.4

Título · `refactor(fiscal): T14.4 · 13 consumidores migrados a fiscalContextService`

Descripción · tabla consumidor → estado · excepciones documentadas · decisión `situacionLaboral`.

**STOP-AND-WAIT** · publicar PR · Jose valida en deploy preview que módulos siguen funcionando · NO arrancar 14.5 hasta merge.

---

## 5 · SUB-TAREA 14.5 · Limpieza + cierre + docs

### 5.1 · Alcance

Última sub-tarea · borra `keyval['configFiscal']` huérfana · documenta `personalModuleConfig` como NO fiscal · actualiza JSDoc · cierra TAREA 14.

### 5.2 · Borrar `keyval['configFiscal']`

Análogo a T15.2 · servicio one-shot con flag idempotente · `cleanup_T14_v1`:

```typescript
// src/services/migrations/cleanupConfigFiscalKeyval.ts
const FLAG_KEY = 'cleanup_T14_v1';
export async function cleanupConfigFiscalKeyval(): Promise<{deleted: boolean}> {
  const flag = await db.get('keyval', FLAG_KEY);
  if (flag === 'completed') return { deleted: false };
  
  const exists = await db.get('keyval', 'configFiscal');
  if (exists !== undefined && exists !== null) {
    await db.delete('keyval', 'configFiscal');
  }
  
  await db.put('keyval', 'completed', FLAG_KEY);
  return { deleted: exists !== undefined };
}
```

Invocar desde arranque de App tras `initDB()`. Idempotente · si ya completado · skip silencioso.

### 5.3 · Tests

`src/services/migrations/__tests__/cleanupConfigFiscalKeyval.test.ts`:
- Test · keyval con `configFiscal` poblada · run · borrada · flag escrito · `deleted=true`
- Test · keyval sin `configFiscal` · run · `deleted=false` · flag escrito · idempotente
- Test · 2ª ejecución · skip silencioso · `deleted=false`

### 5.4 · Documentación canónica

#### Actualizar JSDoc en `db.ts`
- Sección `keyval` · eliminar mención a `configFiscal` (ya borrado)
- Sección `personalData` · documentar que es **fuente única de información fiscal del titular** · el agregador es `fiscalContextService`
- Sección `personalModuleConfig` · etiquetar explícitamente como **flags UI · NO contiene información fiscal** · listar campos legítimos
- Sección `viviendaHabitual` · documentar que es ficha del activo · el agregador `fiscalContextService` lee subset fiscalmente relevante

#### Actualizar `docs/STORES-V60-ACTIVOS.md`
- **Refresh cabecera** · DB_VERSION 69 · 40 stores (estaba stale · v64-65 · 39)
- Sección `personalData` · referenciar `fiscalContextService` como gateway
- Sección `personalModuleConfig` · etiquetar como NO fiscal
- Sección `viviendaHabitual` · referenciar gateway
- Sección `keyval` · `configFiscal` ya no aparece en lista canónica (borrada)

#### Crear `docs/T14-cierre.md`
Resumen · 4 sitios pasan a 1 gateway · 5 GAPs IRPF cerrados · 13 consumidores adaptados · `keyval['configFiscal']` purgada · `personalModuleConfig` clarificado como NO fiscal · diff de cálculo IRPF antes/después para tu caso real · TODOs documentados para deducciones autonómicas avanzadas pendientes.

### 5.5 · Verificación 14.5

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores · cleanup ejecutado al primer arranque · skip silencioso en arranques posteriores
- [ ] DevTools · `keyval` ya no contiene `configFiscal`
- [ ] DevTools · `keyval` contiene flag `cleanup_T14_v1='completed'`
- [ ] JSDoc actualizado · STORES-V60-ACTIVOS actualizado (incluyendo refresh cabecera v69) · T14-cierre.md creado
- [ ] Tests verdes
- [ ] DB_VERSION sigue en 69

### 5.6 · PR 14.5

Título · `chore(fiscal): T14.5 · cleanup + docs + cierre · TAREA 14 ✅`

Descripción · keyval purgada · documentación canónica · resumen ejecutivo del bloque T14 completo · 4 sub-tareas cerradas.

**Mergear PR · TAREA 14 cerrada formalmente.**

---

## 6 · Criterios de aceptación globales T14

- [ ] 4 sub-tareas mergeadas en orden con stop-and-wait respetado
- [ ] DB_VERSION sigue en 69 · sin cambios de schema
- [ ] 40 stores activos · sin cambios estructurales
- [ ] `fiscalContextService` vivo · 14 consumidores migrados (con excepciones documentadas)
- [ ] 5 GAPs fiscales cerrados · cálculo IRPF aplica CCAA · edad · discapacidad · vivienda habitual
- [ ] `keyval['configFiscal']` borrada · idempotente
- [ ] `personalModuleConfig` documentado como NO fiscal
- [ ] Documentación canónica actualizada · `T14-cierre.md` publicado · `STORES-V60-ACTIVOS.md` rebaseline a v69
- [ ] Datos del usuario intactos
- [ ] Tu IRPF calculado en deploy preview muestra diferencia respecto al cálculo anterior (aplica reducciones que antes no aplicaba)

---

## 7 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `fiscalContextService` rompe consumidores en 14.4 | Media | 14.2 NO toca consumidores · solo crea gateway · 14.4 migra consumidor a consumidor con commit propio · si falla uno se revierte solo |
| Tablas autonómicas inventadas por CC sin verificar | Alta | Spec exige fuente oficial citada en comentario · si no encuentra · TODO marcado · no inventa |
| Cálculo IRPF cambia mucho y Jose se asusta | Media | Diff esperado · es bug fiscal que se cierra · spec lo deja explícito · Jose valida con su declaración real 2024/2025 antes de mergear 14.3 |
| 14.4 deja consumidores a medias | Baja | STOP-AND-WAIT · si CC no completa los 13 · revisión Jose lo bloquea |
| `keyval['configFiscal']` tiene contenido sorpresa que rompe algo al borrarlo | Muy baja | T15.1 confirmó huérfano · 14.5 reverifica antes de borrar · idempotente |
| `situacionLaboral` decisión a/b inadecuada | Baja | Jose decide en review PR 14.4 |
| Spec stale entre sub-tareas si DB cambia entre ellas | Baja | Cada sub-tarea reverifica DB_VERSION en preflight · si difiere · reportar |

---

## 8 · Lo que esta tarea NO hace

- ❌ NO consolida físicamente stores (eso era enfoque B descartado)
- ❌ NO sube DB_VERSION
- ❌ NO toca `viviendaHabitualService` ni `personalDataService` (siguen siendo dueños de sus stores · gateway los compone)
- ❌ NO crea servicio agregador para `compromisosRecurrentes` o cualquier otro store
- ❌ NO cierra deducciones autonómicas avanzadas (rehabilitación · eficiencia energética · etc) · solo cierra los 5 GAPs identificados · TODOs documentados para futuras
- ❌ NO toca `personalModuleConfig` ni sus consumidores · solo lo documenta
- ❌ NO migra UI nueva · `viviendaHabitual` ya tiene su `ViviendaPage` parcial · queda como está
- ❌ NO cierra GAP 5.7 (`NivelDiscapacidad` definido dos veces) · es fragilidad menor · TODO

---

## 9 · Después de T14

1. Descongelar **T9** · bootstrap `compromisosRecurrentes` desde histórico
2. Cuando T9 cierre · descongelar **T8** · refactor schemas restantes
3. Cuando T8 cierre · descongelar **T10** · cerrar TODOs T7
4. Descongelar **T34/T35-fix-2** y **T16** · pequeños bugs/dudas en paralelo
5. Tras los saneamientos · valorar T36 (vista gastos sobre movements) · norte 1/1/2027

---

## 10 · Cómo lanzar cada sub-tarea a CC

### 10.1 · T14.2

```
@CC ejecuta T14.2 · Crear fiscalContextService gateway
Spec · TAREA-14-2-a-14-5-fiscal-config-v2.md · sección 2
Auditoría preflight · DB_VERSION = 69 · 40 stores · T14.1 mergeada · T13 v4+lotes A+B+C mergeados
Predecesores · main al día tras T13 lote B+C · AUDIT-T14 ya en docs/
NO toca consumidores · solo crea gateway nuevo
1 PR único contra main · stop-and-wait · NO mergear sin autorización Jose
Tiempo estimado CC real · 20-40 min
```

### 10.2 · T14.3 (lanzar SOLO tras merge T14.2)

```
@CC ejecuta T14.3 · Cerrar 5 GAPs IRPF
Spec · TAREA-14-2-a-14-5-fiscal-config-v2.md · sección 3
Auditoría preflight · DB_VERSION = 69 · 40 stores · T14.2 mergeada
Predecesor · fiscalContextService disponible
CC investiga fuentes oficiales para CCAA · NO inventa · TODO si no encuentra
1 PR único contra main · stop-and-wait · Jose valida diff de cálculo con su personalData real
Tiempo estimado CC real · 30-60 min (depende de cuántas CCAA cubra con fuente)
```

### 10.3 · T14.4 (lanzar SOLO tras merge T14.3)

```
@CC ejecuta T14.4 · Migrar 13 consumidores a fiscalContextService
Spec · TAREA-14-2-a-14-5-fiscal-config-v2.md · sección 4
Auditoría preflight · DB_VERSION = 69 · 40 stores · T14.3 mergeada
Predecesor · gateway + IRPF integrados
Decisión situacionLaboral (a/b) · CC propone · Jose decide en review
1 PR único contra main · stop-and-wait · NO regresión funcional
Tiempo estimado CC real · 30-60 min
```

### 10.4 · T14.5 (lanzar SOLO tras merge T14.4)

```
@CC ejecuta T14.5 · Cleanup + docs + cierre T14
Spec · TAREA-14-2-a-14-5-fiscal-config-v2.md · sección 5
Auditoría preflight · DB_VERSION = 69 · 40 stores · T14.4 mergeada
Borrar keyval['configFiscal'] huérfana · idempotente · flag cleanup_T14_v1
Refresh cabecera STORES-V60-ACTIVOS.md a v69 · 40 stores
Crear docs/T14-cierre.md
1 PR único contra main · stop-and-wait · al mergear · TAREA 14 cerrada
Tiempo estimado CC real · 20-30 min
```

---

**Fin de spec T14.2-T14.5 v2 · refresh DB v69 sobre v1 · plan original de Enfoque C intacto · 4 sub-tareas con stop-and-wait estricto · cada una autocontenida · cada una en PR contra `main` directo.**
