# S-FISCAL-FIXES-1-4 · 4 correcciones matemáticas críticas

> **Tipo** · 4 fixes matemáticos sobre código fiscal existente · 5 sub-tareas · 1 PR único
> **Tiempo estimado** · 18-26h CC
> **Cierra** · errores matemáticos identificados en auditoría que validan al céntimo contra declaración IRPF 2024 real Jose
> **Validado contra** · Carles Buigas 2024 · FA32 2024 · T64 4D 2024 · 17 conceptos al céntimo
> **Bloqueante** · campaña declaración 2025 abril-junio 2026 · sin estos fixes la declaración sale mal
> **Reglas aplicadas** · regla canónica grep duro · stop-and-wait · NO tocar DB_VERSION · pre-flight obligatorio · 1 PR contra `main` sin mergear

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en sub-tarea 1** · grep duro sobre el repo real
2. **Si pre-flight revela contradicciones · STOP · documentar · esperar Jose**
3. **NO TOCAR DB_VERSION** · sigue v70
4. **NO crear stores nuevos** · trabajamos con los existentes
5. **Encadenar sub-tareas en una rama · 1 PR final único contra main**
6. **NO mergear · esperar Jose**
7. **NO arreglar 43 tests failing pre-existing**
8. **NO refactorizar arquitectura** · solo fixes matemáticos puntuales
9. **Tests obligatorios contra casos validados Jose 2024 · tolerancia ≤ 0,01€**
10. **Sentence case en UI**

---

## §1 · Resumen de los 4 fixes

| Fix | Severidad | Esfuerzo | Servicio afectado | Validado contra |
|---|---|---|---|---|
| **Fix 1 · N4 tope intereses+reparación** | 🔴 ALTA | S (4-6h) | `fiscalSummaryService` · `gastosInmuebleService` | T64 4D 2024 · 2.500 + 4.660 = 7.160 |
| **Fix 2 · N2 max() base amortización** | 🔴 ALTA | S (4-6h) | `aeatAmortizationService` o nuevo `baseAmortizacionService` | T64 5·01 · base 11.743,57 (VC) > 6.067,67 (coste) |
| **Fix 3 · N3 imputación a disposición correcta** | 🔴 ALTA | M (6-10h) | `simuladorFiscalService` + nuevo `imputacionRentaService` | T64 4D 2024 · 47.656,37 × 1,1% × 182/366 = 260,68 |
| **Fix 4 · % construcción 4 decimales** | 🟠 MEDIA | S (3-5h) | `properties.fiscalData` · todos los recalculadores | Buigas · base 57.989,36 con %constr internal > 2 decimales |

**Total · 18-26h CC** · 1 PR.

---

## §2 · Pre-flight obligatorio · sub-tarea 1

**Tiempo** · 45-60 min CC.

### Grep checklist

```bash
# 1. Servicios afectados existen
ls -la src/services/fiscalSummaryService.ts src/services/aeatAmortizationService.ts src/services/simuladorFiscalService.ts src/services/gastosInmuebleService.ts

# 2. Localizar tope intereses+reparación actual (Fix 1)
grep -nE "box0105|box0106|interesesAplicados|reparacionAplicada|topeAEAT" src/services/fiscalSummaryService.ts src/services/aeatAmortizationService.ts src/utils/aeatUtils.ts 2>/dev/null
grep -nE "calculateAEATLimits" src/utils/aeatUtils.ts 2>/dev/null

# 3. Localizar cálculo base amortización (Fix 2)
grep -nE "baseAmortizacion|baseAmortizable|constructionPercentage|max.*coste|max.*VC" src/services/aeatAmortizationService.ts src/services/declaracionDistributorService.ts 2>/dev/null

# 4. Localizar imputación a disposición (Fix 3)
grep -rnE "imputacion.*Renta|imputacionRenta|valorCatastral.*0\.011|valorCatastral.*0\.02|0089" src/services/ 2>/dev/null

# 5. Localizar % construcción almacenamiento (Fix 4)
grep -nE "constructionPercentage" src/services/db.ts src/types/property.ts src/services/declaracionDistributorService.ts 2>/dev/null
grep -nE "porcentajeConstruccion" src/services/declaracionDistributorService.ts 2>/dev/null

# 6. Verificar que tests existentes no se rompen
npx jest src/services/fiscalSummaryService.test.ts --listTests 2>/dev/null
grep -l "fiscalSummaryService\|aeatAmortizationService" src/**/*.test.ts 2>/dev/null

# 7. Verificar inmuebles reales que sirven de test
grep -nE "T64 4D|Carles Buigas|FA32|0654104TP7005S0009SS|6533404DG0263S0002TP|7949807TP6074N0006YM" src/ 2>/dev/null | head -5

# 8. Verificar propertyDays existe (Fix 3 lo necesita)
grep -nE "interface PropertyDays|propertyDays" src/services/db.ts src/services/propertyOccupancyService.ts 2>/dev/null
```

