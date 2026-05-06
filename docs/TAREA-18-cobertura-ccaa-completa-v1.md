# TAREA CC · TAREA 18 · Cobertura CCAA completa · Motor de elegibilidad + 15 CCAA régimen común · v1

> **Tipo** · sub-tareas 18.0 · 18.1 · 18.2 · 18.3 · cada una en su PR con STOP-AND-WAIT
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · cada sub-tarea desde `main` actualizado tras la anterior · NO rama madre · NO acumular
>
> **Alcance global** · construir motor genérico de evaluación de elegibilidad de deducciones autonómicas · cubrir las 15 CCAA de régimen común con cifras verificadas BOE 2025 · refactor `irpfCalculationService` para consumir el módulo nuevo · cerrar GAPs `verified=false` que dejó T14.3
>
> **Tiempo estimado total**
> - **CC real** · 4-7h espaciadas · 4 sub-tareas con stop-and-wait
> - **Tu revisión** · 3-5h en total
> - **Horas-humanas equivalentes** · 8-13h
>
> **Prioridad** · ALTA · BLOQUEANTE para vender · cualquier cliente español de régimen común necesita su CCAA bien implementada · ATLAS no puede entregar números erróneos a un cliente de Galicia o Asturias
>
> **Predecesores cerrados** · T13 ✅ · T14 (todas las sub-tareas) ✅
>
> **DB** · NO se toca · DB_VERSION sigue en **69** · 40 stores · solo nuevos archivos en `src/services/fiscal/`
>
> **NO entra · TAREA futura** · País Vasco (3 territorios forales · Álava · Bizkaia · Gipuzkoa) · Navarra · regímenes IRPF propios · módulo separado · etiquetar UI "ATLAS no soporta · contactar"

---

## 0 · Reglas inviolables

### 0.1 · STOP-AND-WAIT estricto entre sub-tareas
CC implementa una sub-tarea · publica PR · DETIENE EJECUCIÓN · espera revisión Jose en deploy preview · NO empieza la siguiente hasta merge + autorización. NO acumular en rama madre · cada PR contra `main` directo.

### 0.2 · NO inventar cifras
Cada cifra autonómica (mínimo · escala · deducción) DEBE tener fuente oficial citada en comentario del código · BOE / web Agencia Tributaria autonómica / web AEAT manual práctico. Si CC no encuentra fuente · marca `verified: false` con TODO concreto y avisa. **Bajo ninguna circunstancia inventa una cifra**.

### 0.3 · Datos del usuario intactos
T18 NO migra ningún dato · solo añade tipos · servicios · refactor lectura. Si en algún punto un dato real desaparece · es BUG · revertir.

### 0.4 · Idempotencia
Cualquier helper de cálculo debe ser ejecutable N veces sin efecto secundario.

### 0.5 · Auditoría preflight obligatoria por sub-tarea
ANTES de codear cada sub-tarea · CC verifica:
- DB_VERSION = 69 · 40 stores (no debe cambiar)
- Predecesoras cerradas según indicado
- Estructura `src/services/fiscal/ccaaRules/` y archivos relacionados · si EXISTEN ya · STOP-REPORT · NO recrear
- Tablas autonómicas en `irpfCalculationService.ts` · localizar exactamente dónde viven antes de extraer
- Helper `calcularCuotaBaseGeneralCCAA` · verificar firma actual

### 0.6 · Cero hex hardcoded
Tokens v5 obligatorios. Si UI nueva (no esperada en T18) · cumple guía v5.

### 0.7 · NO aplicar deducción sin evaluar elegibilidad
ATLAS NUNCA aplica una deducción autonómica sin pasar por `evaluarElegibilidad()`. Esto es REGLA SAGRADA. Aplicar mal una deducción es bug fiscal · puede provocar inspección al cliente.

---

## 1 · Contexto · qué resuelve esta tarea

### 1.1 · Estado heredado de T14.3

T14.3 cerró el GAP CRÍTICO 5.1 (CCAA en `irpfCalculationService`) parcialmente:
- Helper `calcularCuotaBaseGeneralCCAA` existe
- Tablas inline para Madrid · Asturias · Cataluña con `verified=false`
- 12 CCAA restantes sin tabla · cae al fallback estatal
- NO hay deducciones autonómicas implementadas

### 1.2 · Problema real de mercado

