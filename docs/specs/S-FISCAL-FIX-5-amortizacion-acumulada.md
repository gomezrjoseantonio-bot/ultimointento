# S-FISCAL-FIX-5-amortizacion-acumulada · cálculo ganancia patrimonial venta inmueble

> **Tipo** · 1 servicio nuevo + extensión store existente + 1 orquestador + UI mínima · 7 sub-tareas · 1 PR único
> **Tiempo estimado** · 22-30h CC
> **Cierra** · permite calcular correctamente ganancia patrimonial venta inmueble · respeta amortización mínima + paralelas + arrastres FIFO
> **Validado contra** · caso T48 venta 2025 · datos reales declaración 2024 + datos Jose
> **Bloqueante** · campaña declaración 2025 abril-junio 2026 · sin este fix la declaración de la venta T48 sale mal
> **Pre-requisito** · fixes 1-4 mergeados (sobre todo Fix 2 max() base amortización es necesario para coherencia)
> **Reglas aplicadas** · regla canónica grep duro · stop-and-wait · NO tocar DB_VERSION · pre-flight obligatorio · 1 PR contra `main` sin mergear

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en sub-tarea 1** · grep duro sobre el repo real
2. **Si pre-flight revela contradicciones · STOP · documentar · esperar Jose**
3. **NO TOCAR DB_VERSION** · sigue v70 (extender `propertySales` no requiere bump · es el mismo store con campos opcionales nuevos)
4. **Encadenar sub-tareas en una rama · 1 PR final único contra main**
5. **NO mergear · esperar Jose**
6. **NO arreglar 43 tests failing pre-existing**
7. **NO refactorizar arquitectura** · solo añadir nuevo servicio + orquestador + UI mínima
8. **Tests obligatorios contra caso T48 · tolerancia ≤ 1 €** (margen mayor que fixes 1-4 porque hay placeholders del usuario)
9. **Datos T48 marcados como `[CONFIRMAR JOSE]` deben quedar en código como placeholders editables · no hardcoded**
10. **Sentence case en UI**

---

## §1 · Resumen de lo que entrega este fix

| Componente | Tipo | Estado |
|---|---|---|
| `amortizacionAcumuladaService` | Servicio nuevo | crear |
| `gananciaPatrimonialService` | Servicio nuevo · orquestador | crear |
| `propertySales` store | Existente · 0 registros · extender campos | extender (NO bump DB) |
| `properties.amortizacionHistoricaAcumulada` | Campo derivado · cache | añadir opcional |
| UI · `RegistrarVentaPage` | Página nueva | crear |
| UI · ficha inmueble · "Vendido" estado | Existe parcial · completar | extender |

---

## §2 · Pre-flight obligatorio · sub-tarea 1

**Tiempo** · 45-60 min CC.

### Grep checklist

```bash
# 1. Confirmar fixes 1-4 mergeados (pre-requisito)
git log --oneline -20 | grep -i "fixes 1-4\|fix.*tope\|fix.*max\|fix.*imputacion\|fix.*construccion"

# 2. Servicios relevantes existen
ls -la src/services/aeatAmortizationService.ts src/services/mobiliarioActivoService.ts src/services/mejoraActivoService.ts src/services/baseAmortizacionService.ts 2>/dev/null

# 3. Store propertySales · estructura actual
grep -nE "propertySales|PropertySale|interface.*Sale" src/services/db.ts src/types/property.ts 2>/dev/null

# 4. Servicio propertySaleService si existe
ls -la src/services/propertySaleService.ts 2>/dev/null
grep -rnE "propertySaleService" src/ --include="*.ts" 2>/dev/null | head -5

# 5. Cómo se marca un inmueble como vendido hoy
grep -rnE "estado.*vendido|status.*sold|isSold|fechaVenta" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# 6. Compensación pérdidas existente
grep -rnE "compensacionAhorro|saldoNegativoArrastre|aeatCarryForwards.*ganan" src/services/ 2>/dev/null | head -5

# 7. UI ficha inmueble · donde se marca vendido hoy
grep -rnE "Vendido|Vender|MarcarVendido|RegistrarVenta" src/pages/ src/components/ 2>/dev/null | head -10

# 8. Verificar que propertyDays tiene datos por año
grep -nE "propertyDays.*daysRented" src/services/propertyOccupancyService.ts 2>/dev/null

# 9. T48 ID en producción
grep -rnE "0454010TP7005S0012TS|Tenderina 48|TENDERINA 0048" src/ 2>/dev/null | head -3
```

