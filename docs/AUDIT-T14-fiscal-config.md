# AUDIT · TAREA 14.1 · Configuración fiscal · sitio único

> **Estado** · auditoría completa · STOP-AND-WAIT · pendiente decisión Jose sobre enfoque  
> **DB_VERSION** · 65 (sin cambios)  
> **Stores tocados** · ninguno · solo lectura  
> **Rama** · `copilot/choreaudit-t14-fiscal-config`

---

## 1 · Resumen ejecutivo

La información fiscal del usuario en ATLAS está dispersa entre **3 sitios reales activos** (un cuarto, `keyval['configFiscal']`, está documentado pero **sin escritor ni lector activos**):

1. **`personalData`** — fuente principal. Contiene `comunidadAutonoma`, `tributacion`, `descendientes[]`, `ascendientes[]`, `discapacidad`, `fechaNacimiento`. Servicio dueño: `personalDataService`. Tiene **14 consumidores** identificados.
2. **`personalModuleConfig`** — flags UI/integración derivados automáticamente de `personalData`. **NO contiene información fiscal real**. Sin consumidores externos: solo se lee en `personalDataService.getActiveSections()`.
3. **`viviendaHabitual`** — ficha de la vivienda con datos catastral/adquisición/IBI/seguros relevantes para cálculos IRPF. Servicio dueño: `viviendaHabitualService`. Sin consumidores en producción aún (UI pendiente de implementar según comentarios en código).
4. **`keyval['configFiscal']`** — documentada en `db.ts:2165` JSDoc pero **sin escritor activo**. En `treasurySyncService.ts` la variable `configFiscal` se declara como objeto literal inline con hardcoded defaults (no lee de keyval). Confirmación: T15.1 audit estaba en lo correcto.

**Hallazgos clave:**
- `personalData` es de facto el store de perfil fiscal (≈80% campos). 
- `personalModuleConfig` son flags de UI derivados; clasificación correcta como **NO fiscal**.
- `viviendaHabitual` existe con servicio completo pero **sin consumidores activos** en producción (la UI está pendiente).
- `keyval['configFiscal']` está **completamente huerfana**: sin escritor, sin lector real.
- El campo `comunidadAutonoma` está modelado pero el servicio IRPF **no lo usa** para reducciones autonómicas (usa tablas estatales únicamente). **GAP CRÍTICO documentado, no arreglado.**
- `fechaNacimiento` existe en `PersonalData` pero `irpfCalculationService` tiene un TODO explícito indicando que no se usa para calcular edad adicional del contribuyente.

---

## 2 · Inventario de los 4 sitios

### 2.1 · Store `personalData` · keyPath `id` autoincrement

**Definido en** `src/types/personal.ts:33-58`  
**Servicio dueño** · `src/services/personalDataService.ts` (clase `PersonalDataService`)

**Métodos del servicio:**
| Método | Tipo | Descripción |
|---|---|---|
| `getPersonalData()` | lectura | Recupera `id=1` (único usuario) |
| `savePersonalData()` | escritura | Guarda o actualiza y llama a `updateModuleConfiguration()` |
| `isPersonalDataConfigured()` | lectura | Validación de completitud |
| `getActiveSections()` | lectura | Lee `personalModuleConfig` vía `getModuleConfiguration()` |

**Campos fiscales confirmados:**

| Campo | Tipo TypeScript | Opcional | Escritor | Notas |
|---|---|---|---|---|
| `comunidadAutonoma` | `string` | sí (`?`) | Formulario perfil / import XML | Presente en `GestionPersonalHeader` (UI) |
| `tributacion` | `'individual' \| 'conjunta'` | sí (`?`) | Formulario perfil / import XML | Campo modelado y persistido; **sin referencia identificada en `calcularDeclaracionIRPF`** en el código auditado |
| `descendientes[]` | `Descendiente[]` | sí (`?`) | Formulario perfil | Cada item tiene `fechaNacimiento` + `discapacidad` |
| `ascendientes[]` | `Ascendiente[]` | sí (`?`) | Formulario perfil | Cada item tiene `edad`, `convive`, `discapacidad` |
| `discapacidad` | `NivelDiscapacidad` | sí (`?`) | Formulario perfil | Enum: `ninguna\|hasta33\|entre33y65\|mas65` |
| `fechaNacimiento` | `string` | sí (`?`) | Formulario perfil / import XML | ISO date o `dd/mm/yyyy`; usado en header UI pero **con TODO en irpfCalc** |
| `situacionLaboral[]` | `SituacionLaboral[]` | no | Wizards | Afecta secciones activas módulo |
| `situacionLaboralConyugue[]` | `SituacionLaboral[]` | sí | Wizards | Situación laboral pareja |
| `situacionPersonal` | `'soltero'\|'casado'\|'pareja-hecho'\|'divorciado'` | no | Formulario | Relacionado con tributación conjunta |