ATLAS se vende a inversores en pisos · clientes potenciales residen en cualquier CCAA. Si un cliente residente fiscal en Galicia abre ATLAS:
- Su escala autonómica NO se aplica (cae a estatal · números mal)
- Sus mínimos autonómicos propios NO se aplican (números mal)
- Sus deducciones autonómicas NO se computan (números mal)

Esto es un bug fiscal por cliente y un BLOQUEO comercial.

### 1.3 · Realidad CCAA · cómo se distinguen

| Régimen | CCAA | IRPF |
|---|---|---|
| **Régimen común · 15 CCAA · ENTRA T18** | Andalucía · Aragón · Asturias · Baleares · Canarias · Cantabria · Castilla-La Mancha · Castilla y León · Cataluña · Extremadura · Galicia · Madrid · Murcia · La Rioja · Valencia | IRPF estatal cedido · CCAA fija escala autonómica + mínimos autonómicos + deducciones propias |
| **Régimen foral · NO entra T18** | País Vasco (Álava · Bizkaia · Gipuzkoa) · Navarra | IRPF propio foral · cálculo distinto · módulo aparte futuro |

### 1.4 · Punto clave de arquitectura · 1 CCAA por usuario

ATLAS necesita 1 CCAA por usuario · la **residencia fiscal del titular** · NO una por piso. Un cliente residente en Madrid con pisos en Galicia y Andalucía · su IRPF se calcula con escala y deducciones de Madrid · NO se mezclan CCAA. Esto simplifica: hay que cubrir 15 CCAA · pero por usuario solo aplica 1.

### 1.5 · 3 dimensiones por CCAA

| # | Dimensión | Qué |
|---|---|---|
| 1 | **Mínimos personales y familiares autonómicos** | Cifras propias (si las tiene) o iguales que estatales |
| 2 | **Escala autonómica** | Tramos · tipos para base liquidable general |
| 3 | **Deducciones autonómicas relevantes** | TOP-3 por CCAA + reglas elegibilidad estrictas |

### 1.6 · TOP-3 deducciones por CCAA · scope

CC NO cubre todas las deducciones autonómicas (decenas por CCAA · muchas exóticas). Cubre las **3 más relevantes para clientes ATLAS** (inversores en pisos · perfil libertad financiera):

| Prioridad | Deducción | Por qué |
|---|---|---|
| 1 | **Arrendamiento vivienda habitual** | Cliente puede vivir de alquiler mientras invierte (ej · Jose) |
| 2 | **Inversión vivienda habitual** (jóvenes · nacimiento · subida intereses · etc.) | Si cliente compra residencia |
| 3 | **Familia numerosa o descendientes** | Más comunes |

Resto de deducciones (despoblación · estudios · donaciones · etc.) · TODOs documentados con casillas AEAT · TAREA futura cuando aparezca cliente concreto.

---

## 2 · Arquitectura propuesta

### 2.1 · Estructura de archivos

```
src/services/fiscal/
├── ccaaRules/
│   ├── index.ts                       // Map<CCAA, CcaaRules> · default fallback estatal
│   ├── _base_estatal.ts               // mínimos · escala fallback · referencia
│   ├── andalucia.ts
│   ├── aragon.ts
│   ├── asturias.ts
│   ├── baleares.ts
│   ├── canarias.ts
│   ├── cantabria.ts
│   ├── castilla_la_mancha.ts
│   ├── castilla_y_leon.ts
│   ├── cataluna.ts
│   ├── extremadura.ts
│   ├── galicia.ts
│   ├── madrid.ts
│   ├── murcia.ts
│   ├── la_rioja.ts
│   └── valencia.ts
├── deduccionesAutonomicasService.ts   // evaluador genérico
└── tipos.ts                           // interfaces compartidas
```

### 2.2 · Interfaces clave

