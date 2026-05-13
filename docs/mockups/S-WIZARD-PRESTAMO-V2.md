# S-WIZARD-PRESTAMO-V2 · pantalla única · estilo ATLAS v8

> **Tipo** · Reemplazo completo del wizard crear/editar préstamo · 6 sub-tareas · 1 PR único
> **Tiempo estimado** · 10-16h CC (el más complejo de los 4 wizards · contiene lógica financiera crítica)
> **Cierra** · cuarto wizard reescrito en estilo ATLAS v8 · refuerza patrón sentado por nómina + inmueble + cuenta
> **Validado contra** · Contrato real Santander Jose · capital 78.500 € · TIN 4,99% · 96 cuotas · firma 12/05/2026 · primer cargo 01/07/2026 · cuota 993,43 € · carencia técnica 20 días · 214,64 €
> **Decisión Jose** · Préstamos antiguos importados (FA32, T64, ING T48, Unicaja, etc.) los borrará y volverá a crear desde cero · NO se aplica detección retroactiva
> **Reglas aplicadas** · regla canónica grep duro · stop-and-wait · NO reutilizar código del actual · pre-flight obligatorio · 1 PR contra `main` sin mergear hasta autorización Jose
> **Predecesor** · spec wizard nómina + inmueble + cuenta lanzados o en ejecución · TAREA 13 v4 mergeada · DB v70 · 40 stores
> **Sucesor** · wizard contrato · plan pensión

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en sub-tarea 1** · grep duro sobre el repo real
2. **Si pre-flight revela contradicciones** con el spec · STOP · documentar · esperar Jose
3. **NO reutilizar NADA del wizard actual** · 4 pasos · se elimina entero
4. **NO TOCAR DB_VERSION** · sigue v70
5. **Encadenar sub-tareas en una rama** · 1 PR final único contra `main`
6. **NO mergear** · esperar Jose
7. **NO arreglar 43 tests failing pre-existing**
8. **Mockup v2 es la guía visual literal** · paleta · espaciados · densidad · colores · tipografía
9. **Sentence case mandatory**
10. **Cálculos validados al céntimo contra el contrato Santander Jose** · cualquier desviación es un bug bloqueante
11. **El cuadro de amortización tiene 97 líneas (1 carencia + 96 cuotas)** en el caso Santander · y N+1 en cualquier caso con carencia técnica
12. **NO aplicar detección retroactiva** a préstamos existentes · solo a los creados/editados con este wizard nuevo

---

## §1 · Contexto · qué reemplaza esta tarea

### 1.1 · Wizard actual · estado · qué falla

URL · `/financiacion/prestamo_{id}/editar` (editar) · el botón de crear NO existe (bug · solo se llega editando uno existente)

Estructura actual · 4 pasos artificiales ·
- Paso 1 · Básico · cuenta cargo · alias · fechas · día cobro · esquema primer recibo (normal/solo intereses/prorrata)
- Paso 2 · Financiero · capital · plazo · carencia · TIN · comisiones · bonificaciones
- Paso 3 · Destino · multi-line con cuadre · garantía
- Paso 4 · Resumen · cuadro de amortización completo

Problemas detectados ·
- 4 pasos · todo cabe en 1 sola pantalla
- Sin preview live durante edición · obligas a llegar al paso 4
- Botón "Crear préstamo" NO existe · solo se llega editando · sin punto de entrada
- Botón "Amortizar anticipado" deshabilitado · funcionalidad crítica sin disponer
- Selección en navy (Fijo · Carencia Ninguna · Comprar inmueble) en lugar de **oro**
- Bonificaciones · botones "+ Añadir" en navy · deben ser oro
- "Esquema primer recibo" mal modelado · `Normal | Solo intereses | Prorrata` son etiquetas confusas
- **Carencia técnica NO modelada** · genera desviaciones del 1-3% en intereses totales · TAE incorrecta
- "Variable" y "Mixto" no piden Euríbor + diferencial + período fijo inicial + referencia revisión
- Cuadro de amortización tiene N cuotas pero NO incluye el cargo separado de carencia técnica · de ahí las desviaciones

### 1.2 · Wizard nuevo · objetivo

