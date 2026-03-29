# ATLAS — Modelo de datos fiscal: 4 regímenes

> Especificación para implementar el nodo coordinador `ejerciciosFiscales`
> y el resolver que elimina las incongruencias entre momentos de datos.
>
> Documento maestro para Claude Code. Fase 0 del plan de migración.

---

## 1. Problema

ATLAS tiene datos de 4 momentos temporales distintos que requieren tratamiento diferente:

| Momento | Años (hoy, mar 2026) | Fuente de verdad | Motor IRPF | Editable | Riesgo inspector |
|---------|----------------------|-------------------|------------|----------|------------------|
| **Prescrito** | 2020 | Snapshot AEAT archivado | Congelado | No | No (prescrito) |
| **Declarado** | 2021-2024 | Snapshot AEAT importado | Congelado | Solo documentación | Sí (vigente) |
| **Pendiente** | 2025 | ATLAS calcula (foto 31/12) | Recalcula | Sí, hasta filing | N/A (no presentado) |
| **En curso** | 2026 | ATLAS calcula (vivo) | Recalcula | Siempre | N/A (no cerrado) |

El patrón se desplaza cada 1 de enero. El año que viene será: prescrito (2020-2021), declarado (2022-2025), pendiente (2026), en curso (2027).

### Prescripción fiscal en España
El plazo general de prescripción es **4 años** desde el fin del período voluntario de presentación (normalmente 30 de junio del año siguiente). Un ejercicio prescrito NO se elimina — se archiva con todos sus datos intactos. Lo que cambia: la cobertura documental ya no importa, no hay riesgo de inspección, y el ejercicio se presenta visualmente con menor peso (gris, sin alertas de acción).

```
2020: presentó jun 2021 → prescribe jun 2025 → PRESCRITO ✓
2021: presentó jun 2022 → prescribe jun 2026 → prescribe en 3 meses
2022: presentó jun 2023 → prescribe jun 2027 → vigente
2023: presentó jun 2024 → prescribe jun 2028 → vigente
2024: presentó jun 2025 → prescribe jun 2029 → vigente
```

**Hoy no existe una entidad que coordine esto.** El resultado: double-counting de OPEX, inmuebles vendidos excluidos de años donde tuvieron rentas, arrastres que no persisten, recalculación innecesaria de años congelados, y datos que se pierden entre la extracción y el guardado.

---

## 2. Solución: store `ejerciciosFiscales` + resolver

### 2.1 Nuevo store en IndexedDB

Añadir al `db.ts` en el `upgrade` handler:

```typescript
// Store: ejerciciosFiscales
// keyPath: 'año' (number, NO autoIncrement — el año ES la clave)
interface EjercicioFiscal {
  año: number;                          // 2020, 2021, ..., 2026
  
  // Estado del ciclo fiscal
  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';
  
  // Fecha de prescripción (calculada: 30 jun del año+5)
  // Solo informativo — la transición es automática
  fechaPrescripcion?: string;            // ISO date
  
  // Fuente AEAT (solo si estado === 'declarado')
  aeat?: {
    snapshot: Record<string, number>;   // { '0435': 112096.62, '0670': -5877.64, ... }
    resumen: {
      baseImponibleGeneral: number;
      baseImponibleAhorro: number;
      cuotaIntegra: number;
      retenciones: number;
      resultado: number;                // negativo = a devolver
    };
    pdfDocumentId?: string;             // FK → documents store (PDF archivado)
    fechaImportacion: string;           // ISO date
  };
  
  // Cálculo ATLAS (para pendiente y en_curso; también se genera para declarado como comparativa)
  atlas?: {
    snapshot: Record<string, number>;   // misma estructura que AEAT
    resumen: {
      baseImponibleGeneral: number;
      baseImponibleAhorro: number;
      cuotaIntegra: number;
      retenciones: number;
      resultado: number;
    };
    fechaCalculo: string;
    hashInputs: string;                 // hash MD5 de los inputs para cache
  };
  
  // Arrastres ENTRANTES (de año-1 hacia este año)
  arrastresIn: {
    fuente: 'aeat' | 'atlas' | 'manual' | 'ninguno';
    gastosPendientes0105_0106: ArrastreGasto[];   // casillas 1211-1224
    perdidasPatrimonialesAhorro: ArrastrePerdida[]; // casillas 1258-1270
    amortizacionesAcumuladas: AmortizacionAcumulada[];
    deduccionesPendientes: DeduccionPendiente[];
  };
  
  // Arrastres SALIENTES (de este año hacia año+1)
  arrastresOut?: {
    fuente: 'aeat' | 'atlas';          // nunca 'manual' — se calculan o se extraen
    gastosPendientes0105_0106: ArrastreGasto[];
    perdidasPatrimonialesAhorro: ArrastrePerdida[];
    amortizacionesAcumuladas: AmortizacionAcumulada[];
    deduccionesPendientes: DeduccionPendiente[];
  };
  
  // Inmuebles que tuvieron actividad fiscal en este ejercicio
  // (resuelve el problema de properties.state === 'activo')
  inmuebleIds: number[];                // FKs → properties
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Sub-interfaces para arrastres
interface ArrastreGasto {
  inmuebleId: number;
  inmuebleAlias?: string;
  importePendiente: number;
  añoOrigen: number;                    // para controlar caducidad (4 años)
  casilla: '0105' | '0106';
}

interface ArrastrePerdida {
  tipo: 'ahorro_general' | 'ahorro_renta_variable' | 'patrimonial';
  importePendiente: number;
  añoOrigen: number;                    // caducidad 4 años
}

interface AmortizacionAcumulada {
  inmuebleId: number;
  inmuebleAlias?: string;
  amortizacionAcumulada: number;
  baseAmortizacion: number;             // para verificar consistencia
}

interface DeduccionPendiente {
  tipo: string;
  importePendiente: number;
  añoOrigen: number;
}
```