### 2.2 · Store `personalModuleConfig` · keyPath `personalDataId`

**Definido en** `src/types/personal.ts:556-568`  
**Servicio** · integrado en `personalDataService.ts` (método privado `updateModuleConfiguration`)

**Campos:**

| Campo | Tipo | Escritor | Lector externo | Clasificación |
|---|---|---|---|---|
| `seccionesActivas.nomina` | `boolean` | `savePersonalData()` automático | Solo `getActiveSections()` | **UI/INTEGRACIÓN** |
| `seccionesActivas.autonomo` | `boolean` | `savePersonalData()` automático | Solo `getActiveSections()` | **UI/INTEGRACIÓN** |
| `seccionesActivas.pensionesInversiones` | `boolean` | `savePersonalData()` (siempre `true`) | Solo `getActiveSections()` | **UI/INTEGRACIÓN** |
| `seccionesActivas.otrosIngresos` | `boolean` | `savePersonalData()` (siempre `true`) | Solo `getActiveSaciones()` | **UI/INTEGRACIÓN** |
| `integracionTesoreria` | `boolean` | `savePersonalData()` (siempre `true`) | No encontrado externamente | **UI/INTEGRACIÓN** |
| `integracionProyecciones` | `boolean` | `savePersonalData()` (siempre `true`) | No encontrado externamente | **UI/INTEGRACIÓN** |
| `integracionFiscalidad` | `boolean` | `savePersonalData()` (siempre `true`) | No encontrado externamente | **UI/INTEGRACIÓN** |

**Conclusión** · `personalModuleConfig` no contiene información fiscal real. Son flags derivados automáticamente. Las integraciones (`integracionTesoreria`, `integracionProyecciones`, `integracionFiscalidad`) están hardcoded a `true` siempre. **Este store NO debe migrar en T14.**

### 2.3 · Store `viviendaHabitual` · keyPath `id` + FK `personalDataId`

**Definido en** `src/types/viviendaHabitual.ts:134-147`  
**Servicio dueño** · `src/services/personal/viviendaHabitualService.ts`

**Discriminated union** `ViviendaHabitualData`:
- `ViviendaHabitualInquilino` — inquilino con contrato arrendamiento
- `ViviendaHabitualPropietario` — propietario sin hipoteca  
- `ViviendaHabitualHipoteca` — propietario con hipoteca

**Campos fiscalmente relevantes por tipo:**

| Campo | Tipo/Casos | Escritor | Relevancia fiscal |
|---|---|---|---|
| `data.catastro.referenciaCatastral` | `string` · Propietario/Hipoteca | Formulario (pendiente) | Imputación rentas inmobiliarias |
| `data.catastro.valorCatastral` | `number` · Propietario/Hipoteca | Formulario (pendiente) | Imputación 1,1% o 2% |
| `data.catastro.porcentajeTitularidad` | `number` · Propietario/Hipoteca | Formulario (pendiente) | Prorrateo si gananciales |
| `data.catastro.catastralRevisado` | `boolean?` · Propietario/Hipoteca | Formulario (pendiente) | Decide 1,1% vs 2% |
| `data.adquisicion.fecha` | `string` · Propietario/Hipoteca | Formulario (pendiente) | Deducción hipoteca pre-2013 |
| `data.adquisicion.gastosAdquisicion` | `number` · Propietario/Hipoteca | Formulario (pendiente) | Valor adquisición para IRPF |
| `data.adquisicion.mejorasAcumuladas[]` | `array` · Propietario/Hipoteca | Formulario (pendiente) | Incrementa valor adquisición |
| `data.ibi` | `ItemIBI` · Propietario/Hipoteca | Formulario (pendiente) | Gasto deducible (no habitual → sí) |
| `data.beneficioFiscal` | `object?` · solo Hipoteca | Formulario (pendiente) | Deducción hipoteca antigua |
| `data.contrato.rentaMensual` | `number` · Inquilino | Formulario (pendiente) | Deducción alquiler (CCAA) |
| `vigenciaDesde` | `string` | `guardarVivienda()` | Cálculo días ocupación |