1 sola pantalla · modal full-screen · 2 columnas · 9 bloques · estilo ATLAS v8 · **detección automática de carencia técnica** · cuadro de amortización N+1 líneas cuando aplica · botón "Amortizar anticipado" habilitado · cálculos validados al céntimo.

### 1.3 · Caso real Jose como dogfood

Contrato Santander Jose (firmado 12/05/2026) ·

| Campo | Valor exacto |
|---|---|
| Capital | 78.500,00 € |
| TIN fijo | 4,99% |
| Plazo | 96 meses |
| Fecha firma | 12/05/2026 |
| Cuenta asociada | ES61 0049 0052 6322 1041 2715 (Santander 2715) |
| Día cobro | 1 de cada mes |
| Primer cargo cuadro | 01/07/2026 |
| Vencimiento | 01/06/2034 |
| TAE | 5,10% |
| Cuota mensual | 993,43 € (última 993,47 € por redondeo) |
| Total intereses cuadro | 16.869,32 € |
| Carencia técnica | 20 días (12/05 → 01/06) · 214,64 € · recibo separado el 01/06 |
| Total intereses contrato | 17.083,96 € |
| Interés demora | 6,99% |
| Gastos reclamación impago | 49,00 € |
| Comisión apertura | 0,00% |

**Validación matemática al céntimo** ·

```python
C = 78500; TIN = 0.0499; n = 96
cuota = C * (TIN/12 * (1+TIN/12)**n) / ((1+TIN/12)**n - 1) = 993.43 €  ✓
intereses_carencia = 78500 × 0.0499 × 20 / 365 = 214.64 €  ✓
total_intereses = (96 × 993.43 − 78500) + 214.64 = 17.083,96 €  ✓
```

---

## §1.5 · Prerequisito Jose · subir mockup al repo

Antes de lanzar este spec a CC · Jose sube `atlas-wizard-prestamo-v2.html` al repo en ·

```
docs/mockups/atlas-wizard-prestamo-v2.html
```

CC verifica con `ls docs/mockups/atlas-wizard-prestamo-v2.html` en sub-tarea 1. Si no existe · STOP.

---

## §2 · Reglas de cálculo del motor financiero · CRÍTICAS

### 2.1 · Detección de carencia técnica

```typescript
function detectarCarenciaTecnica(
  fechaFirma: Date,
  primerCargoCuadro: Date,
  diaCobro: number
): { existe: boolean; dias: number; fechaLiquidacion: Date; } {
  // Si día de firma === día de cobro · NO hay carencia técnica
  if (fechaFirma.getDate() === diaCobro) {
    return { existe: false, dias: 0, fechaLiquidacion: null };
  }
  
  // Fecha de liquidación de carencia técnica
  //   = día de cobro del mes siguiente a la firma
  const fechaLiquidacion = new Date(
    fechaFirma.getFullYear(),
    fechaFirma.getMonth() + 1,
    diaCobro
  );
  
  // Días entre firma y liquidación
  const dias = diasEntre(fechaFirma, fechaLiquidacion);
  
  return { existe: true, dias, fechaLiquidacion };
}
```

### 2.2 · Cálculo de intereses de carencia técnica

```typescript
function calcularInteresesCarenciaTecnica(
  capital: number,
  tinAnual: number,  // 0.0499
  dias: number
): number {
  return capital * tinAnual * dias / 365;
}

// Verificación · 78500 * 0.0499 * 20 / 365 = 214.64 € ✓
```

### 2.3 · Cálculo de cuota · sistema francés

```typescript
function calcularCuotaFrances(
  capital: number,
  tinMensual: number,  // TIN anual / 12
  numCuotas: number
): number {
  return capital * (tinMensual * Math.pow(1 + tinMensual, numCuotas))
                / (Math.pow(1 + tinMensual, numCuotas) - 1);
}

// Verificación · 78500, 0.0499/12, 96 → 993.43 € ✓
```

### 2.4 · Generación del cuadro de amortización · N+1 líneas si carencia técnica