### Resultado esperado en commit
CC reporta ·
- Confirmar 4 servicios existen
- Pegar líneas relevantes de cada fix · estado actual del código
- Confirmar que tests existentes pasan ANTES de empezar (baseline)
- Detectar cualquier caso edge no esperado

### Caso STOP

Si algún servicio no existe o tiene estructura muy distinta a la documentada · STOP · esperar Jose.

---

## §3 · Sub-tarea 2 · Fix 1 · N4 tope intereses+reparación

**Tiempo** · 4-6h CC.

### Problema actual

`fiscalSummaryService.calculateFiscalSummary` lee `box0105` y `box0106` directamente sin aplicar tope ·

```typescript
box0105: casillas['0105'] || 0,
box0106: casillas['0106'] || 0,
```

Esto resulta en rendimiento neto incorrecto cuando hay arrastres entrantes.

### Solución

#### 1. Modificar `fiscalSummaryService.calculateFiscalSummary`

Reescribir la lógica de cálculo de gastos aplicados ·

```typescript
// Calcular gastos aplicados con tope N4
const ingresos = await calcularIngresos0102(propertyId, exerciseYear);  // ya existe lógica
const arrastresEntrantes = casillas['0103'] || 0;  // disponibles
const intereses = casillas['0105'] || 0;  // 0105 nuevo año
const reparacion = casillas['0106'] || 0;  // 0106 nuevo año

// R10 · aplicar primero arrastres entrantes hasta tope
const arrastresAplicados = Math.min(arrastresEntrantes, ingresos);  // 0104

// Tope efectivo para intereses+reparación
const topeEfectivo = ingresos - arrastresAplicados;

// Aplicar intereses+reparación hasta tope
const disponibleIntReparacion = intereses + reparacion;
const interesesReparacionAplicados = Math.min(disponibleIntReparacion, topeEfectivo);  // 0107

// Exceso que arrastra a 4 años
const excesoArrastre = disponibleIntReparacion - interesesReparacionAplicados;  // 0108

// Persistir resultado
summary.box0107 = interesesReparacionAplicados;
summary.box0108 = excesoArrastre;
summary.box0104 = arrastresAplicados;
```

#### 2. Extender interface `FiscalSummary`

```typescript
interface FiscalSummary {
  // ... campos existentes
  box0103?: number  // arrastres entrantes disponibles
  box0104?: number  // arrastres entrantes aplicados
  box0107?: number  // intereses+reparación aplicados (NUEVO)
  box0108?: number  // exceso arrastre saliente (NUEVO)
}
```

#### 3. Generar `aeatCarryForwards` con el exceso

Si `box0108 > 0` · crear registro en `aeatCarryForwards` ·

```typescript
if (excesoArrastre > 0) {
  await carryForwardService.add({
    propertyId,
    taxYear: exerciseYear,
    expirationYear: exerciseYear + 4,
    carryForwardType: 'excess_0105',  // o 'excess_0106' según proporción
    amount: excesoArrastre,
    appliedAmount: 0,
    remainingAmount: excesoArrastre,
  });
}
```