**Consumidores activos identificados:**  
- `src/services/personal/compromisosRecurrentesService.ts` — lee el store `viviendaHabitual` vía `STORE_VIVIENDA` para validar conflictos (no lee campos fiscales, solo ID)  
- `src/modules/personal/pages/ViviendaPage.tsx` — UI stub (el store viviendaHabitual existe pero la UI no está completamente implementada; ver comentario en línea 8)

**NOTA IMPORTANTE**: Los métodos `obtenerViviendaActiva()` y `listarViviendas()` de `viviendaHabitualService` no tienen consumidores activos fuera del propio servicio para cálculos IRPF. La vivienda habitual **aún no está integrada** en `irpfCalculationService`.

### 2.4 · `keyval['configFiscal']`

**Documentada en** `src/services/db.ts:2165`

```
`'configFiscal'` · documentada históricamente aquí pero sin uso real ·
NO escribir hasta que T14 (configuración fiscal sitio único) decida
destino canónico.
```

**Búsqueda exhaustiva de escritores:**  
El único uso encontrado de la cadena `configFiscal` en código activo es:

1. `src/services/__keyvalAudit.ts:95` — regla de clasificación T15 (`category: 'unknown'`, `recommendation: 'TODO_T14'`)
2. `src/services/keyvalCleanupService.ts:14` — comentario JSDoc mencionando que pertenece a T14
3. `src/services/db.ts:2165` — JSDoc documental
4. `src/modules/horizon/tesoreria/services/treasurySyncService.ts:1007-1017` — **variable LOCAL** llamada `configFiscal` que es un **objeto literal inline** con hardcoded defaults. **NO lee de keyval**. Remanente de cuando existía el store `configuracion_fiscal` (eliminado en V62).

**Conclusión**: `keyval['configFiscal']` no tiene escritor ni lector activos. La variable `configFiscal` en `treasurySyncService` es un objeto local, no relacionado con keyval. T15.1 audit era correcto.

---

## 3 · Tabla de campos × sitio × consumidores

### 3.1 · Campos del store `personalData` (fiscalmente relevantes)

| Campo | Sitio | Tipo | ¿Escritor? | ¿Lector? | Consumidores lectores | Categoría |
|---|---|---|---|---|---|---|
| `comunidadAutonoma` | personalData | `string?` | Sí · form perfil + XML import | Sí | `GestionPersonalHeader` (UI chip) · `declaracionDistributorService` · `declaracionOnboardingService` · tipos `fiscal.ts` | **CORE FISCAL** |
| `tributacion` | personalData | `'individual'\|'conjunta'?` | Sí · form perfil + XML import | Sí | `irpfCalculationService` (tablas conjunta) · `declaracionDistributorService` · `irpfXmlParserService` | **CORE FISCAL** |
| `descendientes[]` | personalData | `Descendiente[]?` | Sí · form perfil | Sí | `irpfCalculationService.calcularMinimosPersonales()` · `GestionPersonalHeader` · `TabGastos` | **CORE FISCAL** |
| `ascendientes[]` | personalData | `Ascendiente[]?` | Sí · form perfil | Sí | `irpfCalculationService.calcularMinimosPersonales()` | **CORE FISCAL** |
| `discapacidad` | personalData | `NivelDiscapacidad?` | Sí · form perfil | Sí | `irpfCalculationService.calcularMinimosPersonales()` · `limitesFiscalesPlanesService` | **CORE FISCAL** |
| `fechaNacimiento` | personalData | `string?` | Sí · form perfil + XML import | Parcial | `GestionPersonalHeader` (UI edad) · `declaracionDistributorService` · `irpfXmlParserService` · **TODO en irpfCalc** | **CORE FISCAL** |
| `situacionPersonal` | personalData | enum | Sí | Parcial | Indirectamente para tributación conjunta | **CONTEXTUAL** |
| `situacionLaboral[]` | personalData | `SituacionLaboral[]` | Sí | Sí | `fiscalPaymentsService` (`esAutonomo`) · `dashboardService` (id) · múltiples | **CONTEXTUAL** |
| `nombre` / `apellidos` / `dni` | personalData | `string` | Sí | Sí | Múltiples (no fiscales) | **IDENTIDAD** |
| `comunidadAutonoma` | personalData | `string?` | Sí | ⚠️ Parcial | `GestionPersonalHeader` (UI) pero **NO en irpfCalculationService** | **GAP** |