```typescript
function generarCuadroAmortizacion(input: PrestamoInput): LineaCuadro[] {
  const lineas: LineaCuadro[] = [];
  const carencia = detectarCarenciaTecnica(...);
  
  // Línea 0 · si existe carencia técnica
  if (carencia.existe) {
    lineas.push({
      numero: 0,
      fecha: carencia.fechaLiquidacion,
      tipo: 'carencia_tecnica',
      capitalAmortizado: 0,
      intereses: calcularInteresesCarenciaTecnica(...),
      cuota: calcularInteresesCarenciaTecnica(...),
      capitalPendiente: input.capital,
    });
  }
  
  // Líneas 1 a N · cuotas del cuadro francés
  let capitalPendiente = input.capital;
  const tinMensual = input.tinAnual / 12;
  const cuota = calcularCuotaFrances(input.capital, tinMensual, input.numCuotas);
  
  for (let i = 1; i <= input.numCuotas; i++) {
    const intereses = capitalPendiente * tinMensual;
    const capitalAmortizado = cuota - intereses;
    capitalPendiente -= capitalAmortizado;
    
    lineas.push({
      numero: i,
      fecha: calcularFechaCuota(i, ...),
      tipo: 'cuota',
      capitalAmortizado,
      intereses,
      cuota,
      capitalPendiente,
    });
  }
  
  // Ajuste última cuota · si quedan céntimos por redondeo
  // Sumar/restar a la última cuota para que capitalPendiente sea 0
  
  return lineas;
}
```

### 2.5 · Generación de Treasury Events al guardar

```typescript
function generarTreasuryEvents(prestamo: Prestamo): TreasuryEvent[] {
  const events: TreasuryEvent[] = [];
  
  // 1. Entrada de capital · día de firma
  events.push({
    fecha: prestamo.fechaFirma,
    tipo: 'ingreso',
    importe: prestamo.capital,
    cuentaId: prestamo.cuentaCargoId,
    concepto: `Disposición préstamo ${prestamo.alias}`,
    prestamoId: prestamo.id,
  });
  
  // 2. Liquidación carencia técnica · si aplica
  const carencia = detectarCarenciaTecnica(...);
  if (carencia.existe) {
    events.push({
      fecha: carencia.fechaLiquidacion,
      tipo: 'gasto',
      importe: calcularInteresesCarenciaTecnica(...),
      cuentaId: prestamo.cuentaCargoId,
      concepto: `Liquidación carencia técnica · ${carencia.dias} días · ${prestamo.alias}`,
      prestamoId: prestamo.id,
      esDeducibleFiscalmente: detectarDeducibilidad(prestamo),
    });
  }
  
  // 3. Cuotas del cuadro · 96 eventos
  for (let i = 1; i <= prestamo.numCuotas; i++) {
    events.push({
      fecha: calcularFechaCuota(i, ...),
      tipo: 'gasto',
      importe: cuotas[i].cuota,
      cuentaId: prestamo.cuentaCargoId,
      concepto: `Cuota ${i}/${prestamo.numCuotas} · ${prestamo.alias}`,
      prestamoId: prestamo.id,
      desglose: { capital: cuotas[i].capitalAmortizado, intereses: cuotas[i].intereses },
      esDeducibleFiscalmente: detectarDeducibilidad(prestamo),
    });
  }
  
  return events;
}
```

### 2.6 · Detección de deducibilidad fiscal · destino vs garantía

La deducibilidad de los intereses (casilla 0105 IRPF) depende del **destino del capital** · NO de la garantía ·

```typescript
function detectarDeducibilidad(prestamo: Prestamo): {
  porcentajeDeducible: number;
  desglosePorInmueble: { inmuebleId: number; porcentaje: number; }[];
} {
  const destinos = prestamo.destinosDelCapital;
  
  let totalDeducible = 0;
  const desglose = [];
  
  for (const destino of destinos) {
    if (destino.tipo === 'adquisicion_inmueble' || destino.tipo === 'reforma_inmueble') {
      // SI el inmueble está alquilado o tiene uso económico
      // → 100% de su % es deducible
      const inmueble = getInmueble(destino.inmuebleId);
      if (inmueble.usoTipo !== 'vivienda_habitual' && inmueble.usoTipo !== 'disponible') {
        totalDeducible += destino.porcentaje;
        desglose.push({ inmuebleId: destino.inmuebleId, porcentaje: destino.porcentaje });
      }
    } else if (destino.tipo === 'cancelar_deuda') {
      // Si la deuda cancelada era deducible · este % también
      // (caso ING T48 · cancelación deuda anterior)
      // Heredar deducibilidad de la deuda original
      // ...lógica más compleja · documentar caso por caso
    }
    // 'personal', 'otro' → NO deducible
  }
  
  return { porcentajeDeducible: totalDeducible, desglosePorInmueble: desglose };
}
```