### Test obligatorio

```typescript
describe('Fix 1 · N4 tope intereses+reparación · T64 4D 2024', () => {
  it('aplicación correcta del tope', async () => {
    // Setup · gastos 0105 = 531.74 · 0106 = 32367.50 · ingresos = 7160 · arrastres entrantes = 2500
    const summary = await calculateFiscalSummary(t64_4d_id, 2024);
    
    expect(summary.box0104).toBeCloseTo(2500.00, 2);
    expect(summary.box0107).toBeCloseTo(4660.00, 2);
    expect(summary.box0108).toBeCloseTo(28239.24, 2);
    
    // Verificar que se generó arrastre saliente
    const arrastres = await carryForwardService.getByPropertyAndYear(t64_4d_id, 2024);
    expect(arrastres).toHaveLength(1);
    expect(arrastres[0].remainingAmount).toBeCloseTo(28239.24, 2);
    expect(arrastres[0].expirationYear).toBe(2028);
  });
});
```

### Criterios aceptación

- [ ] T64 4D 2024 · `box0104 + box0107 ≤ box0102` se cumple
- [ ] `box0108` genera registro en `aeatCarryForwards` con `expirationYear = ejercicio + 4`
- [ ] Carles Buigas 2024 · sin arrastres · `box0107 = 0` (no aplica · no hay reparación ni intereses)
- [ ] Tests pasan al céntimo
- [ ] Tests pre-existentes no se rompen

---

## §4 · Sub-tarea 3 · Fix 2 · N2 max() base amortización

**Tiempo** · 4-6h CC.

### Problema actual

Base amortización no aplica regla `max(por coste · por VC construcción)`. Solo lee del XML o calcula por coste.

### Solución

#### 1. Crear servicio `baseAmortizacionService.ts`

```typescript
// src/services/baseAmortizacionService.ts

import { initDB } from './db';
import { mejoraActivoService } from './mejoraActivoService';

export interface BaseAmortizacionResult {
  base: number;
  metodo: 'por_coste' | 'por_vc_construccion'; // cuál ganó max()
  desglose: {
    precioAdquisicion: number;
    gastosAdquisicion: number;
    porcentajeConstruccion: number;
    baseporCoste: number;       // (precio + gastos) × %construcción
    baseporVC: number;          // valor catastral construcción
    mejorasAcumuladas: number;
  };
}

export async function calcularBaseAmortizacion(
  propertyId: number,
  hastaAño: number
): Promise<BaseAmortizacionResult> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  if (!property) throw new Error(`Property ${propertyId} no existe`);
  
  // Datos de adquisición
  const precio = property.acquisitionCosts.price || 0;
  const gastos = sumarGastosAdquisicion(property.acquisitionCosts);
  const pctConstruccion = (property.fiscalData?.constructionPercentage || 0) / 100;
  const vcConstruccion = property.fiscalData?.constructionCadastralValue || 0;
  
  // Mejoras acumuladas hasta el año
  const mejorasAcumuladas = await mejoraActivoService.getTotalMejorasHastaEjercicio(
    propertyId,
    hastaAño
  );
  
  // Regla N2 · max() de los dos
  const baseporCoste = (precio + gastos) * pctConstruccion;
  const baseporVC = vcConstruccion;
  
  const baseSinMejoras = Math.max(baseporCoste, baseporVC);
  const metodo: 'por_coste' | 'por_vc_construccion' = 
    baseporCoste >= baseporVC ? 'por_coste' : 'por_vc_construccion';
  
  // Regla N1 · mejoras se suman ENTERAS · NO se les aplica %construcción
  const base = baseSinMejoras + mejorasAcumuladas;
  
  return {
    base,
    metodo,
    desglose: {
      precioAdquisicion: precio,
      gastosAdquisicion: gastos,
      porcentajeConstruccion: pctConstruccion * 100,
      baseporCoste,
      baseporVC,
      mejorasAcumuladas,
    },
  };
}

function sumarGastosAdquisicion(ac: any): number {
  return (ac.itp || 0) + (ac.iva || 0) + (ac.notary || 0) 
       + (ac.registry || 0) + (ac.management || 0) + (ac.psi || 0) 
       + (ac.realEstate || 0)
       + ((ac.other || []).reduce((s: number, i: any) => s + (i.amount || 0), 0));
}
```