**Índices del store:**
```typescript
if (!db.objectStoreNames.contains('ejerciciosFiscales')) {
  const store = db.createObjectStore('ejerciciosFiscales', { keyPath: 'año' });
  store.createIndex('estado', 'estado');
}
```

### 2.2 Nuevo servicio: `ejercicioResolverService.ts`

```typescript
// src/services/ejercicioResolverService.ts

import { initDB, EjercicioFiscal } from './db';

// ═══════════════════════════════════════════════
// LECTURA — Resolver principal
// ═══════════════════════════════════════════════

/**
 * Obtiene el ejercicio fiscal para un año.
 * Si no existe, lo crea con estado inferido.
 */
export async function getEjercicio(año: number): Promise<EjercicioFiscal> {
  const db = await initDB();
  let ej = await db.get('ejerciciosFiscales', año);
  if (!ej) {
    ej = crearEjercicioInicial(año);
    await db.put('ejerciciosFiscales', ej);
  }
  return ej;
}

/**
 * Devuelve la declaración que manda para un año.
 * - Declarado → snapshot AEAT (inmutable)
 * - Pendiente → motor ATLAS con foto cerrada
 * - En curso → motor ATLAS con datos vivos
 */
export async function getDeclaracion(año: number): Promise<{
  fuente: 'aeat' | 'atlas';
  snapshot: Record<string, number>;
  resumen: EjercicioFiscal['aeat']['resumen'];
}> {
  const ej = await getEjercicio(año);
  
  if ((ej.estado === 'declarado' || ej.estado === 'prescrito') && ej.aeat) {
    // Ejercicio declarado o prescrito → devolver snapshot, NO recalcular
    return { fuente: 'aeat', snapshot: ej.aeat.snapshot, resumen: ej.aeat.resumen };
  }
  
  // Para pendiente y en_curso: calcular con motor IRPF
  // (la diferencia es que pendiente usa foto 31/12 y en_curso datos vivos)
  const calculado = await calcularDeclaracionATLAS(año, ej);
  return { fuente: 'atlas', snapshot: calculado.snapshot, resumen: calculado.resumen };
}

/**
 * Devuelve los arrastres que llegan a un año.
 * Cascada de prioridad: AEAT del año-1 > ATLAS del año-1 > Manual > Vacío
 */
export async function getArrastresParaAño(año: number): Promise<EjercicioFiscal['arrastresIn']> {
  const ej = await getEjercicio(año);
  
  // Si ya tiene arrastresIn definidos, usarlos
  if (ej.arrastresIn.fuente !== 'ninguno') {
    return ej.arrastresIn;
  }
  
  // Si no, intentar calcularlos desde el año anterior
  const ejAnterior = await getEjercicio(año - 1);
  
  if (ejAnterior.arrastresOut) {
    // Propagar automáticamente
    ej.arrastresIn = {
      fuente: ejAnterior.arrastresOut.fuente,
      ...ejAnterior.arrastresOut
    };
    await actualizarEjercicio(ej);
    return ej.arrastresIn;
  }
  
  return { fuente: 'ninguno', gastosPendientes0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [], deduccionesPendientes: [] };
}

/**
 * Devuelve los inmuebles que tuvieron actividad fiscal en un año.
 * NO usa properties.state === 'activo' del presente.
 */
export async function getInmueblesDelEjercicio(año: number): Promise<number[]> {
  const ej = await getEjercicio(año);
  
  if (ej.inmuebleIds.length > 0) {
    return ej.inmuebleIds;
  }
  
  // Fallback: inferir desde contracts y properties
  // Un inmueble tiene actividad fiscal si:
  // - Tenía un contrato activo en algún momento del año, O
  // - Fue uso propio (no alquilado) durante el año, O
  // - Se vendió durante el año
  const inmuebles = await inferirInmueblesConActividad(año);
  ej.inmuebleIds = inmuebles;
  await actualizarEjercicio(ej);
  return inmuebles;
}

// ═══════════════════════════════════════════════
// ESCRITURA — Transiciones de estado
// ═══════════════════════════════════════════════

/**
 * T2: Importar declaración AEAT → estado pasa a 'declarado'
 * Side effects:
 * 1. Guardar snapshot AEAT inmutable
 * 2. Extraer arrastresOut de casillas
 * 3. Propagar arrastresIn al año siguiente
 * 4. Si es bootstrap (app vacía), crear inmuebles
 */
export async function importarDeclaracionAEAT(
  año: number,
  casillas: Record<string, number>,
  pdfDocumentId?: string,
  esBootstrap?: boolean
): Promise<void> {
  const ej = await getEjercicio(año);
  
  // 1. Guardar snapshot
  ej.aeat = {
    snapshot: casillas,
    resumen: extraerResumenDeCasillas(casillas),
    pdfDocumentId,
    fechaImportacion: new Date().toISOString()
  };
  
  // 2. Cambiar estado
  ej.estado = 'declarado';
  
  // 3. Extraer arrastresOut
  ej.arrastresOut = {
    fuente: 'aeat',
    gastosPendientes0105_0106: extraerArrastresGastos(casillas),
    perdidasPatrimonialesAhorro: extraerArrastresPerdidas(casillas),
    amortizacionesAcumuladas: extraerAmortizacionesAcumuladas(casillas),
    deduccionesPendientes: extraerDeduccionesPendientes(casillas)
  };
  
  // 4. Extraer inmuebles del ejercicio
  ej.inmuebleIds = extraerInmuebleIdsDeCasillas(casillas);
  
  ej.updatedAt = new Date().toISOString();
  await actualizarEjercicio(ej);
  
  // 5. Propagar arrastres al año siguiente
  await propagarArrastres(año);
  
  // 6. Bootstrap si aplica
  if (esBootstrap) {
    await bootstrapDesdeDeclaracion(año, casillas);
  }
}

/**
 * Propaga arrastresOut de un año como arrastresIn del siguiente.
 * Solo sustituye si la fuente actual es de menor prioridad.
 * Prioridad: aeat > atlas > manual > ninguno
 */
async function propagarArrastres(añoOrigen: number): Promise<void> {
  const ejOrigen = await getEjercicio(añoOrigen);
  if (!ejOrigen.arrastresOut) return;
  
  const ejDestino = await getEjercicio(añoOrigen + 1);
  const prioridad = { 'aeat': 3, 'atlas': 2, 'manual': 1, 'ninguno': 0 };
  
  const prioridadActual = prioridad[ejDestino.arrastresIn.fuente] || 0;
  const prioridadNueva = prioridad[ejOrigen.arrastresOut.fuente] || 0;
  
  if (prioridadNueva >= prioridadActual) {
    ejDestino.arrastresIn = {
      fuente: ejOrigen.arrastresOut.fuente,
      ...ejOrigen.arrastresOut
    };
    ejDestino.updatedAt = new Date().toISOString();
    await actualizarEjercicio(ejDestino);
  }
}

// ═══════════════════════════════════════════════
// HELPERS — Creación y bootstrap
// ═══════════════════════════════════════════════

function crearEjercicioInicial(año: number): EjercicioFiscal {
  const añoActual = new Date().getFullYear();
  let estado: EjercicioFiscal['estado'];
  
  if (año === añoActual) {
    estado = 'en_curso';
  } else if (año === añoActual - 1) {
    // El año anterior es pendiente hasta que se importe la AEAT
    estado = 'pendiente';
  } else {
    // Años más antiguos: pendiente por defecto (se promoverán a declarado al importar)
    estado = 'pendiente';
  }
  
  // Calcular fecha de prescripción:
  // Plazo voluntario = 30 jun del año siguiente
  // Prescripción = plazo voluntario + 4 años = 30 jun del año + 5
  const fechaPrescripcion = `${año + 5}-06-30T00:00:00.000Z`;
  
  const now = new Date().toISOString();
  return {
    año,
    estado,
    fechaPrescripcion,
    arrastresIn: {
      fuente: 'ninguno',
      gastosPendientes0105_0106: [],
      perdidasPatrimonialesAhorro: [],
      amortizacionesAcumuladas: [],
      deduccionesPendientes: []
    },
    inmuebleIds: [],
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Comprueba si un ejercicio declarado ha prescrito y actualiza su estado.
 * Se ejecuta en el bootstrap y puede ejecutarse periódicamente.
 * 
 * Regla: prescripción = 30 de junio del año + 5
 * Ejemplo: 2020 → presentó jun 2021 → prescribe 30/06/2025
 * 
 * IMPORTANTE: La transición a 'prescrito' NUNCA elimina datos.
 * Solo cambia el estado y la presentación visual.
 */
async function verificarPrescripcion(ej: EjercicioFiscal): Promise<boolean> {
  if (ej.estado !== 'declarado') return false;
  
  const fechaPrescripcion = ej.fechaPrescripcion 
    ? new Date(ej.fechaPrescripcion) 
    : new Date(ej.año + 5, 5, 30); // 30 de junio del año+5
  
  if (new Date() > fechaPrescripcion) {
    ej.estado = 'prescrito';
    ej.updatedAt = new Date().toISOString();
    await actualizarEjercicio(ej);
    return true;
  }
  return false;
}

function extraerResumenDeCasillas(casillas: Record<string, number>) {
  return {
    baseImponibleGeneral: casillas['0435'] || 0,
    baseImponibleAhorro: casillas['0460'] || 0,
    cuotaIntegra: casillas['0545'] || 0,
    retenciones: casillas['0596'] || 0,
    resultado: casillas['0670'] || 0
  };
}

// Casillas de arrastre de gastos pendientes: 1211-1224
function extraerArrastresGastos(casillas: Record<string, number>): ArrastreGasto[] {
  const arrastres: ArrastreGasto[] = [];
  // Casillas 1211-1224 contienen gastos pendientes por inmueble
  // El formato exacto depende de la estructura del PDF parseado
  // TODO: mapear casillas específicas cuando el parser las entregue
  for (const [key, value] of Object.entries(casillas)) {
    const num = parseInt(key);
    if (num >= 1211 && num <= 1224 && value > 0) {
      arrastres.push({
        inmuebleId: 0, // TODO: vincular con inmueble por posición en declaración
        importePendiente: value,
        añoOrigen: 0,  // TODO: extraer año origen de casillas adyacentes
        casilla: '0105' // TODO: distinguir 0105 vs 0106
      });
    }
  }
  return arrastres;
}

// Casillas de arrastre de pérdidas: 1258-1270
function extraerArrastresPerdidas(casillas: Record<string, number>): ArrastrePerdida[] {
  const arrastres: ArrastrePerdida[] = [];
  for (const [key, value] of Object.entries(casillas)) {
    const num = parseInt(key);
    if (num >= 1258 && num <= 1270 && value > 0) {
      arrastres.push({
        tipo: 'patrimonial',
        importePendiente: value,
        añoOrigen: 0 // TODO: extraer de casillas
      });
    }
  }
  return arrastres;
}

function extraerAmortizacionesAcumuladas(casillas: Record<string, number>): AmortizacionAcumulada[] {
  // Las amortizaciones acumuladas no están en casillas AEAT directamente
  // Se infieren del cálculo o se piden manualmente
  return [];
}

function extraerDeduccionesPendientes(casillas: Record<string, number>): DeduccionPendiente[] {
  return [];
}

function extraerInmuebleIdsDeCasillas(casillas: Record<string, number>): number[] {
  // TODO: Cuando el parser identifique inmuebles por ref catastral,
  // buscar en el store properties y devolver sus IDs
  return [];
}

async function actualizarEjercicio(ej: EjercicioFiscal): Promise<void> {
  const db = await initDB();
  await db.put('ejerciciosFiscales', ej);
}
```