---

## §3 · Sub-tareas en orden

### Sub-tarea 1 · Pre-flight · localizar arquitectura actual

**Tiempo** · 45-60 min CC

#### Pre-flight obligatorio

```bash
# Verificar mockup subido
ls -la docs/mockups/atlas-wizard-prestamo-v2.html

# Localizar wizard actual
grep -rnE "prestamo.*editar|EditarPrestamo|NuevoPrestamo|PrestamoWizard" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
find src/ -type f \( -name "*Prestamo*" -o -name "*prestamo*" -o -name "*Loan*" \) 2>/dev/null

# Localizar componentes de los 4 pasos
grep -rnE "1.*Básico|2.*Financiero|3.*Destino|4.*Resumen|Paso [1234]" src/ --include="*.tsx" 2>/dev/null | head -20

# Localizar servicio y store
find src/services -type f \( -name "prestamo*" -o -name "loan*" -o -name "financiacion*" \) 2>/dev/null
grep -rnE "prestamosService|loanService|financiacionService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Schema del store prestamos
grep -rnE "objectStore.*\"prestamos\"|createObjectStore.*prestamos" src/ --include="*.ts" 2>/dev/null
grep -rnE "interface Prestamo|type Prestamo|interface Loan" src/types/ --include="*.ts" 2>/dev/null

# Verificar campos críticos del schema actual
grep -rnE "capital|tin|plazo|carencia|destinos|garantia|bonificaciones" src/types/ src/services/prestamo* 2>/dev/null | head -30

# Verificar si existe campo carenciaTecnica · interesDemora · gastoReclamacion (probablemente NO)
grep -rnE "carenciaTecnica|interesDemora|gastoReclamacion" src/ 2>/dev/null | head -10

# Verificar cuadroAmortizacionService · cómo genera el cuadro actualmente
grep -rnE "cuadroAmortizacion|amortizationSchedule|generarCuadro" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
find src/ -type f -name "*amortizacion*" 2>/dev/null

# Verificar generación de treasuryEvents desde préstamo
grep -rnE "treasuryEvents.*prestamo|prestamo.*treasuryEvent|generarEventos.*prestamo" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar afectacionesInmueble · destino del capital
grep -rnE "afectacionesInmueble|destinoCapital|destinosCapital|allocationFactor" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Botón "Amortizar anticipado" actual · deshabilitado
grep -rnE "amortizar.*anticipado|amortizacionAnticipada|AmortizarAnticipado" src/ --include="*.tsx" 2>/dev/null | head -10

# Botón crear (que dice Jose no existe)
grep -rnE "Crear préstamo|Nuevo préstamo|/financiacion/nuevo|prestamo/nuevo" src/ --include="*.tsx" 2>/dev/null | head -10
```

#### Resultado esperado en commit
CC reporta ·
- Path exacto del wizard actual · 4 pasos
- Servicio prestamosService · API completa
- Schema TypeScript actual del tipo Prestamo · qué campos hay · qué falta
- Si existe `cuadroAmortizacionService` · cómo genera el cuadro · qué fórmulas usa
- Si existe ya generación de treasuryEvents desde préstamo · cómo
- Confirmar que NO existe botón "Crear préstamo" (bug actual)
- Confirmar que el botón "Amortizar anticipado" está deshabilitado · path
- Listar préstamos existentes en producción (al menos count) · Jose decide si los borra antes de mergear

#### Caso STOP
Si el schema o la generación del cuadro están muy lejos del spec · STOP · documentar · esperar Jose.

---

### Sub-tarea 2 · Eliminación completa del wizard actual

**Tiempo** · 30-45 min CC

#### Plan
1. Eliminar TODOS los componentes del wizard actual (4 pasos)
2. **NO eliminar** ·
   - `prestamosService` · se reusa
   - Store `prestamos` · se reusa
   - Tipo TS global `Prestamo` · se extiende (sub-tarea 4)
   - `cuadroAmortizacionService` si existe · se reescribe (sub-tarea 5)