#### 2. Integrar en `aeatAmortizationService`

Reemplazar lectura directa del XML con · "si existe XML usar · si no calcular con N2".

```typescript
async function obtenerBaseAmortizacion(propertyId: number, año: number): Promise<number> {
  const property = await db.get('properties', propertyId);
  
  // Estado A · si hay XML AEAT con valor declarado · usarlo
  if (property?.aeatAmortization?.baseAmortizacion && estaEnEstadoA(año)) {
    return property.aeatAmortization.baseAmortizacion;
  }
  
  // Estado B/C · calcular con regla N2 + N1
  const resultado = await calcularBaseAmortizacion(propertyId, año);
  return resultado.base;
}
```

### Test obligatorio

```typescript
describe('Fix 2 · N2 max() base amortización · T64 5·01 trastero', () => {
  it('gana valor catastral construcción cuando es mayor que coste', async () => {
    // Setup trastero · precio 10.000 · gastos 1.040,16 · %constr 54,96% · VC construcción 11.743,57
    const resultado = await calcularBaseAmortizacion(t64_501_id, 2024);
    
    expect(resultado.desglose.baseporCoste).toBeCloseTo(6067.67, 2);
    expect(resultado.desglose.baseporVC).toBeCloseTo(11743.57, 2);
    expect(resultado.metodo).toBe('por_vc_construccion');
    expect(resultado.base).toBeCloseTo(11743.57, 2);  // sin mejoras
  });
});

describe('Fix 2 · N1 mejoras enteras · T64 4D principal', () => {
  it('mejoras se suman al 100% sin aplicar %construcción', async () => {
    // T64 4D · precio 49.000 · gastos 5.850,61 · %constr 37,42% · VC construcción 17.833,86 · mejoras 2024 · 3.545,30
    const resultado = await calcularBaseAmortizacion(t64_4d_id, 2024);
    
    expect(resultado.desglose.baseporCoste).toBeCloseTo(20525.10, 2);  // (49.000+5.850,61) × 37,42%
    expect(resultado.desglose.baseporVC).toBeCloseTo(17833.86, 2);
    expect(resultado.metodo).toBe('por_coste');  // 20.525 > 17.833
    expect(resultado.desglose.mejorasAcumuladas).toBeCloseTo(3545.30, 2);
    expect(resultado.base).toBeCloseTo(24070.40, 2);  // 20.525,10 + 3.545,30
  });
});

describe('Fix 2 · Carles Buigas 2024', () => {
  it('precio + gastos × %construcción · sin mejoras', async () => {
    // Buigas · precio 98.831,47 · gastos 7.473,50 · %constr 54,55%
    const resultado = await calcularBaseAmortizacion(buigas_id, 2024);
    expect(resultado.base).toBeCloseTo(57989.36, 0.50);  // tolerancia 50 céntimos por % construcción 2 decimales · se cierra con Fix 4
  });
});
```

### Criterios aceptación

- [ ] T64 5·01 · base = 11.743,57 € (gana VC) ✓ al céntimo
- [ ] T64 4D · base = 24.070,40 € (coste + mejoras) ✓ al céntimo
- [ ] Buigas · base = 57.989,36 € (tolerancia 50 céntimos · se afina con Fix 4)
- [ ] Tests pasan
- [ ] Tests pre-existentes no se rompen

---

## §5 · Sub-tarea 4 · Fix 3 · N3 imputación renta a disposición

**Tiempo** · 6-10h CC.

### Problema actual

`simuladorFiscalService` calcula con VC hardcoded a 100.000 · tipo siempre 2% · divisor /365 fijo.

### Solución

#### 1. Crear servicio `imputacionRentaService.ts`