```typescript
// src/services/fiscal/tipos.ts

export interface MinimoPersonalFamiliarCcaa {
  mínimoContribuyente: number;             // 5550 o propio
  bonoMayor65: number;                     // 1150 o propio
  bonoMayor75Adicional: number;            // 1400 o propio
  descendiente1: number;
  descendiente2: number;
  descendiente3: number;
  descendiente4Plus: number;
  descendienteMenor3Extra: number;
  ascendienteMayor65: number;
  ascendienteMayor75Adicional: number;
  discapacidad33a65: number;
  discapacidad65Plus: number;
  discapacidadGastosAsistencia: number;
}

export interface TramoEscalaAutonomica {
  baseHasta: number;                       // null = sin tope (último tramo)
  tipoMarginal: number;                    // 0.085 = 8.5%
}

export interface DeduccionAutonomica {
  id: string;                              // "madrid-arrendamiento-vivienda-habitual"
  ccaa: string;
  nombre: string;
  descripcion: string;
  fuenteOficial: string;                   // URL BOE / AEAT manual práctico / texto refundido
  verified: boolean;
  
  porcentaje: number;                      // 0.30
  topeAbsolutoIndividual: number;          // 1237.20
  topeAbsolutoConjunta?: number;           // si distinto
  
  // Motor de elegibilidad
  requisitos: RequisitosDeduccion;
  
  // Función de cálculo · CC implementa por deducción
  calcularImporte?: (ctx: FiscalContext, datosBase: DatosBaseDeduccion) => number;
}

export interface RequisitosDeduccion {
  edadMaxima?: number;
  edadMinima?: number;
  baseImponibleMaxIndividual?: number;
  baseImponibleMaxConjunta?: number;
  baseImponibleMaxFamiliar?: number;
  porcentajeMinAlquilerSobreBI?: number;   // 0.20
  
  requiereFianzaDepositada?: boolean;
  requiereFamiliaNumerosa?: 'general' | 'especial' | false;
  requiereDiscapacidad?: { gradoMinimo: number };
  requiereTipoVivienda?: 'habitual' | 'temporada-larga' | 'inversion';
  requiereResidenciaFiscalCcaa?: boolean;  // siempre true para autonómicas · explícito
  
  // Otros · CC añade según deducción
}

export interface ResultadoElegibilidad {
  elegible: boolean;
  motivosNoElegible: string[];             // ["edad >40", "BI excede 25.620€"]
  importeAplicable: number;                // 0 si no elegible
  topeAplicado?: number;                   // tope absoluto si se alcanzó
  fuenteOficial: string;                   // se traslada del DeduccionAutonomica
}

export interface CcaaRules {
  ccaa: string;
  codigoIso: string;                       // "ES-MD"
  fuenteOficialMinimos: string;
  fuenteOficialEscala: string;
  
  minimoPersonalFamiliar: MinimoPersonalFamiliarCcaa;
  escalaAutonomica: TramoEscalaAutonomica[];
  deducciones: DeduccionAutonomica[];
  
  deflactacion2025?: {
    aplicada: boolean;
    fuente: string;
  };
  
  verified: boolean;                       // true cuando todas las cifras están BOE-verificadas
  notasMigracion?: string[];               // observaciones importantes
}
```

### 2.3 · API pública del servicio

```typescript
// src/services/fiscal/deduccionesAutonomicasService.ts

/**
 * Devuelve TODAS las deducciones autonómicas evaluadas para el contexto fiscal.
 * Marca cada una como elegible o no · con motivos.
 */
export async function getDeduccionesAutonomicasEvaluadas(
  ctx: FiscalContext,
  datosBase: DatosBaseFiscal
): Promise<ResultadoDeduccion[]>;

/**
 * Devuelve solo las elegibles · listo para sumar a cuota líquida.
 */
export async function getDeduccionesAutonomicasAplicables(
  ctx: FiscalContext,
  datosBase: DatosBaseFiscal
): Promise<ResultadoDeduccion[]>;

/**
 * Lookup cifras autonómicas por CCAA del contexto.
 */
export function getReglasCcaa(ccaa: string): CcaaRules;
```

### 2.4 · Refactor `irpfCalculationService`

El helper `calcularCuotaBaseGeneralCCAA` actual lee tablas inline. Refactor para leer del nuevo módulo:

```typescript
import { getReglasCcaa } from './fiscal/deduccionesAutonomicasService';

function calcularCuotaBaseGeneralCCAA(
  baseLiquidableGeneral: number,
  ccaa: string
): number {
  const reglas = getReglasCcaa(ccaa);
  return aplicarEscala(baseLiquidableGeneral, reglas.escalaAutonomica);
}
```

Ídem para mínimos autonómicos · sustituye lectura inline por `reglas.minimoPersonalFamiliar`.

---

## 3 · SUB-TAREA 18.0 · Motor de elegibilidad genérico ★ FUNDACIÓN

### 3.1 · Alcance

Construir la fundación · interfaces · servicio evaluador · estructura de archivos · sin cifras concretas. Solo Madrid (cifras de T14.3 portadas) y `_base_estatal.ts` como fallback. CC valida que la arquitectura aguanta antes de extender a 14 CCAA más.