3. Mantener la ruta `/financiacion/prestamo_{id}/editar` para que el wizard nuevo la use
4. Crear NUEVA ruta `/financiacion/nuevo` para crear (no existe actualmente · bug)

#### Criterios aceptación
- [ ] Pre-flight pegado en commit message
- [ ] Componentes del wizard actual eliminados
- [ ] Servicios + store + tipo global intactos
- [ ] App compila · build pasa · type check pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 3 · Motor financiero · función pura `prestamoCalculatorService`

**Tiempo** · 2-3h CC

#### Plan
Crear `src/services/prestamoCalculatorService.ts` con las 5 funciones del §2 ·

```typescript
export interface PrestamoInput {
  capital: number;
  tinAnual: number;  // 0.0499 = 4.99%
  numCuotas: number;
  fechaFirma: Date;
  primerCargoCuadro: Date;  // calculado o introducido
  diaCobro: number;  // 1-31
  carenciaInicial?: { tipo: 'ninguna' | 'solo_capital' | 'total'; meses: number; };
  comisiones?: {
    apertura?: number; mantenimiento?: number;
    amortAnticipada?: number; modifCondiciones?: number;
    reclamacionImpago?: number;  // típicamente 49€
  };
  interesDemora?: number;
  bonificaciones?: { tipo: string; ppDescuento: number; }[];
}

export interface CuadroAmortizacion {
  lineas: LineaCuadro[];
  resumen: {
    cuotaMensual: number;
    totalCuotas: number;
    totalIntereses: number;
    interesesCuadro: number;
    interesesCarenciaTecnica: number;
    tae: number;
    tinEfectivo: number;  // TIN tras bonificaciones aplicadas
    fechaUltimaCuota: Date;
    capitalTotal: number;
    numLineas: number;  // N+1 si hay carencia técnica
  };
}

// 5 funciones documentadas en §2:
export function detectarCarenciaTecnica(...): CarenciaTecnica;
export function calcularInteresesCarenciaTecnica(...): number;
export function calcularCuotaFrances(...): number;
export function generarCuadroAmortizacion(input: PrestamoInput): CuadroAmortizacion;
export function generarTreasuryEvents(prestamo: Prestamo): TreasuryEvent[];
```

**Tests unitarios obligatorios** · validar contra contrato Santander Jose ·

```typescript
describe('prestamoCalculatorService', () => {
  const santander = {
    capital: 78500,
    tinAnual: 0.0499,
    numCuotas: 96,
    fechaFirma: new Date(2026, 4, 12),  // 12/05/2026
    primerCargoCuadro: new Date(2026, 6, 1),  // 01/07/2026
    diaCobro: 1,
  };
  
  it('cuota Santander · 993,43 €', () => {
    expect(calcularCuotaFrances(78500, 0.0499/12, 96)).toBeCloseTo(993.43, 2);
  });
  
  it('carencia técnica · 20 días', () => {
    const c = detectarCarenciaTecnica(santander.fechaFirma, santander.primerCargoCuadro, 1);
    expect(c.existe).toBe(true);
    expect(c.dias).toBe(20);
    expect(c.fechaLiquidacion).toEqual(new Date(2026, 5, 1));  // 01/06/2026
  });
  
  it('intereses carencia técnica · 214,64 €', () => {
    expect(calcularInteresesCarenciaTecnica(78500, 0.0499, 20)).toBeCloseTo(214.64, 2);
  });
  
  it('cuadro Santander · 97 líneas · línea 0 + 96 cuotas', () => {
    const cuadro = generarCuadroAmortizacion(santander);
    expect(cuadro.lineas).toHaveLength(97);
    expect(cuadro.lineas[0].tipo).toBe('carencia_tecnica');
    expect(cuadro.lineas[0].intereses).toBeCloseTo(214.64, 2);
    expect(cuadro.lineas[1].cuota).toBeCloseTo(993.43, 2);
    expect(cuadro.lineas[96].fecha).toEqual(new Date(2034, 5, 1));  // 01/06/2034
  });
  
  it('total intereses Santander · 17.083,96 €', () => {
    const cuadro = generarCuadroAmortizacion(santander);
    expect(cuadro.resumen.totalIntereses).toBeCloseTo(17083.96, 2);
  });
  
  it('caso sin carencia técnica · firma día cobro coincide', () => {
    const input = { ...santander, fechaFirma: new Date(2026, 4, 1) };  // 01/05/2026
    const c = detectarCarenciaTecnica(input.fechaFirma, input.primerCargoCuadro, 1);
    expect(c.existe).toBe(false);
    const cuadro = generarCuadroAmortizacion(input);
    expect(cuadro.lineas).toHaveLength(96);  // sin línea 0
  });
});
```