```typescript
// src/services/imputacionRentaService.ts

import { initDB } from './db';
import { propertyOccupancyService } from './propertyOccupancyService';

export interface ImputacionRentaResult {
  imputacion: number;
  desglose: {
    valorCatastral: number;
    valorCatastralRevisado: boolean;
    tipoAplicable: 1.1 | 2.0;  // %
    diasDisposicion: number;
    diasAño: number;
    formula: string;
  };
  alertas: string[];
}

function esBisiesto(año: number): boolean {
  return (año % 4 === 0 && año % 100 !== 0) || (año % 400 === 0);
}

function vcRevisadoEnUltimos10Años(fechaRevision: string | undefined, año: number): boolean {
  if (!fechaRevision) return false;
  const añoRevision = new Date(fechaRevision).getFullYear();
  return (año - añoRevision) <= 10;
}

export async function calcularImputacion(
  propertyId: number,
  año: number
): Promise<ImputacionRentaResult> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  if (!property) throw new Error(`Property ${propertyId} no existe`);
  
  const propertyDays = await propertyOccupancyService.getByPropertyAndYear(propertyId, año);
  const diasDisposicion = propertyDays?.daysAvailable || 0;
  const diasAño = esBisiesto(año) ? 366 : 365;
  
  // Si no hay disposición · imputación = 0
  if (diasDisposicion === 0) {
    return {
      imputacion: 0,
      desglose: { 
        valorCatastral: 0, 
        valorCatastralRevisado: false, 
        tipoAplicable: 2.0,
        diasDisposicion: 0, 
        diasAño,
        formula: 'sin días de disposición · imputación = 0',
      },
      alertas: [],
    };
  }
  
  const vc = property.fiscalData?.valorCatastralTotal || property.fiscalData?.cadastralValue || 0;
  if (vc === 0) {
    return {
      imputacion: 0,
      desglose: { valorCatastral: 0, valorCatastralRevisado: false, tipoAplicable: 2.0, diasDisposicion, diasAño, formula: 'sin VC' },
      alertas: ['Valor catastral no informado · imputación no se puede calcular · revisa la ficha del inmueble'],
    };
  }
  
  // Determinar tipo aplicable · 1.1% si revisado en últimos 10 años · 2% si no
  const revisado = property.fiscalData?.cadastralRevised || 
                   vcRevisadoEnUltimos10Años(property.fiscalData?.cadastralRevisionDate, año);
  const tipoAplicable = revisado ? 1.1 : 2.0;
  
  // Fórmula AEAT · VC × tipo/100 × días_disp / días_año
  const imputacion = vc * (tipoAplicable / 100) * diasDisposicion / diasAño;
  
  return {
    imputacion: Math.round(imputacion * 100) / 100,  // 2 decimales
    desglose: {
      valorCatastral: vc,
      valorCatastralRevisado: revisado,
      tipoAplicable,
      diasDisposicion,
      diasAño,
      formula: `${vc} × ${tipoAplicable}% × ${diasDisposicion}/${diasAño}`,
    },
    alertas: [],
  };
}
```

#### 2. Integrar en `fiscalSummaryService`

Cuando hay `propertyDays.daysAvailable > 0` · calcular imputación automáticamente y guardarla como `box0089` en el FiscalSummary.

#### 3. Eliminar/corregir el cálculo placeholder en `simuladorFiscalService`

Reemplazar las líneas con `100000 * 0.02` por llamada a `imputacionRentaService.calcularImputacion`.

### Test obligatorio

```typescript
describe('Fix 3 · N3 imputación renta a disposición · T64 4D 2024', () => {
  it('1,1% sobre VC revisado · 182 días disposición', async () => {
    // T64 4D · VC 47.656,37 · revisado SI · días disposición 182 · año bisiesto 366
    const r = await calcularImputacion(t64_4d_id, 2024);
    
    expect(r.desglose.tipoAplicable).toBe(1.1);
    expect(r.desglose.diasAño).toBe(366);
    expect(r.imputacion).toBeCloseTo(260.68, 2);
  });
});

describe('Fix 3 · sin disposición · imputación 0', () => {
  it('Carles Buigas arrendado todo el año · 0 imputación', async () => {
    // Buigas · 366 arrendado · 0 disposición
    const r = await calcularImputacion(buigas_id, 2024);
    expect(r.imputacion).toBe(0);
  });
});
```