### 3.2 · Entregables

- `src/services/fiscal/tipos.ts` · interfaces §2.2
- `src/services/fiscal/ccaaRules/_base_estatal.ts` · cifras estatales completas (Art. 56-61 Ley IRPF + escala estatal)
- `src/services/fiscal/ccaaRules/madrid.ts` · cifras Madrid completas con `verified=true` · al menos 1 deducción (arrendamiento vivienda habitual con sus 4 requisitos)
- `src/services/fiscal/ccaaRules/index.ts` · Map · fallback a estatal
- `src/services/fiscal/deduccionesAutonomicasService.ts` · API §2.3
- Refactor `irpfCalculationService.calcularCuotaBaseGeneralCCAA` para usar el módulo nuevo
- Tests · §3.3

### 3.3 · Tests obligatorios

- Test 1 · `getReglasCcaa('Madrid')` devuelve cifras Madrid
- Test 2 · `getReglasCcaa('CCAA_NO_EXISTE')` devuelve fallback estatal con warning
- Test 3 · arrendamiento Madrid · usuario 30 años · BI 18.000 € · alquiler 6.000 € (>20% BI) · ELEGIBLE · importe 1.237,20 € (tope alcanzado)
- Test 4 · arrendamiento Madrid · usuario 45 años · BI 18.000 € · alquiler 6.000 € · NO ELEGIBLE · motivo "edad >40"
- Test 5 · arrendamiento Madrid · usuario 30 años · BI 30.000 € · alquiler 8.000 € · NO ELEGIBLE · motivo "BI individual >25.620"
- Test 6 · arrendamiento Madrid · usuario 30 años · BI 18.000 € · alquiler 2.000 € (<20% BI) · NO ELEGIBLE · motivo "alquiler <20% BI"
- Test 7 · `irpfCalculationService.calcularCuotaBaseGeneralCCAA` lee del módulo nuevo · resultado idéntico a antes para Madrid

### 3.4 · Verificación 18.0

- [ ] DB_VERSION sigue en 69 · 40 stores
- [ ] `tsc --noEmit` pasa
- [ ] Tests pasan
- [ ] App arranca sin errores
- [ ] Cero regresión en cálculo IRPF Madrid (test integración con personalData de Jose)
- [ ] Madrid · cifras `verified=true` con fuente oficial citada
- [ ] Resto CCAA · NO existen archivos todavía · fallback funciona

### 3.5 · PR 18.0

Título · `feat(fiscal): T18.0 · motor elegibilidad deducciones autonómicas + Madrid verified`

Descripción · arquitectura · refactor calcularCuotaBaseGeneralCCAA · Madrid completa · test caso real Jose.

**STOP-AND-WAIT** · publicar PR · Jose valida cálculo IRPF Madrid sin regresión · NO arrancar 18.1 hasta merge.

---

## 4 · SUB-TAREA 18.1 · Top 5 mercado inversor

### 4.1 · Alcance

Cubrir las 5 CCAA con mayor concentración de inversores en pisos. Cada una con cifras BOE 2025 verificadas · escala · mínimos · TOP-3 deducciones según §1.6.

### 4.2 · CCAA y razones de prioridad

| Orden | CCAA | Por qué primero |
|---|---|---|
| 1 | Cataluña | Mercado piso turístico · inversor activo · escala 9 tramos |
| 2 | Andalucía | Costa Sol · alquiler turístico · gran volumen inversor |
| 3 | Valencia | Costa · alquiler turístico · expat · mercado activo |
| 4 | Baleares | Inversores piso turístico · mercado premium |
| 5 | Castilla y León | Tipos bajos · inversor residente |

(Madrid ya cubierto en 18.0)

### 4.3 · Por CCAA · entregables

- Archivo `src/services/fiscal/ccaaRules/{ccaa}.ts` con:
  - `minimoPersonalFamiliar` · cifras BOE 2025
  - `escalaAutonomica` · tramos verificados
  - `deducciones[]` · TOP-3 según §1.6
    - `arrendamiento-vivienda-habitual` (si la CCAA la tiene · sus requisitos · sus topes)
    - `inversion-vivienda-habitual` o variante (si aplica)
    - `familia-numerosa` o `descendientes` (si aplica)
  - `verified=true` con fuente citada por cifra
  - `deflactacion2025` si aplica