#### Criterios aceptación sub-tarea 3
- [ ] 5 funciones implementadas · puras · sin efectos
- [ ] Tests unitarios pasan TODOS contra contrato Santander · ≤ 1 céntimo de tolerancia
- [ ] Caso sin carencia técnica · validado
- [ ] Caso con bonificaciones · TIN efectivo calculado correctamente
- [ ] Caso con carencia inicial (solo capital · total) · cuadro correcto

---

### Sub-tarea 4 · Extensión schema TypeScript Prestamo

**Tiempo** · 30-45 min CC

#### Plan
Extender el tipo `Prestamo` con campos nuevos ·

```typescript
interface Prestamo {
  // Campos existentes (CC valida en sub-tarea 1)
  id: number;
  alias: string;
  capital: number;
  // ...
  
  // Campos NUEVOS · añadir si no existen
  tipo: 'hipotecario' | 'personal' | 'linea_credito' | 'otro';
  banco: string;
  cuentaCargoId: number;  // FK a accounts
  numeroContrato?: string;
  
  fechaFirma: Date;
  primerCargoCuadro: Date;
  diaCobro: number;
  
  tipoInteres: 'fijo' | 'variable' | 'mixto';
  tinAnual: number;
  // Si variable
  diferencial?: number;
  referenciaInteres?: 'euribor_12m' | 'euribor_6m' | 'euribor_3m';
  fechaRevision?: 'anual' | 'semestral' | 'trimestral';
  // Si mixto
  periodoFijoMeses?: number;
  tinPeriodoFijo?: number;
  
  interesDemora?: number;
  
  comisiones: {
    apertura: number;  // %
    mantenimiento: number;  // €/mes
    amortAnticipada: number;  // %
    modifCondiciones: number;  // %
    reclamacionImpago: number;  // € (típicamente 49)
  };
  
  bonificaciones: { tipo: string; ppDescuento: number; activa: boolean; }[];
  
  carenciaInicial: {
    tipo: 'ninguna' | 'solo_capital' | 'total';
    meses: number;
  };
  
  destinosDelCapital: {
    tipo: 'adquisicion_inmueble' | 'reforma_inmueble' | 'cancelar_deuda' | 'inversion' | 'personal' | 'otro';
    inmuebleId?: number;  // FK a properties · si tipo es adquisicion o reforma
    importe: number;
    porcentaje: number;
    descripcion?: string;
  }[];
  
  garantia: {
    tipo: 'hipotecaria' | 'personal' | 'pignoraticia';
    inmuebleId?: number;  // si tipo hipotecaria · FK a properties
    descripcion?: string;
  };
}
```

#### Criterios aceptación sub-tarea 4
- [ ] Schema extendido sin breaking changes
- [ ] Campos existentes intactos · solo añadir nuevos
- [ ] Type check pasa en TODO el código que usa Prestamo

---

### Sub-tarea 5 · Implementación nueva pantalla única

**Tiempo** · 4-6h CC

#### Plan
Crear · `src/pages/financiacion/PrestamoPage.tsx` (o equivalente).

Conectar a 2 rutas ·
- `/financiacion/nuevo` (modo create · NO existía · bug · ahora SÍ)
- `/financiacion/prestamo_{id}/editar` (modo edit · ya existía)

Botón "Nuevo préstamo" en página de Financiación · gold · navega a `/financiacion/nuevo`.

**Layout estructural** · ver mockup `docs/mockups/atlas-wizard-prestamo-v2.html` como guía visual literal.