### Resultado esperado en commit
CC reporta ·
- Confirmar fixes 1-4 mergeados (commits que los incluyen)
- Estructura actual `propertySales` schema
- Si existe `propertySaleService` · qué métodos
- Cómo se navega desde ficha inmueble al "marcar como vendido" hoy
- T48 propertyId en producción
- Cualquier obstáculo encontrado

### Caso STOP

- Si fixes 1-4 NO están mergeados · STOP · esperar
- Si `propertySales` tiene estructura muy distinta a la documentada · STOP · esperar Jose

---

## §3 · Sub-tarea 2 · `amortizacionAcumuladaService` (servicio nuevo)

**Tiempo** · 5-7h CC.

### Propósito

Acumular año a año todas las amortizaciones deducidas (o imputables por regla mínima) sobre un inmueble · sirviendo de input para calcular ganancia patrimonial en venta.

### Crear `src/services/amortizacionAcumuladaService.ts`

```typescript
import { initDB } from './db';
import { calcularBaseAmortizacion } from './baseAmortizacionService';  // Fix 2
import { calcularAmortizacionMobiliarioAnual } from './mobiliarioActivoService';
import { mejorasInmuebleService } from './mejorasInmuebleService';
import { propertyOccupancyService } from './propertyOccupancyService';
import { snapshotDeclaracionService } from './snapshotDeclaracionService';

export type FuenteAmortizacion = 
  | 'A.xml'                  // viene de XML AEAT
  | 'A.pdf'                  // viene de PDF parseado
  | 'A.calculado'            // ATLAS calculó con base + días
  | 'A.manual'               // usuario tecleó
  | 'A.sin_detalle'          // usuario dijo "declaré pero no recuerdo"
  | 'B.calculado'            // año ocurrido no declarado · ATLAS calcula
  | 'B.minima_imputada'      // años sin declaración pero arrendado · regla amortización mínima

export interface AmortizacionAño {
  año: number
  diasArrendado: number
  diasAño: number  // 365 o 366
  amortInmueble: number     // 3% × base × días/año
  amortMobiliario: number   // 10% × suma muebles × días/año
  amortMejoras: number      // 3% × suma mejoras × días/año (cada mejora desde su año)
  fuente: FuenteAmortizacion
  baseUsada: number         // base amortización usada (puede haber cambiado por paralela)
  versionParalela?: number  // si se aplicó corrección post-paralela
  alertas: string[]
}

export interface AmortizacionAcumuladaResult {
  propertyId: number
  fechaCompra: string
  hastaFecha: string  // típicamente fecha venta · si no · 31/12/año en curso
  porAño: AmortizacionAño[]
  totales: {
    amortInmuebleAcumulada: number
    amortMobiliarioAcumulada: number
    amortMejorasAcumulada: number
    total: number
  }
  aplicadasReglas: {
    amortizacionMinima: boolean   // si se imputó por regla mínima en algún año
    paralelasAplicadas: number[]  // años corregidos por paralela
    huecos: number[]              // años donde falta info · imputado por mínima
  }
}

export async function calcularAmortizacionAcumulada(
  propertyId: number,
  hastaFecha: string  // ISO date
): Promise<AmortizacionAcumuladaResult> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  if (!property) throw new Error(`Property ${propertyId} no existe`);
  
  const fechaCompra = property.purchaseDate;
  if (!fechaCompra) throw new Error(`Property ${propertyId} sin fecha compra · imposible calcular acumulada`);
  
  const añoCompra = new Date(fechaCompra).getFullYear();
  const añoHasta = new Date(hastaFecha).getFullYear();
  
  const porAño: AmortizacionAño[] = [];
  const aplicadasReglas = {
    amortizacionMinima: false,
    paralelasAplicadas: [] as number[],
    huecos: [] as number[],
  };
  
  for (let año = añoCompra; año <= añoHasta; año++) {
    const calc = await calcularAmortizacionAño(propertyId, año, fechaCompra, hastaFecha);
    porAño.push(calc);
    
    if (calc.fuente === 'B.minima_imputada') {
      aplicadasReglas.amortizacionMinima = true;
      aplicadasReglas.huecos.push(año);
    }
    if (calc.versionParalela && calc.versionParalela > 1) {
      aplicadasReglas.paralelasAplicadas.push(año);
    }
  }
  
  // Totales
  const totales = porAño.reduce((acc, a) => ({
    amortInmuebleAcumulada: acc.amortInmuebleAcumulada + a.amortInmueble,
    amortMobiliarioAcumulada: acc.amortMobiliarioAcumulada + a.amortMobiliario,
    amortMejorasAcumulada: acc.amortMejorasAcumulada + a.amortMejoras,
    total: acc.total + a.amortInmueble + a.amortMobiliario + a.amortMejoras,
  }), { amortInmuebleAcumulada: 0, amortMobiliarioAcumulada: 0, amortMejorasAcumulada: 0, total: 0 });
  
  return {
    propertyId,
    fechaCompra,
    hastaFecha,
    porAño,
    totales,
    aplicadasReglas,
  };
}

async function calcularAmortizacionAño(
  propertyId: number,
  año: number,
  fechaCompra: string,
  hastaFecha: string,
): Promise<AmortizacionAño> {
  const esBisiesto = (año % 4 === 0 && año % 100 !== 0) || (año % 400 === 0);
  const diasAño = esBisiesto ? 366 : 365;
  
  // Días reales arrendado este año · considerando fechaCompra y hastaFecha
  const fechaInicioAño = new Date(año, 0, 1);
  const fechaFinAño = new Date(año, 11, 31, 23, 59, 59);
  const inicioEfectivo = new Date(Math.max(fechaInicioAño.getTime(), new Date(fechaCompra).getTime()));
  const finEfectivo = new Date(Math.min(fechaFinAño.getTime(), new Date(hastaFecha).getTime()));
  
  // diasArrendado · leer de propertyDays si existe · si no · inferir
  const propertyDays = await propertyOccupancyService.getByPropertyAndYear(propertyId, año);
  const diasArrendado = propertyDays?.daysRented || 0;
  
  // ¿Hay declaración A para este año?
  const snapshot = await snapshotDeclaracionService.getByPropertyAndYear(propertyId, año);
  
  if (snapshot && snapshot.casillas) {
    // Estado A · usar datos declarados
    return {
      año,
      diasArrendado,
      diasAño,
      amortInmueble: Number(snapshot.casillas['0131'] || snapshot.casillas['0115'] || 0),
      amortMobiliario: Number(snapshot.casillas['0117'] || 0),
      amortMejoras: 0,  // se desglosa solo desde 2025 · antes va dentro de 0131
      fuente: snapshot.fuente === 'xml_aeat' ? 'A.xml' : 
              snapshot.fuente === 'pdf_aeat' ? 'A.pdf' : 
              snapshot.fuente === 'manual' ? 'A.manual' : 'A.calculado',
      baseUsada: Number(snapshot.casillas['0130'] || 0),
      versionParalela: snapshot.version,
      alertas: [],
    };
  }
  
  // Estado B · año pasado sin declaración Y arrendado
  if (diasArrendado > 0) {
    const baseResult = await calcularBaseAmortizacion(propertyId, año);
    const amortInm = baseResult.base * 0.03 * diasArrendado / diasAño;
    const amortMob = await calcularAmortizacionMobiliarioAnual(propertyId, año, diasArrendado, 0);
    
    return {
      año,
      diasArrendado,
      diasAño,
      amortInmueble: amortInm,
      amortMobiliario: amortMob || 0,
      amortMejoras: 0,
      fuente: 'B.calculado',
      baseUsada: baseResult.base,
      alertas: [],
    };
  }
  
  // Estado B con regla amortización mínima
  // Si el inmueble está sin arrendar pero está disponible · NO se imputa amortización
  // Si estuvo arrendado parte y no se declaró · imputar la mínima del 3%
  return {
    año,
    diasArrendado: 0,
    diasAño,
    amortInmueble: 0,
    amortMobiliario: 0,
    amortMejoras: 0,
    fuente: 'B.minima_imputada',
    baseUsada: 0,
    alertas: [`Año ${año} sin declaración y sin datos de propertyDays · ATLAS asume 0 días arrendado · revisa este año si el inmueble estuvo alquilado`],
  };
}
```