### 4.4 · Para cada deducción · estructura mínima

```typescript
{
  id: 'cataluna-arrendamiento-vivienda-habitual',
  ccaa: 'Cataluña',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion: '10% de cantidades satisfechas con tope 300€ (600€ en algunos casos)',
  fuenteOficial: 'https://sede.agenciatributaria.gob.es/...',  // URL real
  verified: true,
  
  porcentaje: 0.10,
  topeAbsolutoIndividual: 300,
  
  requisitos: {
    edadMaxima: 32,                // ejemplo Cataluña · CC verifica real
    baseImponibleMaxIndividual: 20000,
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
  },
  
  calcularImporte: (ctx, datosBase) => {
    if (datosBase.alquilerAnual <= 0) return 0;
    return Math.min(datosBase.alquilerAnual * 0.10, 300);
  }
}
```

### 4.5 · Tests por CCAA

Por cada CCAA · al menos 4 tests:
- Test escala · BI 30.000 € · cuota autonómica esperada (calcular manualmente y citar)
- Test mínimo · contribuyente <65 años · mínimo aplicable correcto
- Test deducción ELEGIBLE · perfil que cumple TODOS los requisitos · importe correcto
- Test deducción NO ELEGIBLE · perfil que falla 1 requisito · motivo claro

### 4.6 · Verificación 18.1

- [ ] DB_VERSION sigue en 69 · 40 stores
- [ ] `tsc --noEmit` pasa
- [ ] Tests pasan · 5 CCAA × ~4 tests = 20 tests mínimo
- [ ] Cada CCAA con `verified=true` y fuentes citadas
- [ ] Si CCAA tiene cifras NO verificables al 100% · `verified=false` con TODOs concretos · documentado en PR
- [ ] Cero regresión en cálculo Madrid (debe seguir funcionando idéntico)

### 4.7 · PR 18.1

Título · `feat(fiscal): T18.1 · cobertura CCAA Top 5 mercado · Cataluña · Andalucía · Valencia · Baleares · Castilla y León`

**STOP-AND-WAIT** · publicar PR · Jose valida en deploy preview · NO arrancar 18.2 hasta merge.

---

## 5 · SUB-TAREA 18.2 · Mercado medio

### 5.1 · CCAA y razones

| Orden | CCAA |
|---|---|
| 1 | Galicia |
| 2 | Aragón (NOTA: NO tiene deducción general arrendamiento) |
| 3 | Asturias |
| 4 | Murcia |
| 5 | Cantabria |

### 5.2 · Entregables · igual que 18.1

Por CCAA · archivo dedicado · cifras BOE 2025 · TOP-3 deducciones · tests.

### 5.3 · Casos especiales esperados

- **Aragón** · NO tiene deducción general por arrendamiento · solo casos específicos (dación en pago · vivienda social arrendador). CC documenta ausencia explícitamente · NO inventa.
- **Asturias** · primera vez con mínimos autonómicos propios (Renta 2025) · cifras 6.105 € base · 1.265 € >65 · 1.540 € >75. Verificar.

### 5.4 · Verificación 18.2

Mismo patrón que 18.1.

### 5.5 · PR 18.2

Título · `feat(fiscal): T18.2 · cobertura CCAA mercado medio · Galicia · Aragón · Asturias · Murcia · Cantabria`

**STOP-AND-WAIT**.

---

## 6 · SUB-TAREA 18.3 · Resto + verificación final

### 6.1 · CCAA y razones

| Orden | CCAA |
|---|---|
| 1 | Canarias (régimen REF · cuidado con peculiaridades) |
| 2 | Castilla-La Mancha |
| 3 | Extremadura |
| 4 | La Rioja |

### 6.2 · Verificación final completa

- [ ] **15 CCAA régimen común** cubiertas
- [ ] Resto · sin TODOs críticos · solo deducciones nicho marcadas como TAREA futura
- [ ] Tests integración · usuario residente fiscal en CCAA distinta a Madrid · cálculo aplica reglas CCAA correcta
- [ ] `irpfCalculationService` NO tiene tablas inline · todo viene de `ccaaRules/`
- [ ] `verified=true` en TODAS las CCAA con cifras BOE verificadas
- [ ] Documento `docs/T18-cierre.md` con resumen · 15 CCAA cubiertas · TOP-3 deducciones por CCAA · TODOs nicho · referencia para futuras tareas fiscales

### 6.3 · PR 18.3