### 3.2 · Campos del store `personalModuleConfig`

| Campo | Sitio | Tipo | ¿Escritor? | ¿Lector externo? | Categoría |
|---|---|---|---|---|---|
| `seccionesActivas.nomina` | personalModuleConfig | `boolean` | Sí · automático | No | **UI/INTEGRACIÓN · NO fiscal** |
| `seccionesActivas.autonomo` | personalModuleConfig | `boolean` | Sí · automático | No | **UI/INTEGRACIÓN · NO fiscal** |
| `seccionesActivas.pensionesInversiones` | personalModuleConfig | `boolean` | Sí · siempre `true` | No | **UI/INTEGRACIÓN · NO fiscal** |
| `seccionesActivas.otrosIngresos` | personalModuleConfig | `boolean` | Sí · siempre `true` | No | **UI/INTEGRACIÓN · NO fiscal** |
| `integracionTesoreria` | personalModuleConfig | `boolean` | Sí · siempre `true` | No encontrado | **UI/INTEGRACIÓN · NO fiscal** |
| `integracionProyecciones` | personalModuleConfig | `boolean` | Sí · siempre `true` | No encontrado | **UI/INTEGRACIÓN · NO fiscal** |
| `integracionFiscalidad` | personalModuleConfig | `boolean` | Sí · siempre `true` | No encontrado | **UI/INTEGRACIÓN · NO fiscal** |

### 3.3 · Campos del store `viviendaHabitual` (fiscalmente relevantes)

| Campo | Sitio | Tipo | ¿Escritor activo? | ¿Lector activo en IRPF? | Categoría |
|---|---|---|---|---|---|
| `data.catastro.referenciaCatastral` | viviendaHabitual | `string` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.catastro.valorCatastral` | viviendaHabitual | `number` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.catastro.porcentajeTitularidad` | viviendaHabitual | `number` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.catastro.catastralRevisado` | viviendaHabitual | `boolean?` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.adquisicion.fecha` | viviendaHabitual | `string` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.adquisicion.gastosAdquisicion` | viviendaHabitual | `number` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.adquisicion.mejorasAcumuladas[]` | viviendaHabitual | `array` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.ibi` | viviendaHabitual | `ItemIBI` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.beneficioFiscal` | viviendaHabitual | `object?` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `data.contrato.rentaMensual` | viviendaHabitual | `number` | Formulario (UI pendiente) | No | **VIVIENDA FISCAL · sin integrar** |
| `vigenciaDesde` | viviendaHabitual | `string` | `guardarVivienda()` | Solo para eventos tesorería | **VIVIENDA FISCAL · parcial** |

### 3.4 · `keyval['configFiscal']`

| Campo | Sitio | ¿Escritor? | ¿Lector? | Categoría |
|---|---|---|---|---|
| (clave entera) | keyval | **No (huérfana)** | **No** | **RESIDUAL · sin uso** |

---

## 4 · Consumidores identificados por store

### 4.1 · Consumidores de `personalData` (vía `personalDataService.getPersonalData()`)