### Test obligatorio

```typescript
describe('amortizacionAcumuladaService · T48 vendido 18/11/2025', () => {
  it('acumula amortización inmueble desde compra 23/09/2022 hasta venta', async () => {
    const r = await calcularAmortizacionAcumulada(t48_id, '2025-11-18');
    
    expect(r.fechaCompra).toBe('2022-09-23');
    expect(r.porAño).toHaveLength(4);  // 2022, 2023, 2024, 2025
    
    // Año 2024 declarado · debe coincidir con declaración real
    const año2024 = r.porAño.find(a => a.año === 2024);
    expect(año2024?.amortInmueble).toBeCloseTo(1893.31, 2);  // declarado
    expect(año2024?.fuente).toBe('A.xml');
    
    // 2025 calculado · días arrendado hasta 18/11
    const año2025 = r.porAño.find(a => a.año === 2025);
    expect(año2025?.fuente).toBe('B.calculado');
    
    // Total acumulado coherente
    expect(r.totales.amortInmuebleAcumulada).toBeGreaterThan(4000);
    expect(r.totales.amortInmuebleAcumulada).toBeLessThan(7000);
  });
});
```

### Criterios aceptación sub-tarea 2

- [ ] Servicio creado · exporta `calcularAmortizacionAcumulada`
- [ ] Para años con snapshot · usa los datos declarados sin recalcular
- [ ] Para años sin snapshot · usa base × 3% × días con regla N2 vía `baseAmortizacionService`
- [ ] Detecta huecos · año arrendado sin declaración · marca para usuario revisar
- [ ] Tests pasan contra T48 estimado
- [ ] Tests pre-existentes no se rompen