Título · `feat(fiscal): T18.3 · cobertura CCAA resto + verificación · Canarias · CLM · Extremadura · Rioja · cierre T18`

**Mergear PR · TAREA 18 cerrada formalmente.**

---

## 7 · Lo que esta tarea NO hace

- ❌ NO cubre **País Vasco** (3 territorios forales · TAREA futura)
- ❌ NO cubre **Navarra** (régimen foral · TAREA futura)
- ❌ NO cubre **deducciones autonómicas exóticas** (despoblación · estudios Grado/Máster · donaciones · inversiones SOCIMI · etc.) · solo TOP-3 por CCAA · TODOs documentados
- ❌ NO sube DB_VERSION
- ❌ NO toca personalData ni viviendaHabitual ni gateway fiscalContextService
- ❌ NO crea UI nueva · cálculos se enchufan al motor existente
- ❌ NO toca tributación conjunta vs individual · sigue lógica T14.3
- ❌ NO añade NUEVAS deducciones estatales · solo autonómicas

---

## 8 · Verificación post-deploy global

### 8.1 · Tests automáticos

- DB_VERSION = 69 · 40 stores · sin cambios
- `getReglasCcaa()` cubre las 15 CCAA régimen común
- Cada CCAA con tests escala + mínimos + deducción elegible + no elegible
- `irpfCalculationService` integra módulo nuevo sin regresión

### 8.2 · Verificación manual Jose

**Verificación 1 · Tu caso Madrid · sin regresión**
- Tu personalData con CCAA Madrid · cálculo IRPF idéntico a antes de T18 (cifras Madrid bien desde T14.3 + 18.0)

**Verificación 2 · Caso ficticio Galicia**
- Crear personalData ficticio · CCAA Galicia · 28 años · BI 18.000 € · alquiler vivienda habitual 4.000 €/año
- ATLAS aplica deducción 10% · tope 300 € · ELEGIBLE
- Si cambias edad a 38 · ATLAS marca NO ELEGIBLE · motivo "edad >35"

**Verificación 3 · Caso real Jose · arrendamiento Madrid NO elegible**
- Tu personalData real · Madrid · >40 años · BI superior
- ATLAS marca arrendamiento vivienda habitual NO ELEGIBLE · motivos "edad >40 · BI excede 25.620 €"

**Verificación 4 · Caso edge Aragón**
- personalData ficticio Aragón · alquiler vivienda habitual
- ATLAS NO encuentra deducción aplicable · informa "Aragón no tiene deducción general · solo casos específicos"

---

## 9 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| CC inventa cifras CCAA sin fuente | Alta | Regla 0.2 explícita · `verified=false` + TODO si no encuentra · NO inventa |
| Cifras 2024 vs 2025 confundidas (deflactación) | Alta | CC cita fuente con año explícito · prefiere AEAT manual práctico Renta 2025 |
| Helper `calcularCuotaBaseGeneralCCAA` rompe al refactorizar | Media | 18.0 obligatoria primera · test integración Madrid antes de extender |
| Cataluña 9 tramos · escala compleja | Media | Verificar contra Decret legislatiu Cataluña · CC cita fuente |
| Aragón · NO tiene deducción general · CC se confunde | Media | Spec lo dice explícito · CC documenta ausencia · NO inventa |
| Canarias · régimen REF (Régimen Económico Fiscal) | Media | NO afecta IRPF directamente pero puede tener peculiaridades en deducciones · CC consulta y documenta |
| Asturias · primer año mínimos propios · cifras nuevas | Media | CC verifica contra BOE Asturias 2025 |
| Solapamiento entre deducción estatal y autonómica | Media | Cada CCAA tiene sus propias reglas · ATLAS aplica ambas si cliente cumple · documentar |
| País Vasco / Navarra cliente real aparece | Baja | Etiqueta UI "ATLAS no soporta · contactar" + TODO TAREA foral futura |

---

## 10 · Después de T18

1. ATLAS soporta los 15 CCAA régimen común con motor de elegibilidad robusto
2. Cliente residente en cualquier CCAA · cálculo IRPF correcto
3. Descongelar **T36** · vista gastos sobre movements · cierra norte 1/1/2027
4. Plan: T-foral · País Vasco + Navarra · cuando aparezca cliente real
5. Plan: T-deducciones-nicho · cubrir deducciones autonómicas exóticas (despoblación · etc.) cuando aparezca demanda concreta

---

