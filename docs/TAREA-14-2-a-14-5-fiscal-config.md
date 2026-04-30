# TAREA CC · TAREA 14.2 a 14.5 · Configuración fiscal sitio único · Enfoque C + cierre gaps · v1

> **Tipo** · sub-tareas 14.2 · 14.3 · 14.4 · 14.5 · cada una en su PR con STOP-AND-WAIT
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · cada sub-tarea desde `main` actualizado tras la anterior · NO rama madre · NO acumular
>
> **Alcance global** · enfoque C (híbrido) según AUDIT-T14 · crear `fiscalContextService` gateway sobre `personalData` + `viviendaHabitual` · migrar `irpfCalculationService` aplicando los 5 GAPs fiscales detectados · migrar 13 consumidores restantes al gateway · borrar `keyval['configFiscal']` · documentar `personalModuleConfig` como NO fiscal · cerrar T14
>
> **Tiempo estimado total** · 10-15h Copilot · 5-8h revisión Jose
>
> **Prioridad** · MEDIA-ALTA · cierre arquitectónico + bugs fiscales reales que afectan a tu IRPF
>
> **Predecesores cerrados** · T15 ✅ · T14.1 ✅ (audit)
>
> **DB** · NO se toca · DB_VERSION sigue en 65 · 40 stores · solo limpieza de keyval en 14.5
>
> **Tareas congeladas que se descongelan al cerrar T14** · T9 (compromisosRecurrentes) · T8 (refactor schemas) · T10 (TODOs T7)

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
- Test 10 · idempotente · llamar N veces · resultado idéntico

### 2.4 · Verificación 14.2

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa con `CI=true`
- [ ] App arranca sin errores
- [ ] 10 tests verdes
- [ ] NINGÚN consumidor existente modificado · solo nuevo archivo
- [ ] `personalDataService` y `viviendaHabitualService` intactos · solo invocados desde el nuevo gateway
- [ ] Cero hex hardcoded en archivo nuevo

### 2.5 · PR 14.2

Título · `feat(fiscal): T14.2 · fiscalContextService gateway · personalData + viviendaHabitual`

Descripción · API expuesta · cómo se calculan edades · qué warnings se generan · tests cubiertos.

**STOP-AND-WAIT** · publicar PR · esperar revisión Jose · NO arrancar 14.3 hasta merge.

---

## 3 · SUB-TAREA 14.3 · Adaptar `irpfCalculationService` + cerrar 5 GAPs fiscales

### 3.1 · Alcance · MIGRAR + APLICAR GAPs

Esta es la sub-tarea de mayor impacto · `irpfCalculationService` pasa de leer 1 sitio (`personalData`) a leer el contexto unificado · Y aplica los 5 GAPs fiscales detectados.

### 3.2 · Adaptación principal

Reemplazar `personalDataService.getPersonalData()` por `getFiscalContext()` · obtener objeto consolidado.

### 3.3 · Cerrar GAP 5.1 · Aplicar reducciones autonómicas por `comunidadAutonoma`

#### Investigación previa requerida

CC investiga · ¿`irpfCalculationService` ya tiene tablas de tramos estatales? Si sí · ¿hay referencias a tramos autonómicos definidos pero no usados? Si no · ¿en qué módulo viven? (puede haber datos en `src/data/` o similar).

#### Si tablas autonómicas NO existen

Crear `src/data/fiscal/tramosAutonomicos2024.ts` con tabla mínima de tramos por CCAA · al menos las que tiene Jose · Madrid · Asturias · Cataluña. Resto · usar tramos estatales y dejar TODO documentado.

CC NO inventa tramos · usa fuentes oficiales y deja referencia a la fuente en comentario · si no encuentra fuente clara · TODO en spec y se ajusta en sub-tarea posterior con dato fiscal verificado por Jose.

#### Lógica nueva

```typescript
function calcularReduccionesAutonomicas(ctx: FiscalContext, baseImponible: number): number {
  if (!ctx.comunidadAutonoma) {
    // log warning · no se aplican reducciones autonómicas
    return 0;
  }
  const tabla = getTablaAutonomica(ctx.comunidadAutonoma, año);
  if (!tabla) {
    // CCAA no soportada · no aplicar · TODO
    return 0;
  }
  return aplicarTabla(tabla, baseImponible, ctx);
}
```