---

## §4 · Sub-tarea 3 · Extender `propertySales` store

**Tiempo** · 2-3h CC.

### Schema extendido (sin bump DB · campos opcionales)

```typescript
interface PropertySale {
  id?: number
  propertyId: number               // FK a properties
  
  // Datos básicos venta
  fechaVenta: string               // ISO date · obligatorio
  precioVentaEscritura: number     // obligatorio
  
  // Gastos venta · todos opcionales · cliente puede no introducirlos
  gastosVenta?: {
    notariaVenta?: number
    registroPropiedad?: number
    gestoriaVenta?: number
    agenciaInmobiliaria?: number
    plusvaliaMunicipal?: number    // IIVTNU
    cancelacionHipoteca?: number   // notaría + registro de la cancelación
    certificadoEnergetico?: number
    cedulaHabitabilidad?: number
    ibiProrrateadoEntregado?: number
    honorariosAbogado?: number
    otros?: { concepto: string; importe: number }[]
  }
  
  // Cálculo derivado (cache · se recalcula si cambia algo)
  calculoDerivado?: {
    valorTransmision: number       // precioVenta − gastos
    amortizacionAcumulada: number  // desde amortizacionAcumuladaService
    valorAdquisicionActualizado: number
    gananciaBruta: number
    abatimientoAplicado: number    // 0 si fecha compra ≥ 1995
    gananciaReducida: number
    compensacionesAplicadas: {
      origen: number              // año origen
      importe: number
    }[]
    gananciaTributable: number
    impuestoEstimado: number       // tipo ahorro
    fechaCalculo: string
  }
  
  estado: 'borrador' | 'confirmada' | 'declarada'
  notas?: string
  createdAt: string
  updatedAt: string
}
```

### Implementación

Si `propertySales` ya existe con menos campos · solo añadir campos opcionales nuevos. No requiere bump de DB porque IndexedDB no valida schema rígido.

### Criterios aceptación sub-tarea 3

- [ ] Schema extendido sin breaking changes
- [ ] CRUD funciona con los nuevos campos
- [ ] Lecturas antiguas no se rompen (campos opcionales)

---

## §5 · Sub-tarea 4 · `gananciaPatrimonialService` (orquestador)

**Tiempo** · 6-8h CC.

### Crear `src/services/gananciaPatrimonialService.ts`