## 11 · Cómo lanzar cada sub-tarea a CC

### 11.1 · T18.0 (lanzar primero)

```
@CC ejecuta T18.0 · Motor elegibilidad genérico + Madrid verified
Spec · docs/TAREA-18-cobertura-ccaa-completa-v1.md · sección 3
Auditoría preflight · DB_VERSION = 69 · 40 stores · T14 cerrada · src/services/fiscal/ NO existe
Predecesor · main al día tras T14.5

ALCANCE
- src/services/fiscal/tipos.ts (interfaces §2.2)
- src/services/fiscal/ccaaRules/_base_estatal.ts
- src/services/fiscal/ccaaRules/madrid.ts (cifras BOE 2025 verified=true)
- src/services/fiscal/ccaaRules/index.ts (Map + fallback)
- src/services/fiscal/deduccionesAutonomicasService.ts (API §2.3)
- Refactor irpfCalculationService.calcularCuotaBaseGeneralCCAA para leer del módulo nuevo
- Tests §3.3 (7 tests mínimo)

REGLAS
- DB_VERSION sin cambios · sigue 69
- NO inventar cifras · cada cifra con fuente oficial citada
- Madrid debe estar verified=true (cifras conocidas · BOE Decreto Legislativo 1/2010 + Manual AEAT 2025)
- Si CC duda de alguna cifra · marca verified=false con TODO concreto + avisa · NO inventa
- 1 PR único contra main · stop-and-wait
- NO mergear sin autorización Jose

VERIFICACIÓN
- Tests §3.3 pasan
- Cálculo IRPF Madrid sin regresión vs T14.3
- App arranca sin errores · tsc --noEmit pasa

TIEMPO ESTIMADO CC real · 30-60 min
```

### 11.2 · T18.1 (lanzar tras merge T18.0)

```
@CC ejecuta T18.1 · Cobertura CCAA Top 5 mercado
Spec · docs/TAREA-18-cobertura-ccaa-completa-v1.md · sección 4
Auditoría preflight · DB_VERSION = 69 · 40 stores · T18.0 mergeada · src/services/fiscal/ existe
Predecesor · motor elegibilidad disponible · Madrid verified

ALCANCE · 5 CCAA con cifras BOE 2025 verificadas
- Cataluña · Andalucía · Valencia · Baleares · Castilla y León
- Por CCAA · mínimos · escala · TOP-3 deducciones según §1.6 · verified=true · fuentes citadas

REGLAS
- NO inventar cifras
- 1 PR único contra main · stop-and-wait
- Tests por CCAA según §4.5 (4 tests mínimo c/u)
- Si una CCAA tiene cifra dudosa · verified=false + TODO · NO inventa

TIEMPO ESTIMADO CC real · 1-2h
```

### 11.3 · T18.2 (lanzar tras merge T18.1)

```
@CC ejecuta T18.2 · Cobertura CCAA mercado medio
Spec · docs/TAREA-18-cobertura-ccaa-completa-v1.md · sección 5
Auditoría preflight · DB_VERSION = 69 · 40 stores · T18.1 mergeada

ALCANCE · 5 CCAA
- Galicia · Aragón · Asturias · Murcia · Cantabria
- Casos especiales · Aragón sin deducción general arrendamiento · documentar · Asturias mínimos propios primer año verificar

REGLAS · idénticas T18.1
TIEMPO ESTIMADO CC real · 1-2h
```

### 11.4 · T18.3 (lanzar tras merge T18.2)

```
@CC ejecuta T18.3 · Cobertura CCAA resto + cierre T18
Spec · docs/TAREA-18-cobertura-ccaa-completa-v1.md · sección 6
Auditoría preflight · DB_VERSION = 69 · 40 stores · T18.2 mergeada

ALCANCE · 4 CCAA + cierre
- Canarias (régimen REF · cuidado peculiaridades)
- Castilla-La Mancha · Extremadura · La Rioja
- docs/T18-cierre.md · resumen · 15 CCAA cubiertas · TOP-3 por CCAA · TODOs nicho

REGLAS · idénticas anteriores
TIEMPO ESTIMADO CC real · 1-2h

Mergear · TAREA 18 cerrada formalmente.
```

---

**Fin de spec T18 v1 · 4 sub-tareas con stop-and-wait estricto · cobertura 15 CCAA régimen común · motor de elegibilidad robusto · cero deducciones aplicadas sin evaluar requisitos.**