9 bloques en el form ·
1. Tipo de préstamo · 4 cards · Hipotecario · Personal · Línea crédito · Otro
2. Identificación · Alias · Banco · Cuenta cargo · Nº contrato
3. Importe y plazo · Capital · Plazo (meses/años) · Fecha firma · Primer cargo · Día cobro
4. Tipo de interés · Fijo / Variable / Mixto · campos varían
5. Comisiones · Apertura · Mantenimiento · Amort anticipada · Modif condiciones · Reclamación impago
6. Bonificaciones · toggle · catálogo 4 cards + personalizada
7. Carencia inicial · Ninguna / Solo capital / Total
8. Destino del capital · multi-line · concepto + inmueble vinculado + importe + % · cuadre 100%
9. Garantía · 3 cards · Hipotecaria · Personal · Pignoraticia

Preview derecha · live ·
- KPI principal navy · Cuota mensual
- KPIs mini · TIN efectivo + TAE
- Desglose · capital + intereses cuadro + liquidación carencia técnica (si aplica) + comisiones = total
- Gráfico mini · capital pendiente vs años
- Alerta amber · deducibilidad fiscal según destino
- Botón · "Ver cuadro de amortización completo · N líneas"

Footer · 3 botones ·
- "Amortizar anticipado" (ghost · habilitado · abre modal aparte · NO entra en este lote · solo el botón visible)
- "Cancelar" (ghost)
- "Guardar préstamo" (primary gold)

#### Criterios aceptación sub-tarea 5
- [ ] Mockup `docs/mockups/atlas-wizard-prestamo-v2.html` reproducido fielmente
- [ ] 9 bloques implementados · visibilidad condicional aplicada (campos según tipo · interés · carencia)
- [ ] Preview live actualizado en tiempo real al cambiar cualquier campo numérico
- [ ] Cuadro de amortización (al desplegar botón) muestra N+1 líneas si carencia técnica
- [ ] Cero hex hardcoded · 100% tokens CSS
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 6 · Cableado fuentes · guardado · generación Treasury Events

**Tiempo** · 2-3h CC

#### Plan
1. **Lectura · al abrir el wizard** ·
   - Si modo edit · cargar préstamo desde `prestamosService.get(id)`
   - Cargar cuentas para selector `accountsService.list()`
   - Cargar inmuebles para destinos `propertiesService.list()`
2. **Guardado · al pulsar "Guardar préstamo"** ·
   - Validar campos obligatorios · errores claros
   - Validar cuadre destino vs capital · debe ser 100% (suma de % = 100 ± 0,01)
   - Llamar `prestamosService.upsert(...)` con todos los campos
3. **Generación Treasury Events** · llamar a `generarTreasuryEvents(prestamo)` y crear ·
   - 1 evento entrada de capital (día firma)
   - 1 evento liquidación carencia técnica (si aplica · día fin carencia)
   - N eventos cuotas del cuadro
   - Cada evento con metadata · `prestamoId`, `desglose: {capital, intereses}`, `esDeducibleFiscalmente`
4. **Si modo edit** · eliminar treasuryEvents anteriores con `prestamoId === id` y regenerar
5. **NO escribir** en `inmuebles` · `cuentas` desde aquí · solo lectura

#### Criterios aceptación sub-tarea 6
- [ ] Lectura desde fuentes correctas (cuentas · inmuebles)
- [ ] Validación · cuadre destinos · campos obligatorios
- [ ] Guardado funcional · datos persistidos en `prestamos`
- [ ] Treasury Events generados correctamente · validar manualmente caso Santander · 1 entrada + 1 carencia + 96 cuotas = 98 eventos
- [ ] Modo edit · eventos antiguos eliminados antes de regenerar (sin duplicados)

---

## §4 · Reglas inviolables

1. NO reutilizar código del wizard actual · eliminación completa
2. NO subir DB_VERSION · sigue v70
3. **Cálculos validados al céntimo contra contrato Santander** · cualquier desviación es bloqueante
4. **Cuadro de amortización tiene N+1 líneas si hay carencia técnica** · línea 0 destacada visualmente
5. **Cuota del cuadro nunca cambia por carencia técnica** · siempre 993,43 € (caso Santander)
6. La carencia técnica es un cargo SEPARADO · NO suplemento de la primera cuota
7. NO aplicar detección retroactiva a préstamos existentes
8. NO incluir lógica de "amortizar anticipado" · solo el botón visible · funcionalidad en spec aparte
9. NO mergear · stop-and-wait
10. Selección visual = oro en TODOS los elementos seleccionables
11. Mockup `docs/mockups/atlas-wizard-prestamo-v2.html` es referencia visual literal
12. Cero hex hardcoded · 100% tokens CSS
13. Función `prestamoCalculatorService` pura · sin efectos · con tests obligatorios
14. Sentence case