```typescript
import { initDB } from './db';
import { calcularAmortizacionAcumulada } from './amortizacionAcumuladaService';
import { compensacionAhorroService } from './compensacionAhorroService';

export interface CalculoGananciaInput {
  propertyId: number
  fechaVenta: string
  precioVentaEscritura: number
  gastosVenta?: PropertySale['gastosVenta']
}

export interface CalculoGananciaResult {
  // Inputs usados
  inputs: CalculoGananciaInput
  
  // Valor transmisión
  valorTransmision: number          // precio − gastos venta
  desgloseGastosVenta: { concepto: string; importe: number }[]
  
  // Valor adquisición
  valorAdquisicionOriginal: number  // precio + gastos AEAT al comprar
  amortizacionAcumulada: number     // del servicio acumulada
  mejorasAcumuladas: number         // sumadas
  valorAdquisicionActualizado: number  // original + mejoras − amort
  
  // Ganancia
  gananciaBruta: number             // transmision − adquisicion_actualizado
  
  // Abatimiento DT 9ª · solo si pre-1995
  aplicaAbatimiento: boolean
  abatimientoCalculado: number
  gananciaReducida: number
  
  // Compensaciones (R10 · FIFO)
  compensacionesDisponibles: {
    año: number
    importe: number
    caduca: string  // ISO date
  }[]
  compensacionesAplicadas: {
    año: number
    importe: number
    razon: string  // por ej "saldo 2022 caduca antes"
  }[]
  
  // Resultado
  gananciaTributable: number
  
  // Impuesto estimado (tipo ahorro 2025)
  impuestoEstimado: number
  desgloseImpuesto: {
    tramo: string
    importe: number
    tipo: number
  }[]
  
  // R10 · método más beneficioso usado
  metodoAplicado: string
  alternativasNoEscogidas: string[]
  
  // Alertas
  alertas: string[]
}

export async function calcularGananciaPatrimonial(
  input: CalculoGananciaInput
): Promise<CalculoGananciaResult> {
  const db = await initDB();
  const property = await db.get('properties', input.propertyId);
  if (!property) throw new Error(`Property ${input.propertyId} no existe`);
  
  // 1. Valor transmisión
  const gastos = input.gastosVenta || {};
  const sumaGastosVenta = (gastos.notariaVenta || 0)
    + (gastos.registroPropiedad || 0)
    + (gastos.gestoriaVenta || 0)
    + (gastos.agenciaInmobiliaria || 0)
    + (gastos.plusvaliaMunicipal || 0)
    + (gastos.cancelacionHipoteca || 0)
    + (gastos.certificadoEnergetico || 0)
    + (gastos.cedulaHabitabilidad || 0)
    + (gastos.ibiProrrateadoEntregado || 0)
    + (gastos.honorariosAbogado || 0)
    + ((gastos.otros || []).reduce((s, o) => s + o.importe, 0));
  
  const valorTransmision = input.precioVentaEscritura - sumaGastosVenta;
  
  // 2. Valor adquisición original
  const precio = property.acquisitionCosts?.price || 0;
  const gastosAdq = sumarGastosAdquisicion(property.acquisitionCosts);
  const valorAdquisicionOriginal = precio + gastosAdq;
  
  // 3. Amortización acumulada
  const amortAcum = await calcularAmortizacionAcumulada(input.propertyId, input.fechaVenta);
  
  // 4. Mejoras acumuladas
  const mejorasAcumuladas = 0;  // TODO sumar de mejorasInmuebleService
  
  // 5. Valor adquisición actualizado
  const valorAdquisicionActualizado = valorAdquisicionOriginal + mejorasAcumuladas - amortAcum.totales.total;
  
  // 6. Ganancia bruta
  const gananciaBruta = valorTransmision - valorAdquisicionActualizado;
  
  // 7. Abatimiento DT 9ª · solo si pre-1995
  const fechaCompra = new Date(property.purchaseDate || '');
  const aplicaAbatimiento = fechaCompra.getFullYear() < 1995;
  const abatimientoCalculado = aplicaAbatimiento 
    ? calcularAbatimientoDT9(gananciaBruta, fechaCompra, new Date(input.fechaVenta))
    : 0;
  const gananciaReducida = gananciaBruta - abatimientoCalculado;
  
  // 8. Compensaciones disponibles · R10 FIFO
  const arrastres = await compensacionAhorroService.getDisponibles();
  const compensacionesDisponibles = arrastres.map(a => ({
    año: a.ejercicioOrigen,
    importe: a.importePendiente,
    caduca: `${a.ejercicioCaducidad}-12-31`,
  })).sort((a, b) => a.año - b.año);  // más antiguo primero · caduca antes
  
  // Aplicar compensaciones FIFO
  let saldoCompensar = Math.max(0, gananciaReducida);
  const compensacionesAplicadas: typeof compensacionesDisponibles = [];
  
  for (const comp of compensacionesDisponibles) {
    if (saldoCompensar <= 0) break;
    const aplicar = Math.min(comp.importe, saldoCompensar);
    compensacionesAplicadas.push({ año: comp.año, importe: aplicar, razon: `Saldo ${comp.año} · caduca ${comp.caduca}` });
    saldoCompensar -= aplicar;
  }
  
  const gananciaTributable = saldoCompensar;
  
  // 9. Impuesto estimado · tramos ahorro 2025
  const desgloseImpuesto = calcularTramosAhorro2025(gananciaTributable);
  const impuestoEstimado = desgloseImpuesto.reduce((s, d) => s + d.importe, 0);
  
  // Alertas
  const alertas: string[] = [];
  if (amortAcum.aplicadasReglas.huecos.length > 0) {
    alertas.push(`Faltan datos de arrendamiento en años · ${amortAcum.aplicadasReglas.huecos.join(', ')} · revisa antes de presentar la declaración`);
  }
  if (sumaGastosVenta === 0) {
    alertas.push('No has introducido gastos de venta · puedes estar pagando impuesto de más · revisa notaría · gestoría · agencia · plusvalía municipal · cancelación hipoteca');
  }
  if (compensacionesDisponibles.length === 0 && gananciaTributable > 0) {
    alertas.push('No hay arrastres de pérdidas patrimoniales disponibles · si tienes alguna pérdida patrimonial este año (cripto · acciones) compensa antes');
  }
  
  return {
    inputs: input,
    valorTransmision,
    desgloseGastosVenta: [
      ...(gastos.notariaVenta ? [{ concepto: 'Notaría venta', importe: gastos.notariaVenta }] : []),
      ...(gastos.plusvaliaMunicipal ? [{ concepto: 'Plusvalía municipal', importe: gastos.plusvaliaMunicipal }] : []),
      // ... resto
    ],
    valorAdquisicionOriginal,
    amortizacionAcumulada: amortAcum.totales.total,
    mejorasAcumuladas,
    valorAdquisicionActualizado,
    gananciaBruta,
    aplicaAbatimiento,
    abatimientoCalculado,
    gananciaReducida,
    compensacionesDisponibles,
    compensacionesAplicadas,
    gananciaTributable,
    impuestoEstimado,
    desgloseImpuesto,
    metodoAplicado: 'FIFO compensación arrastres más antiguos primero (R10 minimiza pérdida por caducidad)',
    alternativasNoEscogidas: ['LIFO · arrastres más nuevos primero · aumenta riesgo de caducidad'],
    alertas,
  };
}

function calcularTramosAhorro2025(base: number): { tramo: string; importe: number; tipo: number }[] {
  if (base <= 0) return [];
  const tramos: { tramo: string; importe: number; tipo: number }[] = [];
  
  // Tramos IRPF ahorro 2025
  const limites = [
    { hasta: 6000,    tipo: 0.19 },
    { hasta: 50000,   tipo: 0.21 },
    { hasta: 200000,  tipo: 0.23 },
    { hasta: 300000,  tipo: 0.27 },
    { hasta: Infinity,tipo: 0.30 },
  ];
  
  let restante = base;
  let acumulado = 0;
  for (const t of limites) {
    const tramoBase = Math.min(restante, t.hasta - acumulado);
    if (tramoBase <= 0) break;
    tramos.push({
      tramo: `${acumulado.toLocaleString()} - ${(acumulado + tramoBase).toLocaleString()} €`,
      importe: tramoBase * t.tipo,
      tipo: t.tipo,
    });
    restante -= tramoBase;
    acumulado += tramoBase;
    if (restante <= 0) break;
  }
  
  return tramos;
}

function calcularAbatimientoDT9(ganancia: number, fechaCompra: Date, fechaVenta: Date): number {
  // Implementación pre-1995 · simplificada · solo aplicaría si fechaCompra < 1995
  // Fórmula completa LIRPF DT 9ª · prorrateo días + coeficiente abatimiento + tope 400k
  // Caso T48 (compra 2022) NO aplica · retorna 0
  // Pendiente implementación completa para otros clientes ATLAS
  return 0;
}

function sumarGastosAdquisicion(ac: any): number {
  if (!ac) return 0;
  return (ac.itp || 0) + (ac.iva || 0) + (ac.notary || 0) 
       + (ac.registry || 0) + (ac.management || 0) + (ac.psi || 0) 
       + (ac.realEstate || 0)
       + ((ac.other || []).reduce((s: number, i: any) => s + (i.amount || 0), 0));
}
```