---

## 3. Reglas formales del modelo

### 3.1 Reglas de estado

| Regla | Descripción |
|-------|-------------|
| R1 | La AEAT manda cuando existe; si no, manda ATLAS |
| R2 | Los arrastres de N+1 toman su fuente del estado real de N |
| R3 | El motor NUNCA recalcula ejercicios declarados |
| R4 | La documentación retroactiva solo impacta cobertura documental, no el cálculo |
| R5 | Los arrastres manuales son fallback y se sustituyen por datos reales al importar |
| R6 | La primera declaración puede bootstrappear toda la app |
| R7 | Declaraciones adicionales enriquecen, no duplican (clave: ref_catastral) |
| R8 | El cruce multi-año propone un timeline, pero nunca lo aplica en silencio |
| R9 | La incompletitud no bloquea el uso de la app |
| R10 | Los ejercicios prescritos NUNCA se eliminan — se archivan con label 'prescrito' |
| R11 | La prescripción es automática: 4 años desde fin del plazo voluntario (30/06 del año+1) |
| R12 | Un ejercicio prescrito se trata como declarado para datos, pero sin riesgo inspector |
| R13 | Los arrastres de un ejercicio prescrito siguen siendo válidos para la cadena |
| R14 | Las amortizaciones acumuladas de ejercicios prescritos son fundamentales — nunca perder |