### 3.4 · Cerrar GAP 5.2 · Aplicar bono por edad ≥65 / ≥75 en mínimo contribuyente

Hoy hay TODO explícito en línea 1028. Implementar · 

```typescript
function calcularBonoEdadContribuyente(edad: number | null): number {
  if (edad === null) return 0;
  if (edad >= 75) return 2550 + 1400; // mínimo contribuyente bono ≥65 + bono ≥75 según LIRPF
  if (edad >= 65) return 1150;
  return 0;
}
```

CC verifica importes vigentes · no inventa · si no encuentra fuente · TODO marcado.

### 3.5 · Cerrar GAP 5.3 · Integrar `viviendaHabitual`

Hoy `irpfCalculationService` no usa `viviendaHabitual`. La integración mínima viable en T14.3:

1. Si hay `viviendaHabitual` activa · NO imputar renta inmobiliaria sobre ese inmueble (regla básica · vivienda habitual no genera imputación)
2. Si la CCAA tiene deducciones por adquisición/rehabilitación de vivienda habitual y `fechaAdquisicion < 2013-01-01` (régimen transitorio) · aplicar
3. Documentar TODO para deducciones autonómicas más complejas (rehabilitación · mejora eficiencia energética) · se cerrarán en sub-tareas futuras con datos del usuario

### 3.6 · Cerrar GAP 5.4 · Aplicar discapacidad de descendientes/ascendientes

Hoy se ignora. En cálculo de mínimos personales (descendientes y ascendientes), aplicar bonus por discapacidad según `NivelDiscapacidad`:

```typescript
function bonusDiscapacidad(nivel: NivelDiscapacidad): number {
  switch (nivel) {
    case 'hasta33': return 0;
    case 'entre33y65': return 3000;
    case 'mas65': return 9000 + 3000; // discapacidad severa + asistencia
    default: return 0;
  }
}
```

CC verifica importes vigentes · no inventa · TODO si no encuentra fuente.

### 3.7 · Cerrar GAP 5.6 · Guard sobre `tributacion`

Tras 14.2, `getFiscalContext().tributacion` siempre tiene valor (default 'individual'). Eliminar guards defensivos en `irpfCalculationService` que asumen null · y confiar en el contrato del gateway. Tests deben cubrir el caso del default.

### 3.8 · Tests `irpfCalculationService.test.ts`

Añadir/actualizar:
- Test · usuario Madrid · cálculo aplica reducciones autonómicas Madrid
- Test · usuario Asturias · cálculo aplica reducciones Asturias
- Test · usuario sin CCAA informada · cálculo se hace solo con tramos estatales · warning emitido
- Test · contribuyente edad 70 · bono ≥65 aplicado
- Test · contribuyente edad 80 · bono ≥65 + ≥75 aplicado
- Test · descendiente con discapacidad `entre33y65` · bonus aplicado al mínimo
- Test · ascendiente con discapacidad `mas65` · bonus aplicado
- Test · vivienda habitual activa · ese inmueble NO imputa renta
- Test · vivienda habitual con `fechaAdquisicion=2010-01-01` y CCAA con régimen transitorio · deducción aplicada
- Test · `tributacion` no informada · cálculo usa 'individual' · warning emitido

### 3.9 · Verificación 14.3

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Tests nuevos verdes · tests existentes siguen verdes
- [ ] `irpfCalculationService` ya NO importa `personalDataService` · solo `fiscalContextService`
- [ ] Resultado IRPF para tu DB real (Jose verifica en deploy preview) · debe DIFERIR del cálculo anterior · diferencia esperada por aplicación de reducciones autonómicas Madrid + bono edad si aplicara · etc.

### 3.10 · PR 14.3

Título · `feat(fiscal): T14.3 · IRPF aplica CCAA + edad + discapacidad + viviendaHabitual · cierre 5 GAPs`

Descripción · 5 GAPs cerrados · tablas autonómicas añadidas · tests cubriendo cada GAP · diff esperado en cálculo IRPF para DB real · TODOs documentados para deducciones autonómicas avanzadas no cubiertas.