### Test obligatorio

```typescript
describe('gananciaPatrimonialService · T48 venta 2025', () => {
  it('calcula ganancia tributable T48 con arrastres aplicados', async () => {
    const input = {
      propertyId: t48_id,
      fechaVenta: '2025-11-18',
      precioVentaEscritura: 185000,
      gastosVenta: {
        // placeholders · cliente real introduciría
        notariaVenta: 0,  // [CONFIRMAR JOSE]
        plusvaliaMunicipal: 0,  // [CONFIRMAR JOSE]
        cancelacionHipoteca: 0,  // [CONFIRMAR JOSE]
      },
    };
    
    const r = await calcularGananciaPatrimonial(input);
    
    // Valor adquisición original · de declaración 2024
    expect(r.valorAdquisicionOriginal).toBeCloseTo(151380.36, 0.50);
    
    // Amortización acumulada · estimación
    expect(r.amortizacionAcumulada).toBeGreaterThan(4000);
    expect(r.amortizacionAcumulada).toBeLessThan(7000);
    
    // Ganancia bruta · estimación
    expect(r.gananciaBruta).toBeGreaterThan(35000);
    expect(r.gananciaBruta).toBeLessThan(45000);
    
    // Compensaciones aplicadas · saldos 2022 y 2023
    expect(r.compensacionesAplicadas.length).toBeGreaterThan(0);
    
    // Ganancia tributable · estimación 10k aprox
    expect(r.gananciaTributable).toBeGreaterThan(5000);
    expect(r.gananciaTributable).toBeLessThan(15000);
    
    // No abatimiento · compra 2022
    expect(r.aplicaAbatimiento).toBe(false);
  });
});
```