### Criterios aceptación

- [ ] T64 4D 2024 · imputación = 260,68 € ✓ al céntimo
- [ ] Buigas 2024 · imputación = 0 (sin disposición)
- [ ] Cualquier inmueble sin VC · imputación = 0 + alerta
- [ ] Año bisiesto reconocido (366) · resto (365)
- [ ] VC revisado en últimos 10 años → 1,1% · si no → 2%
- [ ] `simuladorFiscalService` ya no tiene `100000 * 0.02`
- [ ] Tests pasan
- [ ] Tests pre-existentes no se rompen

---

## §6 · Sub-tarea 5 · Fix 4 · % construcción 4 decimales

**Tiempo** · 3-5h CC.

### Problema actual

`properties.fiscalData.constructionPercentage` se almacena con 2 decimales. AEAT internamente usa más decimales · da diferencias de céntimos en base amortización.

### Solución

#### 1. Cambiar precisión almacenamiento

No requiere cambio de schema (es `number` que ya soporta cualquier precisión) · pero asegurar que ·

```typescript
// declaracionDistributorService.ts · cuando lee XML
if (inm.porcentajeConstruccion && inm.porcentajeConstruccion > 0) {
  // Guardar con TODA la precisión que venga del XML (típicamente 2 decimales · pero podría tener más)
  next.fiscalData.constructionPercentage = inm.porcentajeConstruccion;
}

// Pero internamente · cuando se calcula desde VC · usar 4 decimales
function calcularPctConstruccion(vcConstruccion: number, vcTotal: number): number {
  if (vcTotal === 0) return 0;
  // Mantener 4 decimales internos · NO redondear a 2
  return Math.round((vcConstruccion / vcTotal) * 1000000) / 10000;  // 4 decimales
}
```

#### 2. UI muestra 2 decimales

En componentes que muestren el % · formato `toFixed(2)`. Pero los cálculos usan el valor completo.

#### 3. Si XML trae % calcular VC real desde casillas 0123/0124

Cuando importamos XML · si tenemos `valorCatastralTotal` y `valorCatastralConstruccion` reales · recalcular el % con 4 decimales en lugar de usar el % que viene declarado (que es el truncado a 2 decimales).

```typescript
// En declaracionDistributorService · al procesar inmueble
const vcTotal = inm.valorCatastral || 0;
const vcConstruccion = inm.valorCatastralConstruccion || 0;
const pctXML = inm.porcentajeConstruccion || 0;
const pctReal = calcularPctConstruccion(vcConstruccion, vcTotal);

// Usar el real (4 decimales) en lugar del declarado (2 decimales)
next.fiscalData.constructionPercentage = pctReal > 0 ? pctReal : pctXML;
```

### Test obligatorio

```typescript
describe('Fix 4 · % construcción 4 decimales · Carles Buigas', () => {
  it('cálculo desde VC en lugar de declarado redondeado', async () => {
    // Buigas · VC total 68.371,03 · VC construcción 37.294,08 · declarado 54,55%
    const pctReal = 37294.08 / 68371.03 * 100;
    expect(pctReal).toBeCloseTo(54.5503, 4);  // 4 decimales
    
    // Base amortización con %real
    const base = (98831.47 + 7473.50) * (pctReal / 100);
    expect(base).toBeCloseTo(57989.36, 0.10);  // tolerancia 10 céntimos (real es 57989.36)
  });
});
```

### Criterios aceptación

- [ ] Buigas · base amortización 57.989,36 € ✓ al céntimo (cierra el residual 3,60 € del Fix 2)
- [ ] T64 4D y 4IZ · sin cambio (sus % son exactos por construcción)
- [ ] Tests pasan
- [ ] Tests pre-existentes no se rompen