**STOP-AND-WAIT** · publicar PR · Jose valida en deploy preview que el IRPF calculado ahora aplica reducciones que antes no aplicaba · NO arrancar 14.4 hasta merge.

---

## 4 · SUB-TAREA 14.4 · Migrar 13 consumidores restantes al gateway

### 4.1 · Alcance

Adaptar los 13 consumidores que hoy invocan `personalDataService.getPersonalData()` directamente para que usen `getFiscalContext()` o `getFiscalContextSafe()` según convenga.

### 4.2 · Lista priorizada de consumidores

#### Servicios (alta prioridad)
1. `fiscalPaymentsService.ts:161` · lee `situacionLaboral` para determinar M130/M303 · adaptar a `ctx.something` (CC define dónde queda en el contexto · si no encaja · NO lo metas en `FiscalContext` · `situacionLaboral` no es estrictamente fiscal del titular · puede quedar en `personalData` y este servicio lee ambos)
2. `informesDataService.ts:475` · pasa personalData completo a informe · adaptar para que pase `FiscalContext` o un derivado
3. `dashboardService.ts:947` · solo lee `id` · usar `ctx.personalDataId`
4. `proyeccionMensualService.ts:672` · CC investiga qué lee · adapta
5. `treasurySyncService.ts:291,426,462,580,621` · 5 lecturas · CC investiga campos · adapta cada una

#### Componentes (media prioridad)
6. `GestionPersonalPage.tsx:44` · página gestión personal · lee completo · adaptar
7. `GestionInversionesPage.tsx:423,512,526,550,1133` · 5 lecturas · adaptar cada una
8. `NominaManager.tsx` · `PlanesManager.tsx` · `PlanForm.tsx` · solo `id` · adaptar a `ctx.personalDataId`
9. `AutonomoWizard.tsx:148` · lee `id` y `comunidadAutonoma` · adaptar
10. `NominaWizard.tsx:222` · lee `id` · adaptar
11. `OtrosIngresosWizard.tsx:80` · lee `id` · adaptar

### 4.3 · Estrategia de migración

CC NO migra todo de golpe · va consumidor a consumidor · cada uno con commit propio dentro del PR. Para cada uno:
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
- Sección `personalData` · referenciar `fiscalContextService`
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
- [ ] JSDoc actualizado · STORES-V60-ACTIVOS actualizado · T14-cierre.md creado
- [ ] Tests verdes
- [ ] DB_VERSION sigue en 65

### 5.6 · PR 14.5

Título · `chore(fiscal): T14.5 · cleanup + docs + cierre · TAREA 14 ✅`

Descripción · keyval purgada · documentación canónica · resumen ejecutivo del bloque T14 completo · 4 sub-tareas cerradas.

**Mergear PR · TAREA 14 cerrada formalmente.**

---

## 6 · Criterios de aceptación globales T14

- [ ] 4 sub-tareas mergeadas en orden con stop-and-wait respetado
- [ ] DB_VERSION sigue en 65 · sin cambios de schema
- [ ] 40 stores activos · sin cambios estructurales
- [ ] `fiscalContextService` vivo · 14 consumidores migrados (con excepciones documentadas)
- [ ] 5 GAPs fiscales cerrados · cálculo IRPF aplica CCAA · edad · discapacidad · vivienda habitual
- [ ] `keyval['configFiscal']` borrada · idempotente
- [ ] `personalModuleConfig` documentado como NO fiscal
- [ ] Documentación canónica actualizada · `T14-cierre.md` publicado
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

1. Descongelar **T9** · bootstrap `compromisosRecurrentes` desde histórico · activa la vía A del `movementSuggestionService` de T17
2. Cuando T9 cierre · descongelar **T8** · refactor schemas restantes
3. Cuando T8 cierre · descongelar **T10** · cerrar TODOs T7
4. Tras los 5 saneamientos · valorar T21 (Phase 4 parte 2 horizon) o features nuevas

---

**Fin de spec T14.2-T14.5 v1 · 4 sub-tareas con stop-and-wait estricto · cada una autocontenida · cada una en PR contra `main` directo.**