### 3.2 Reglas de prescripción

**Qué es un ejercicio prescrito:** Un ejercicio cuyo plazo de inspección ha expirado. Hacienda ya no puede revisarlo. Pero los datos siguen siendo valiosos para ATLAS.

**Transición automática:** `declarado → prescrito` ocurre cuando `new Date() > fechaPrescripcion`. Se verifica en cada bootstrap de la app.

**Lo que permanece intacto en un ejercicio prescrito:**
- Snapshot AEAT completo (casillas, resumen)
- Snapshot ATLAS (comparativa calculada)
- PDF archivado descargable
- ArrastresOut (alimentan la cadena de años siguientes)
- Inmuebles y datos catastrales del ejercicio
- Amortizaciones acumuladas (CRÍTICO: la cadena de amortización necesita todos los años)
- Historial para tendencia fiscal multi-año

**Lo que cambia en la presentación:**
- Label visual: gris, con indicador "Prescrito" 
- NO muestra cobertura documental (ya no importa)
- NO muestra alertas de acción ("falta documento X")
- NO muestra "riesgo inspector" ni columna "Documentado"
- Peso visual reducido en el historial (no desaparece, pero no compite con los vigentes)
- El ojo para ver la declaración ATLAS sigue activo (es parte del historial)

**Por qué las amortizaciones acumuladas son críticas:**
```
2020: Fuertes Acevedo comprado → amortización año 1 = 615 €
2021: amortización acumulada = 1.230 €
...
2025: amortización acumulada = 3.690 €
2026: si vendiera, la ganancia patrimonial necesita TODA la cadena de amortización
```
Si borramos 2020 porque prescribió, perdemos el punto de partida de la amortización. La cadena se rompe.