### Criterios aceptación sub-tarea 4

- [ ] Servicio creado · función `calcularGananciaPatrimonial`
- [ ] Aplica R10 FIFO en compensaciones (arrastres más antiguos primero)
- [ ] Detecta huecos en amortización · alertas claras
- [ ] Calcula tramos ahorro 2025 correctos
- [ ] Test T48 cuadra dentro de rangos esperados
- [ ] No requiere abatimiento para T48 (post-1995)

---

## §6 · Sub-tarea 5 · UI · `RegistrarVentaPage`

**Tiempo** · 5-7h CC.

### Crear `src/pages/inmuebles/RegistrarVentaPage.tsx`

Página accesible desde ficha de inmueble · botón "Marcar como vendido".

### Bloques de la UI

1. **Datos de la venta** (obligatorio) · fecha venta · precio venta escritura
2. **Gastos de venta** (opcional · pero R10 los pide explícitamente)
   - Notaría · gestoría · agencia · plusvalía municipal · cancelación hipoteca · IBI prorrateado · otros
3. **Preview live de la plusvalía**
   - Valor transmisión
   - Valor adquisición actualizado · desglose · original + mejoras − amortización acumulada
   - Ganancia bruta
   - Compensaciones aplicadas con desglose · saldo año X · saldo año Y
   - Ganancia tributable
   - Impuesto estimado con desglose por tramos
4. **Alertas R10**
   - "Faltan datos · revisa años X · Y · Z"
   - "No has introducido gastos de venta · estás pagando impuesto de más"
5. **Footer**
   - Botón "Guardar como borrador" (gold ghost)
   - Botón "Confirmar venta" (gold primary · pasa estado a confirmada)

### Validaciones

- Fecha venta obligatoria · ≥ fecha compra
- Precio venta obligatorio · > 0
- Si fecha venta > hoy · solo permite "borrador" no "confirmada"

### Estilo · ATLAS v8

Aplicar paleta · selección oro · cabecera canónica · Lucide icons · tokens CSS.

### Criterios aceptación sub-tarea 5

- [ ] Página accesible desde ficha inmueble
- [ ] Preview live actualizado al cambiar cualquier campo numérico
- [ ] Alertas R10 visibles
- [ ] Estilo v8 aplicado · cero hex hardcoded
- [ ] Estado borrador / confirmada funcional

---

## §7 · Sub-tarea 6 · Integración con declaración 2025

**Tiempo** · 2-3h CC.

### Plan

Cuando un `propertySale` está en estado `confirmada` · la página `/fiscal/2025` debe ·

1. Mostrar el inmueble vendido en sección "Ganancias patrimoniales · transmisiones"
2. Mostrar las casillas 0303 · 0308 · 0309 · 0316 · 0317 · 0320 · 0322 · 0325 prerellenas con los datos del cálculo
3. Mostrar compensaciones aplicadas en casillas 0455 · 1264-1269
4. Mostrar impuesto estimado contribuyente a la cuota ahorro

### Criterios aceptación sub-tarea 6

- [ ] Inmueble vendido aparece en sección ganancias patrimoniales
- [ ] Casillas prerellenadas con cálculo del servicio
- [ ] Si cliente edita la venta · se recalcula

---

## §8 · Sub-tarea 7 · Test integración · caso T48

**Tiempo** · 1-2h CC.

### Test E2E

```typescript
describe('Caso T48 · venta 2025 · flujo completo', () => {
  it('registra venta · calcula plusvalía · prerellena declaración 2025', async () => {
    // 1. Registrar venta
    const ventaId = await propertySalesService.add({
      propertyId: t48_id,
      fechaVenta: '2025-11-18',
      precioVentaEscritura: 185000,
      estado: 'confirmada',
    });
    
    // 2. Servicio calcula plusvalía
    const calculo = await calcularGananciaPatrimonial({
      propertyId: t48_id,
      fechaVenta: '2025-11-18',
      precioVentaEscritura: 185000,
    });
    
    expect(calculo.gananciaTributable).toBeGreaterThan(0);
    
    // 3. Página /fiscal/2025 debe leer del store
    const inmuebleVendido = await db.get('property_sales', ventaId);
    expect(inmuebleVendido?.calculoDerivado).toBeDefined();
  });
});
```