---

## §7 · Sub-tarea 6 · Test de integración · validación caso real Jose 2024

**Tiempo** · 1-2h CC.

### Plan

Test E2E que ejecuta `fiscalSummaryService.calculateFiscalSummary` sobre los 6 inmuebles de Jose en 2024 · valida que todos los rendimientos netos cuadran al céntimo contra la declaración real ·

```typescript
describe('Caso real Jose IRPF 2024 · todos los inmuebles cuadran al céntimo', () => {
  const casosReales = [
    { propertyId: fa32_id,    rendNeto: 5334.69,  rendNetoReducido: 3943.75 },
    { propertyId: buigas_id,  rendNeto: 18.91,    rendNetoReducido: 7.56 },
    { propertyId: t48_id,     rendNeto: 6108.79,  rendNetoReducido: 6108.79 },
    { propertyId: t64_4d_id,  rendNeto: -3019.47, rendNetoReducido: -3019.47 },
    { propertyId: t64_4iz_id, rendNeto: -2368.28, rendNetoReducido: -2368.28 },
    { propertyId: santJoan_id,rendNeto: 1924.55,  rendNetoReducido: 769.82 },
  ];
  
  for (const caso of casosReales) {
    it(`property ${caso.propertyId} · rendimiento neto reducido ${caso.rendNetoReducido}`, async () => {
      const summary = await calculateFiscalSummary(caso.propertyId, 2024);
      expect(summary.rendimientoNeto).toBeCloseTo(caso.rendNeto, 2);
      expect(summary.rendimientoNetoReducido).toBeCloseTo(caso.rendNetoReducido, 2);
    });
  }
});
```

### Criterios aceptación final

- [ ] **6/6 inmuebles cuadran al céntimo con la declaración 2024 real**
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests pre-existentes no se rompen (≤ 43 failing)
- [ ] DB_VERSION sigue 70
- [ ] No se han creado stores nuevos
- [ ] Documentación inline en cada servicio nuevo

---

## §8 · Reglas inviolables

1. NO tocar DB_VERSION
2. NO refactorizar arquitectura · solo fixes matemáticos
3. NO eliminar servicios existentes · solo añadir nuevos auxiliares y corregir cálculos en sitio
4. Tests al céntimo contra casos reales · tolerancia ≤ 0,01€ (salvo Buigas tras Fix 4 · tolerancia ≤ 0,01€)
5. NO mergear · stop-and-wait
6. Pre-flight obligatorio en sub-tarea 1
7. 1 PR único contra `main`

---

## §9 · Validación manual Jose tras merge

1. Ir a `/fiscal/2024`
2. Para cada uno de los 6 inmuebles ·
   - Verificar rendimiento neto coincide con declaración 2024
   - Verificar rendimiento neto reducido coincide
3. Para T64 4D especialmente ·
   - Verificar casilla 0107 = 4.660 €
   - Verificar casilla 0108 = 28.239,24 € · genera arrastre saliente
   - Verificar casilla 0089 imputación = 260,68 € (NO 986,30 €)
4. Para T64 5·01 trastero ·
   - Verificar base amortización = 11.743,57 € (NO 6.067,67 €)
5. Para Carles Buigas ·
   - Verificar base amortización = 57.989,36 € (NO 57.985,76 €)

---

## §10 · Lo que NO entra en este lote

- Fix 5 · `amortizacionAcumuladaService` para venta T48 · spec aparte mapa v4 §10
- R10 optimización fiscal · spec aparte
- Sub-unidades inmueble · spec aparte
- Migración snapshotsDeclaracion · resultadosEjercicio · arrastresIRPF · spec aparte
- Refactor a `casillaResolverService` único · spec aparte
- Cubrir resto de las 30 casillas · mapa v4 secciones pendientes

---

**Fin spec · 18-26h CC · 6 sub-tareas · 1 PR · listo para entregar a CC cuando Jose autorice.**