### 3.4 Reglas de inmuebles por ejercicio

**El problema actual:** `properties` tiene un campo `state` ('activo' | 'vendido') que es el estado HOY. Si Tenderina 48 se vendió en nov 2025, aparece como vendida y se excluye del cálculo de 2025 donde tuvo 10 meses de rentas.

**La solución:** El campo `inmuebleIds` de cada `EjercicioFiscal` registra qué inmuebles tuvieron actividad en ese año. No depende del estado actual del inmueble.

```
2024: inmuebleIds = [FA32, T64-4D, T64-4IZ, SF, MAN, T48]  // todos
2025: inmuebleIds = [FA32, T64-4D, T64-4IZ, SF, MAN, T48]  // T48 vendida pero tuvo rentas
2026: inmuebleIds = [FA32, T64-4D, T64-4IZ, SF, MAN]        // T48 ya no
```

### 3.5 Reglas de arrastres

```
Prioridad de fuente (mayor a menor):
  aeat (3)  → Casillas extraídas de declaración importada
  atlas (2) → Calculadas por motor IRPF de ATLAS
  manual (1) → Introducidas a mano por el usuario
  ninguno (0) → No hay datos

Al importar AEAT de año N:
  1. arrastresOut de N se extraen de casillas AEAT
  2. arrastresIn de N+1 se sustituyen SI la prioridad es >= la actual
  3. Si N+1 ya tenía arrastresIn de fuente 'aeat', NO se sustituyen
     (podrían venir de otra AEAT ya importada)
```