| Consumidor | Archivo | Línea aprox. | Campos leídos | Uso | ¿Null-safe? |
|---|---|---|---|---|---|
| `calcularMinimosPersonales` | `irpfCalculationService.ts` | 1025 | `descendientes`, `ascendientes`, `discapacidad` | Cálculo mínimos IRPF | Sí (`??[]`) |
| `generarEventosFiscales` | `fiscalPaymentsService.ts` | 161 | `situacionLaboral` | Determina si autónomo para M130/M303 | Sí (`?? false`) |
| `informesDataService` | `informesDataService.ts` | 475 | Completo (pasado a informe) | Generación de informes | Sí (safe wrapper) |
| `dashboardService` | `dashboardService.ts` | 947 | `id` | Obtener autónomos por `personalDataId` | Sí (try/catch) |
| `proyeccionMensualService` | `proyeccionMensualService.ts` | 672 | No especificado | Proyección mensual | Pendiente de análisis |
| `treasurySyncService` (×5) | `treasurySyncService.ts` | 291,426,462,580,621 | `situacionLaboral`, `id`, otros | Sincronización tesorería | Sí (`?.`) |
| `NominaManager` | `NominaManager.tsx` | 21 | `id` | `personalDataId` para nóminas | Parcial |
| `PlanesManager` | `PlanesManager.tsx` | 27 | `id` | `personalDataId` para planes | Parcial |
| `PlanForm` | `PlanForm.tsx` | 42 | `id` | `personalDataId` para planes | Parcial |
| `AutonomoWizard` | `AutonomoWizard.tsx` | 148 | `id`, `comunidadAutonoma?` | Wizard autónomo | Parcial |
| `NominaWizard` | `NominaWizard.tsx` | 222 | `id` | Wizard nómina | Parcial |
| `OtrosIngresosWizard` | `OtrosIngresosWizard.tsx` | 80 | `id` | Wizard otros ingresos | Parcial |
| `GestionPersonalPage` | `GestionPersonalPage.tsx` | 44 | Completo | Página gestión personal | Sí (null check) |
| `GestionInversionesPage` | `GestionInversionesPage.tsx` | 423, 512, 526, 550, 1133 | `id`, otros | Inversiones | Parcial |

### 4.2 · Consumidores de `personalModuleConfig`

| Consumidor | Archivo | Método | Campos leídos | Uso |
|---|---|---|---|---|
| `personalDataService` | `personalDataService.ts` | `getModuleConfiguration()` | Todo | Solo internamente en `getActiveSections()` |

**Consumidores externos de `getActiveSections()`**: no encontrados en búsqueda. El método existe pero no se llama desde componentes/servicios externos en el código analizado.

### 4.3 · Consumidores de `viviendaHabitual`

| Consumidor | Archivo | Método/uso | Campos leídos | Uso |
|---|---|---|---|---|
| `compromisosRecurrentesService` | `compromisosRecurrentesService.ts` | `STORE_VIVIENDA` (lectura directa) | `personalDataId`, `activa`, tipo | Validación conflictos compromisos (no fiscal) |
| `ViviendaPage` (stub) | `modules/personal/pages/ViviendaPage.tsx` | UI pendiente | — | UI no implementada completamente |

**IRPF no consume `viviendaHabitual`**: confirmado — `irpfCalculationService` no importa ni usa `viviendaHabitualService`.

### 4.4 · Consumidores de `keyval['configFiscal']`

**Ninguno confirmado.** Ver §2.4 para detalles.

---

## 5 · Gaps detectados

### 5.1 · GAP CRÍTICO · `comunidadAutonoma` no usada en cálculo IRPF

**Descripción**: El campo `personalData.comunidadAutonoma` existe y se guarda, pero `irpfCalculationService.ts` NO lo usa para aplicar reducciones/deducciones autonómicas. El servicio calcula solo con tablas estatales.

**Impacto**: Los usuarios de CCAA con reducciones propias (Cataluña, País Vasco, Madrid, etc.) reciben cálculos fiscales incorrectos. Ejemplo: la deducción autonómica por alquiler habitual varía mucho entre CCAA.

**Documentado**: sí · **NO arreglado en T14.1** (out of scope).

### 5.2 · GAP · `fechaNacimiento` no usada para mínimo contribuyente por edad

**Descripción**: El TODO en `irpfCalculationService.ts:1028-1029` dice explícitamente:
```
// Age extras (use birth year estimation from name/dni not available, skip age bonuses)
// TODO: add birthdate to PersonalData if needed
```
`fechaNacimiento` YA EXISTE en `PersonalData`, pero el cálculo de mínimos personales no incrementa el mínimo del contribuyente por edad (≥65: +918€; ≥75: +1.122€ adicional).