### Criterios aceptación final

- [ ] T48 vendido · cálculo coherente con rangos estimados
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests pre-existentes no se rompen
- [ ] DB_VERSION sigue 70
- [ ] Documentación inline en servicios nuevos

---

## §9 · Reglas inviolables

1. NO tocar DB_VERSION
2. NO refactorizar arquitectura · solo añadir servicios + extender store
3. NO eliminar servicios existentes
4. Tests al céntimo contra rangos esperados T48
5. NO mergear · stop-and-wait
6. Pre-flight obligatorio
7. 1 PR único contra `main`
8. Datos T48 marcados `[CONFIRMAR JOSE]` quedan como placeholders editables · NO hardcoded

---

## §10 · Validación manual Jose tras merge

1. Ir a `/inmuebles/<t48_id>/ficha`
2. Click "Marcar como vendido"
3. Introducir ·
   - Fecha venta · 18/11/2025 (confirmar fecha real)
   - Precio venta · 185.000 €
   - Notaría venta · [valor real]
   - Plusvalía municipal · [valor real]
   - Cancelación hipoteca · [valor real]
   - Resto gastos venta · [valores reales]
4. Verificar preview live ·
   - Valor transmisión = 185.000 − Σ gastos venta
   - Valor adquisición original = 151.380,36 € (o ajustado con tus datos)
   - Amortización acumulada calculada · revisar coherencia con declaraciones 2022 · 2023 · 2024
   - Compensaciones aplicadas · saldo 2022 (1.344,99 €) + saldo 2023 (27.764,23 €)
   - Ganancia tributable resultante
   - Impuesto estimado por tramos
5. Confirmar la venta
6. Ir a `/fiscal/2025`
7. Verificar que aparece T48 en ganancias patrimoniales con las casillas prerellenas

---

## §11 · Datos T48 conocidos para el test

| Campo | Valor real | Origen |
|---|---|---|
| `purchaseDate` | 2022-09-23 | Confirmado Jose |
| `acquisitionCosts.price` | 139.000,00 € | Confirmado Jose · cuadra declaración 2024 |
| `acquisitionCosts.itp + otros` | ~12.380,36 € | Declaración 2024 (139.000 + 12.380,36 = 151.380,36) |
| `fiscalData.constructionPercentage` | 41,69% | Declaración 2024 |
| `fiscalData.valorCatastralTotal` | 52.280,65 € | Declaración 2024 |
| `fiscalData.valorCatastralConstruccion` | 21.796,30 € | Declaración 2024 |
| `aeatAmortization[2024].baseAmortizacion` | 63.110,47 € | Declaración 2024 |
| `aeatAmortization[2024].amortizacionAnualInmueble` | 1.893,31 € | Declaración 2024 |
| Días arrendado 2022 | aprox 99 (23/09-31/12) | `[CONFIRMAR JOSE]` propertyDays |
| Días arrendado 2023 | 365 | `[CONFIRMAR JOSE]` propertyDays |
| Días arrendado 2024 | 366 | Declaración 2024 |
| Días arrendado 2025 hasta venta | aprox 322 (1/1-18/11) | `[CONFIRMAR JOSE]` propertyDays |
| Fecha venta | 18/11/2025 | `[CONFIRMAR JOSE]` · mockup decía 18/11 · historia decía 27/11 |
| Precio venta | 185.000 € | Confirmado Jose |
| Gastos venta | desconocidos · cliente los introduce | `[CONFIRMAR JOSE]` |
| Saldo 2022 arrastrable | 1.344,99 € | Declaración 2024 casilla 1266 |
| Saldo 2023 arrastrable | 27.764,23 € | Declaración 2024 casilla 1269 |

---

## §12 · Lo que NO entra en este lote

- R10 optimización fiscal completa para resto categorías · spec aparte
- Sub-unidades inmueble (Modo III FA32) · spec aparte
- Migración snapshotsDeclaracion · spec aparte
- Resto secciones mapa v4 (§5 trabajo · §6 ahorro · §7 actividad · §8 atribución · §9 pensiones · §11-§16)
- Refactor a `casillaResolverService` único · spec aparte
- Coeficientes abatimiento DT 9ª implementación completa (caso T48 NO aplica · método retorna 0)

---

**Fin spec · 22-30h CC · 7 sub-tareas · 1 PR · listo para entregar a CC tras fixes 1-4 mergeados y Jose confirmar 3 datos pendientes.**