### 3.6 Reglas de importación encadenada

Cuando el usuario importa 5 declaraciones seguidas (2020→2024):

```
1. Importar siempre en orden cronológico (2020, luego 2021, ..., 2024)
2. Cada importación:
   a. Guarda snapshot AEAT en ejerciciosFiscales[año]
   b. Cambia estado a 'declarado'
   c. Extrae arrastresOut
   d. Propaga arrastresIn al año siguiente (si prioridad >= actual)
3. Inmuebles:
   a. Primera importación (app vacía): crear todos desde refs catastrales
   b. Siguientes: buscar por ref_catastral → si existe, enriquecer; si no, crear
   c. NUNCA duplicar por ref_catastral
4. Validación:
   a. Si se intenta importar 2023 sin haber importado 2022, avisar (no bloquear)
   b. Los arrastresIn de 2023 quedarán como 'ninguno' hasta que se importe 2022
```

---

## 4. Impacto en servicios existentes

### 4.1 `fiscalSummaryService.ts` — CAMBIO CRÍTICO

**Antes:** Lee directamente de properties, contracts, opexRules, operacionesFiscales, etc. y calcula siempre.

**Después:** 
```typescript
async function getResumenFiscal(año: number) {
  const declaracion = await ejercicioResolver.getDeclaracion(año);
  
  if (declaracion.fuente === 'aeat') {
    // Ejercicio declarado → devolver snapshot, NO recalcular
    return declaracion.resumen;
  }
  
  // Ejercicio pendiente o en_curso → calcular con motor
  // PERO usar getInmueblesDelEjercicio(año) en vez de properties.state === 'activo'
  // Y usar getArrastresParaAño(año) para arrastres
  return calcularConMotor(año);
}
```

### 4.2 `properties` store — SIN CAMBIO en schema

El campo `state` sigue existiendo para la gestión del día a día. Lo que cambia es que el módulo fiscal NO usa `state` para filtrar — usa `ejerciciosFiscales[año].inmuebleIds`.

### 4.3 `operacionesFiscales` store — SIN CAMBIO en schema

Sigue funcionando igual para gastos deducibles. Lo que cambia es que solo se consulta para años `pendiente` o `en_curso`. Para años `declarado`, los datos vienen del snapshot AEAT.

### 4.4 Performance: cache por hash

El motor IRPF es costoso. Para evitar recalcular en cada navegación:

```typescript
// Al calcular un ejercicio pendiente/en_curso:
const inputHash = computeHash({
  inmuebleIds,
  arrastresIn,
  operaciones: await getOperacionesFiscales(año),
  contratos: await getContratosActivos(año),
  // ...
});

const ej = await getEjercicio(año);
if (ej.atlas?.hashInputs === inputHash) {
  // Cache hit — devolver snapshot guardado
  return ej.atlas;
}

// Cache miss — recalcular y guardar
const resultado = await calcularIRPF(año, ...);
ej.atlas = { snapshot: resultado, resumen: ..., fechaCalculo: ..., hashInputs: inputHash };
await actualizarEjercicio(ej);
return resultado;
```

---

## 5. Bootstrap al arrancar la app

Al iniciar ATLAS (o al primer acceso al módulo fiscal), ejecutar:

```typescript
async function bootstrapEjercicios(): Promise<void> {
  const añoActual = new Date().getFullYear();
  const db = await initDB();
  
  // Asegurar que existen registros para los últimos 7 años + actual
  for (let año = añoActual - 6; año <= añoActual; año++) {
    const existe = await db.get('ejerciciosFiscales', año);
    if (!existe) {
      await db.put('ejerciciosFiscales', crearEjercicioInicial(año));
    }
  }
  
  // Verificar consistencia: si algún ejercicio tiene AEAT pero no está como 'declarado', corregir
  // Y verificar prescripción de los declarados
  const todos = await db.getAll('ejerciciosFiscales');
  for (const ej of todos) {
    if (ej.aeat && ej.estado !== 'declarado' && ej.estado !== 'prescrito') {
      ej.estado = 'declarado';
      await db.put('ejerciciosFiscales', ej);
    }
    // Verificar si algún declarado ha prescrito
    if (ej.estado === 'declarado') {
      await verificarPrescripcion(ej);
    }
  }
}
```

---

## 6. Criterios de aceptación de Fase 0

- [ ] Store `ejerciciosFiscales` creado con keyPath 'año'
- [ ] Interface `EjercicioFiscal` y sub-interfaces exportadas desde `db.ts`
- [ ] `ejercicioResolverService.ts` creado con funciones:
  - `getEjercicio(año)` — lee o crea
  - `getDeclaracion(año)` — devuelve fuente correcta según estado
  - `getArrastresParaAño(año)` — cascada de prioridad
  - `getInmueblesDelEjercicio(año)` — no usa state actual
  - `importarDeclaracionAEAT(año, casillas, pdfDocId, esBootstrap)` — transición T2
  - `propagarArrastres(añoOrigen)` — side effect de importación
  - `bootstrapEjercicios()` — inicialización
- [ ] Bootstrap se ejecuta al montar el módulo fiscal
- [ ] **Ningún servicio existente se modifica en esta fase** — el resolver es aditivo
- [ ] Tests manuales:
  - Abrir módulo fiscal → deben existir registros 2020-2026
  - 2026 = en_curso, 2025 = pendiente, 2020-2024 = pendiente (sin AEAT aún)
  - Si se importa AEAT de 2020 → estado pasa a 'prescrito' (no 'declarado', porque ya prescribió)
  - Si se importa AEAT de 2022 → estado pasa a 'declarado' (aún vigente)
  - `getDeclaracion(2020)` devuelve snapshot AEAT aunque esté prescrito
  - `getDeclaracion(2026)` calcula con motor (aún sin redirigir fiscalSummary)
  - `getArrastresParaAño(2026)` devuelve fuente 'ninguno' (aún no hay datos)
  - Ejercicio prescrito conserva todos sus datos (snapshot, PDF, arrastres, inmuebles)

---

## 7. Siguiente fase (Fase 1)

Una vez creado el store y el resolver, la Fase 1 reconecta la importación de PDFs AEAT:

1. `ImportarDeclaracionWizard.tsx` llama a `importarDeclaracionAEAT()` del resolver
2. El wizard muestra valor (resumen + inmuebles detectados), no casillas crudas
3. Los inmuebles se crean/enriquecen por ref_catastral
4. Los arrastres se propagan automáticamente
5. El PDF se archiva como documento descargable

Esto absorbe las tareas T1.1, T1.3, T1.4, T1.5, T1.6, T1.7, T1.8 del plan original.

---

## Appendix: mapeo de casillas de arrastre

### Gastos pendientes (casillas 1211-1224)
```
1211-1214: Gastos 0105+0106 pendientes de inmueble 1 (por años: N-4, N-3, N-2, N-1)
1215-1218: Gastos 0105+0106 pendientes de inmueble 2
1219-1222: Gastos 0105+0106 pendientes de inmueble 3
1223-1224: Gastos 0105+0106 pendientes de inmueble 4+
```

### Pérdidas patrimoniales (casillas 1258-1270)
```
1258-1261: Pérdidas base ahorro pendientes (por años: N-4, N-3, N-2, N-1)
1262-1265: Pérdidas renta variable pendientes
1266-1270: Pérdidas patrimoniales generales
```

### Resumen fiscal (casillas clave)
```
0435: Base imponible general
0460: Base imponible del ahorro
0545: Cuota íntegra total
0596: Total retenciones y pagos a cuenta
0670: Resultado de la declaración (neg = devolver)
```