**Impacto**: Contribuyentes mayores de 65/75 años reciben mínimos incorrectamente menores.

**Documentado**: sí · **NO arreglado en T14.1**.

### 5.3 · GAP · `viviendaHabitual` no integrada en cálculo IRPF

**Descripción**: El store `viviendaHabitual` existe con datos catastral/adquisición completos, pero `irpfCalculationService` no lo lee para:
- Calcular imputación de rentas inmobiliarias (vivienda habitual está exenta, pero si es segunda residencia o hay períodos vacíos aplica)
- Deducción hipoteca anterior a 31/12/2012 (`beneficioFiscal`)
- Información para imputación en caso de inmueble no arrendado

**Impacto**: Algunos escenarios fiscales quedan incompletos.

**Documentado**: sí · **NO arreglado en T14.1**.

### 5.4 · GAP · `discapacidad` de familiares no usada

**Descripción**: `Descendiente.discapacidad` y `Ascendiente.discapacidad` existen en el modelo, pero `irpfCalculationService.calcularMinimosPersonales()` no los usa para calcular los mínimos adicionales por discapacidad de familiares.

**Impacto**: Familias con dependientes discapacitados reciben mínimos personales incorrectamente menores.

**Documentado**: sí · **NO arreglado en T14.1**.

### 5.5 · GAP · `keyval['configFiscal']` huérfana

**Descripción**: Documentada pero sin escritor ni lector. Históricamente podría haber almacenado `ConfiguracionFiscal` (interfaz definida en `db.ts:1910`), pero desde V62 ese store fue eliminado. La `ConfiguracionFiscal` ahora solo existe como objeto inline hardcoded en `treasurySyncService` y `fiscalPaymentsService`.

**Impacto**: Configuración como `mes_declaracion`, `dia_declaracion`, `minusvalias_pendientes` no es editable por el usuario.

**Documentado**: sí · **NO arreglado en T14.1**. Decisión de T14.2.

### 5.6 · POSIBLE BUG · `tributacion` opcional pero usada sin guard en irpfCalc

**Descripción**: `PersonalData.tributacion` es `?` (opcional), pero `irpfCalculationService` puede asumir que existe. Si el usuario no ha rellenado este campo, el cálculo puede fallar silenciosamente o devolver resultados con tributación individual (default).

**Documentado**: sí · **NO arreglado en T14.1**.

### 5.7 · INCONSISTENCIA · `NivelDiscapacidad` definido dos veces

**Descripción**: `NivelDiscapacidad` como enum/type se usa en `PersonalData.discapacidad`, `Descendiente.discapacidad` y `Ascendiente.discapacidad`. El tipo está definido en `personal.ts` pero la lógica de cálculo en `irpfCalculationService` reimplementa los umbrales como switch/if inline. No es un bug pero sí fragilidad.

---

## 6 · Propuesta de enfoque para T14.2+

### Enfoque A · Servicio agregador `fiscalContextService` · stores intactos

Crear `src/services/fiscalContextService.ts` que expone:
```typescript
async function getFiscalContext(personalDataId: number): Promise<FiscalContext>;
```
Lee de `personalData` + `viviendaHabitual` · combina · devuelve objeto unificado. Stores no se tocan.

**Ventajas**:
- Cero migración · cero riesgo · gateway único disponible inmediato
- Todos los consumidores pueden migrar gradualmente
- Cacheable con invalidación simple

**Desventajas**:
- Dispersión física continúa · si alguien olvida usar el gateway hay bugs
- Cache puede desincronizarse si hay escrituras directas al store

**Esfuerzo estimado**: 4-6h · 1 PR

---

### Enfoque B · Consolidación física en store nuevo `fiscalProfile`

Store nuevo que absorbe todos los campos fiscales. Migración runtime idempotente. Adaptar todos los consumidores.

**Ventajas**:
- Solución física definitiva · sin dispersión futura

**Desventajas**:
- Alto riesgo · muchos consumidores (14+) · DB_VERSION bump · work grande
- Si falla, datos del usuario quedan partidos
- `viviendaHabitual` tiene su propio ciclo de vida (eventos derivados) · absorbería complejidad