---

## §5 · Criterios de aceptación globales

- [ ] 6 sub-tareas ejecutadas en orden
- [ ] Pre-flight pegado en commit message de sub-tarea 1
- [ ] 1 PR final único contra `main` con commits separados por sub-tarea
- [ ] PR description con tabla resumen + screenshots vs mockup + resultados tests Santander
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Usuario crea préstamo Santander · cuota 993,43 € · carencia técnica 214,64 € · cuadro 97 líneas · total intereses 17.083,96 € · cuadra al céntimo con contrato real**

---

## §6 · Validación manual Jose tras merge

1. Borrar todos los préstamos antiguos importados (FA32, T64, ING T48, Unicaja, etc.) según decisión Jose
2. Abrir `/financiacion/nuevo` (modo create)
3. Verificar layout · 2 columnas · header navy · footer fijo
4. Introducir datos contrato Santander ·
   - Tipo Personal
   - Alias "Santander preconcedido"
   - Banco Santander · Cuenta Santander 2715 · Nº contrato 00490052611430005465
   - Capital 78.500,00 · Plazo 96 meses · Firma 12/05/2026 · Primer cargo 01/07/2026 · Día cobro 1
   - Tipo Fijo · TIN 4,99% · Demora 6,99%
   - Comisiones · Reclamación 49 €
   - Sin bonificaciones · sin carencia inicial
   - Destino "Personal" · 100%
   - Garantía Personal
5. Verificar preview live ·
   - Cuota mensual 993,43 € EXACTO
   - TIN efectivo 4,99% · TAE 5,10%
   - Desglose · Capital 78.500 + Intereses cuadro 16.869,32 + Carencia técnica 214,64 + Comisión 0 = Total 95.583,96 €
6. Click "Ver cuadro de amortización completo · 97 líneas"
7. Verificar línea 0 · Fecha 01/06/2026 · Tipo carencia técnica · Intereses 214,64 € · sin capital amortizado
8. Verificar línea 1 · Fecha 01/07/2026 · Cuota 993,43 €
9. Verificar línea 96 · Fecha 01/06/2034 · Cuota 993,47 € (ajuste último redondeo)
10. Guardar préstamo
11. Ir a Tesorería · verificar ·
    - 1 entrada 78.500 € el 12/05/2026
    - 1 salida 214,64 € el 01/06/2026 (carencia técnica)
    - 96 salidas 993,43 € (la última 993,47) del 01/07/2026 al 01/06/2034
12. Verificar botón "Amortizar anticipado" visible (aunque funcionalidad sea spec aparte)

---

## §7 · Lo que NO entra en este lote

- Funcionalidad completa de "Amortizar anticipado" · solo el botón visible · spec aparte
- Lógica de préstamos variable · Euríbor + diferencial · revisión periódica · spec aparte (este wizard permite introducir los campos pero el motor solo calcula correctamente con tipo fijo en v2 · variable/mixto pendiente refinamiento)
- Wizards siguientes (contrato · plan pensión)
- TAREA 14 · configuración fiscal sitio único
- Modal de cuadro de amortización completo con filtros/exportación · este lote solo muestra el cuadro como tabla simple desplegable

---

## §8 · Patrón sentado · refuerza el de wizard nómina + inmueble + cuenta

Tras este wizard mergeado · queda confirmado el patrón ATLAS v8 con su mayor caso de complejidad financiera ·

| Patrón | Validado en |
|---|---|
| 1 sola pantalla · sin pasos | Los 4 wizards |
| 2 columnas · form + preview live | Los 4 wizards |
| Motor de cálculo puro · función separada · tests obligatorios | Nómina, inmueble, préstamo |
| Generación Treasury Events automática al guardar | Nómina, préstamo |
| Visibilidad condicional silenciosa según tipo/selectores | Inmueble, préstamo |
| Cálculos validados contra documento real al céntimo | Nómina (certificado AEAT), préstamo (contrato Santander) |

---

**Fin del spec.**
**Listo para entregar a CC tras Jose subir `atlas-wizard-prestamo-v2.html` a `docs/mockups/`.**