**Esfuerzo estimado**: 15-25h · 4-6 PRs con stop-and-wait estricto

---

### Enfoque C · Híbrido · `personalData` como fuente · gateway lectura ⭐ RECOMENDADO

Reconocer que `personalData` ya es el sitio natural (≈80% campos). Crear gateway `fiscalContextService` que lee de `personalData` + `viviendaHabitual`. `personalModuleConfig` queda donde está (no es fiscal). `keyval['configFiscal']` se elimina en T14.2 (está vacía).

```typescript
export interface FiscalContext {
  // De personalData
  comunidadAutonoma?: string;
  tributacion?: 'individual' | 'conjunta';
  fechaNacimiento?: string;
  discapacidad?: NivelDiscapacidad;
  descendientes: Descendiente[];
  ascendientes: Ascendiente[];
  situacionPersonal: string;
  
  // De viviendaHabitual (puede ser undefined si no existe)
  viviendaHabitual?: {
    tipo: 'inquilino' | 'propietarioSinHipoteca' | 'propietarioConHipoteca';
    catastro?: DatosCatastrales;
    adquisicion?: DatosAdquisicion;
    ibi?: ItemIBI;
    beneficioFiscal?: { aplica: boolean; porcentajeDeduccion?: number };
  };
}
```

**Ventajas**:
- Pragmático · respeta arquitectura existente
- `personalData` ya es el agregador natural
- Cambios pequeños · gateway centraliza sin migración masiva
- `viviendaHabitual` mantiene su servicio dedicado (genera eventos derivados · distinta responsabilidad)
- `keyval['configFiscal']` se puede limpiar en T14.2 (sin escritor)

**Desventajas**:
- Si en el futuro Jose quiere separar "perfil personal" de "perfil fiscal" requiere refactoring

**Esfuerzo estimado**: 6-10h · 2-3 PRs

**Justificación de la recomendación**: Este audit confirma que `personalData` ya contiene el 80% del perfil fiscal y tiene un servicio maduro con 14 consumidores. Crear un store nuevo (Enfoque B) generaría una migración de alto riesgo sin beneficio proporcional. El Enfoque A es equivalente al C pero sin abordar los gaps reales. El Enfoque C cierra la dispersión mediante un gateway limpio y aprovecha la arquitectura existente.

---

## 7 · Decisiones pendientes para Jose

| # | Pregunta | Opciones | Urgencia |
|---|---|---|---|
| 1 | **¿Qué enfoque elige para T14?** | A · B · C (CC recomienda C) | Alta |
| 2 | **¿Eliminar `keyval['configFiscal']`?** | Sí (está vacía y huérfana) · dejar documentada | Media |
| 3 | **¿Cuándo integrar `viviendaHabitual` en IRPF?** | T14.2 junto con gateway · post-T14 | Media |
| 4 | **¿Arreglar gaps de `fechaNacimiento` y `discapacidad` familiares?** | T14.2 · tarea separada | Media |
| 5 | **¿`comunidadAutonoma` → reducciones autonómicas?** | T14.x · requiere tabla reducciones por CCAA | Baja (complejo) |
| 6 | **¿`personalModuleConfig` queda fuera de T14?** | Sí (confirmado: no es fiscal) | Confirmado |

---

## 8 · Instrucciones para la página runtime `/dev/fiscal-context-audit`

La página DEV `/dev/fiscal-context-audit` (ruta implementada en esta rama) permite inspeccionar en runtime el estado real de los 4 sitios en la IndexedDB del usuario:

1. Arrancar deploy preview de la rama `copilot/choreaudit-t14-fiscal-config`
2. Navegar a `/dev/fiscal-context-audit`
3. La página invoca `auditFiscalContext()` automáticamente
4. Para cada campo · se muestra si está poblado · tipo de valor · tamaño

Esto permite a Jose ver con su DB real:
- ¿Tiene `comunidadAutonoma` poblada?
- ¿Tiene `descendientes[]` con datos?
- ¿Existe algún registro en `viviendaHabitual`?
- ¿Existe `keyval['configFiscal']` con valor?

---

*Fin del audit T14.1 · STOP-AND-WAIT · pendiente decisión Jose sobre enfoque (§6) antes de redactar spec T14.2.*
