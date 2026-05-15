# SPEC-CC-FISCAL-UI-REPLACE-v1

> **Objetivo único** · reemplazar la sección Fiscal actual (maqueta vacía con 4 casillas hardcoded) por las 5 pantallas del mockup `atlas-fiscal-v3.html`, cableadas al motor fiscal que ya existe en repo.
>
> **NO toca motor** · servicios como `gananciaPatrimonialService`, `propertyDisposalTaxService`, `propertySaleService`, `aeatAmortizationService`, `mobiliarioActivoService`, `mejoraActivoService`, `baseAmortizacionService`, `imputacionRentaService`, `compensacionAhorroService`, `arrastresFiscalesService`, `carryForwardService`, `simuladorFiscalService`, `estimacionFiscalEnCursoService`, `irpfCalculationService`, `ejercicioResolverService`, `declaracionDistributorService` se cablean tal cual están hoy.
>
> **SÍ extiende motor mínimo** · 4 huecos identificados (sub-tarea 1) · todo lo demás es UI + cableado.
>
> **Base canónica de diseño** · `/mnt/project/atlas-fiscal-v3.html` (1.596 líneas · 5 pantallas · datos reales Jose 2024).
>
> **Contrato funcional** · `/mnt/project/ARQUITECTURA-UI-FISCAL-v2.md` (694 líneas · qué bloque · qué casilla · qué servicio).
>
> **Guía diseño** · `GUIA-DISENO-V5-atlas.md` sección 22 (checklist pre-entrega obligatorio).

---

## §0 · Reglas absolutas para CC

| # | Regla | Sanción si falla |
|---|---|---|
| 1 | **Stop-and-wait** entre sub-tareas · CC no avanza a sub-tarea N+1 sin confirmación explícita de Jose | STOP · reportar a Jose |
| 2 | **NO bumps de DB_VERSION** salvo en sub-tarea 1.3 (donde el spec lo autoriza) | STOP · reportar |
| 3 | **NO refactor de servicios fiscales existentes** · solo añadir métodos nuevos donde el spec lo indica | STOP · reportar |
| 4 | **NO inventar casillas, métodos o stores** no documentados en este spec o en mapa v3/v4 | STOP · reportar |
| 5 | **Pre-flight obligatorio** antes de empezar cada sub-tarea · verificar que el código real coincide con asunciones del spec · si NO coincide → STOP y reportar contradicción | STOP · reportar |
| 6 | **Checklist v4 sección 22** completa antes de entregar cualquier PR | STOP · reportar |
| 7 | **Una sub-tarea = un PR** · NO mergear varias sub-tareas en un PR | STOP · reportar |
| 8 | **Tests existentes deben seguir pasando** · 43 tests pre-existentes están en rojo y son conocidos · NO entran como bloqueo · pero CC NO debe romper más | STOP · reportar |
| 9 | **Si tras pre-flight CC detecta que un servicio que el spec asume existe NO existe** · STOP · NO crear servicio nuevo · reportar a Jose | STOP · reportar |

---

## §1 · Pre-flight global · antes de tocar nada

CC ejecuta primero ·

```bash
# Confirmar archivos canónicos del spec
ls -la /mnt/project/atlas-fiscal-v3.html
ls -la /mnt/project/ARQUITECTURA-UI-FISCAL-v2.md
ls -la /mnt/project/GUIA-DISENO-V5-atlas.md

# Verificar servicios fiscales que el spec ASUME existen
grep -l "calcularGananciaPatrimonial" src/services/
grep -l "calcularAmortizacionAcumulada" src/services/
grep -l "calculateFiscalSummary" src/services/
grep -l "resolverDatosEjercicio" src/services/
grep -l "getTodosLosEjercicios" src/services/
grep -l "getDeclaracion" src/services/
grep -l "estimacionFiscalEnCursoService" src/services/
grep -l "simuladorFiscalService" src/services/
grep -l "aeatAmortizationService" src/services/
grep -l "mobiliarioActivoService" src/services/
grep -l "carryForwardService" src/services/
grep -l "compensacionAhorroService" src/services/

# Confirmar DB_VERSION actual (debe ser 70)
grep "DB_VERSION" src/services/db.ts | head -3

# Confirmar páginas Fiscal actuales que vamos a reemplazar
find src/pages -type d -name "*iscal*"
find src/pages -type f -name "*iscal*"

# Confirmar stores activos del bloque fiscal
grep -A 5 "ejerciciosFiscalesCoord" src/services/db.ts | head -20
```

**Resultado esperado** ·
- Los 12 servicios listados existen
- DB_VERSION = 70
- Hay páginas en `src/pages/Fiscal/` (las que se ven en producción y muestran "0,00 €" · estado actual roto)
- Store `ejerciciosFiscalesCoord` activo

**Si falla cualquier comprobación** · STOP · reportar el gap a Jose y esperar instrucciones · NO empezar sub-tareas.

---

## §2 · 6 sub-tareas · orden estricto

| Sub-tarea | Objetivo | Crea | Modifica | Borra | Tamaño |
|---|---|---|---|---|---|
| **1** | Cerrar huecos motor (4 métodos nuevos · 1 store nuevo) | 1 store · 4 métodos nuevos | 2 servicios existentes (añadir métodos) | nada | M · 14-21h |
| **2** | F1 Dashboard · `/fiscal` | `FiscalDashboardPage.tsx` + 4 sub-componentes | `App.tsx` (routes) | páginas viejas del dashboard | M · 10-14h |
| **3** | F2 Ejercicio · `/fiscal/ejercicio/{año}` | `FiscalEjercicioPage.tsx` + 9 sub-componentes (1 por sección A-H + InmuebleCard) | `App.tsx` | páginas viejas del detalle ejercicio | L · 14-18h |
| **4** | F3 Inmueble fiscal · `/fiscal/ejercicio/{año}/inmueble/{id}` | `FiscalInmueblePage.tsx` + 6 sub-componentes | `App.tsx` | nada que reemplazar (es nuevo) | M · 10-14h |
| **5** | F4 Venta · `/fiscal/ejercicio/{año}/venta/{ventaId}` | `FiscalVentaPage.tsx` + 5 sub-componentes (1 por step + headers) | `App.tsx` | nada que reemplazar (es nuevo) | M · 8-12h |
| **6** | F6 Acciones · `/fiscal/acciones` | `FiscalAccionesPage.tsx` + 7 sub-componentes (1 por acordeón) | `App.tsx` · move botones desde F2/F3/F4 a F6 | página vieja de configuración fiscal | M · 10-14h |

**Total estimado** · 66-93h CC repartido en 6 PRs.

**Después de cada PR · Jose verifica en producción Netlify · screenshots antes/después** · solo entonces CC arranca siguiente sub-tarea.

---

## §3 · SUB-TAREA 1 · cerrar 4 huecos de motor

### §3.1 · Pre-flight de la sub-tarea

```bash
# Verificar fiscalSummaryService actual · qué casillas calcula HOY
grep -n "box01" src/services/fiscalSummaryService.ts | sort -u

# Verificar si existe deudasFiscalesService (NO debería · vamos a crearlo)
ls src/services/ | grep -i deuda

# Verificar fiscalResolverService · qué métodos públicos exporta
grep -n "^export" src/services/fiscalResolverService.ts
```

**Resultado esperado** ·
- `fiscalSummaryService` calcula 11 casillas (0105 · 0106 · 0109 · 0112 · 0113 · 0114 · 0115 · 0117 · 0129 · 0130 · 0131)
- **Falta calcular** · 0102 · 0103 · 0104 · 0107 · 0108 · 0149 · 0150 · 0154 · 0156 (críticas para F2/F3)
- `deudasFiscalesService` NO existe (vamos a crearlo)
- `fiscalResolverService` exporta `resolverDatosEjercicio` y `getEstadoEjercicio` (y otros)

**Si fiscalSummaryService YA calcula 0102/0149/0150/0154** · STOP · reportar y esperar (significa que el motor está MÁS completo de lo asumido).

### §3.2 · Hueco 1 · extender `fiscalSummaryService`

**Archivo** · `src/services/fiscalSummaryService.ts`

**Método a añadir** · `calculateFiscalSummaryExtended(propertyId: number, año: number): Promise<FiscalSummaryExtended>` · que devuelve TODAS las casillas del inmueble, no solo las 11 actuales.

**Schema del retorno** ·

```typescript
export interface FiscalSummaryExtended extends FiscalSummary {
  // Ingresos
  box0101: number;  // días arrendado
  box0102: number;  // ingresos íntegros computables

  // Arrastres entrantes
  box0103: number;  // disponible años anteriores
  box0104: number;  // aplicado este año

  // Tope intereses + reparación
  box0107: number;  // intereses + reparación aplicados (regla actual N4 ya implementada en fix 1-4)
  box0108: number;  // exceso a deducir años siguientes

  // Rendimiento y reducción
  box0149: number;  // rendimiento neto = ingresos − arrastres − gastos − amortizaciones
  box0150: number;  // reducción Ley Vivienda (%) aplicada
  box0154: number;  // rendimiento neto reducido = 0149 − 0150

  // Metadatos
  modoDeclaracion: 'I' | 'II' | 'III' | 'IV' | 'V';  // detectado automáticamente
  diasArrendado: number;
  diasDisposicion: number;
  porcentajeReduccion: number;  // 50, 60, 70 o 90 según contratos
  metodoProrrateo?: 'dias_habitacion' | 'superficie' | 'ingresos' | null;  // solo si modo III/II
}
```

**Cálculos** · CC usa **exclusivamente los servicios que ya existen**, NO reimplementa lógica ·

| Casilla | Fuente |
|---|---|
| 0101 | `propertyOccupancyService.getDiasArrendado(propertyId, año)` |
| 0102 | suma de `contracts` activos en el año + `rentaMensual` confirmadas + `sin_identificar` (motor lo trata como cobrado) |
| 0103 | `carryForwardService.getDisponibleEntrante(propertyId, año)` |
| 0104 | `carryForwardService.getAplicadoEsteAño(propertyId, año)` |
| 0107 | regla N4 ya implementada en fix 1-4 · `baseAmortizacionService` o el helper que el fix añadió · CC usa el método que exporte |
| 0108 | exceso = 0105 + 0106 − 0107 |
| 0149 | 0102 − 0104 − 0107 − suma(0109..0117) − amortizacionInmueble − amortizacionMobiliario − amortizacionMejoras |
| 0150 | usa `reduccionAlquilerService` si existe · si NO existe · STOP · reportar a Jose |
| 0154 | 0149 − 0150 |
| modoDeclaracion | detectar según contratos del año · si todos larga estancia → I · si todos corta → V · si mixto → III · si parcial vacío → II · si vivienda habitual → IV |
| diasArrendado | de 0101 |
| diasDisposicion | 365 (o 366) − diasArrendado |
| porcentajeReduccion | mirar contratos del año · si hay zona tensionada + reducción rent → 90 · etc · regla R6 |
| metodoProrrateo | si modo III · método escogido por servicio existente · si NO existe servicio · default 'dias_habitacion' |

**STOP si** ·
- `reduccionAlquilerService` no existe (necesitamos saberlo)
- `propertyOccupancyService` no expone `getDiasArrendado`
- la regla N4 del fix 1-4 no es accesible vía export público

### §3.3 · Hueco 2 · `fiscalResolverService.getTimelineMultiAño()`

**Archivo** · `src/services/fiscalResolverService.ts`

**Método a añadir** ·

```typescript
export interface TimelineAño {
  año: number;
  estado: EstadoEjercicioFiscal;  // ya existe el tipo
  resultadoIRPF: number | null;
  obligaciones: ObligacionFiscalTimeline[];
  paralela?: { fecha: string; resultadoDesfase: number };
  prescribe: string | null;  // ISO date o null si en_curso/prescrito
}

export interface ObligacionFiscalTimeline {
  modelo: '100' | '303' | '130' | '184';
  periodo: '1T' | '2T' | '3T' | '4T' | 'anual';
  fechaLimite: string;  // ISO
  estado: 'cumplida' | 'pendiente' | 'vencida' | 'futura' | 'con_deuda';
  importe?: number;
}

export async function getTimelineMultiAño(minAño: number, maxAño: number): Promise<TimelineAño[]>;
```

**Implementación** ·
- Itera años entre minAño y maxAño
- Para cada año llama a `resolverDatosEjercicio(año)` (ya existe)
- Para obligaciones · usa `fiscalPaymentsService` si existe · si no · STOP y reportar

**STOP si** · `fiscalPaymentsService` no existe.

### §3.4 · Hueco 3 · `fiscalResolverService.getResumenGlobal()`

**Archivo** · `src/services/fiscalResolverService.ts`

**Método a añadir** ·

```typescript
export interface ResumenGlobalFiscal {
  // Counts por estado (para subtítulo y filtros)
  totalEjercicios: number;
  enCurso: number;
  pendientes: number;
  declarados: number;
  prescritos: number;

  // KPIs principales (para F1 strip)
  proyeccionAñoActual: number | null;     // resultado IRPF año en curso
  borradorAñoPendiente: number | null;    // resultado IRPF año pendiente
  deudaAbierta: number;                   // suma deudas vivas
  arrastresVivos: number;                 // suma stocks no caducados

  // Campañas
  campañaActual?: { ejercicio: number; ventana: { from: string; to: string }; abierta: boolean };
}

export async function getResumenGlobal(): Promise<ResumenGlobalFiscal>;
```

**Implementación** ·
- counts desde `getTodosLosEjercicios()`
- proyección desde `estimacionFiscalEnCursoService.calcular(añoActual)` · si servicio no existe · STOP
- borrador desde `resolverDatosEjercicio(añoPendiente)`
- deudaAbierta desde nuevo `deudasFiscalesService.getTotalAbierto()` (sub-tarea 1.5)
- arrastresVivos desde `carryForwardService.getTotalVivo()` + `compensacionAhorroService.getTotalDisponible()`
- campañaActual · tabla hardcoded de ventanas IRPF por año (datos AEAT públicos)

### §3.5 · Hueco 4 · crear `deudasFiscalesService` + store

**Archivo nuevo** · `src/services/deudasFiscalesService.ts`

**Store nuevo** · `deudasFiscales` (DB_VERSION 70 → 71 · ÚNICA modificación de DB autorizada en este spec)

**Schema** ·

```typescript
export interface DeudaFiscal {
  id?: number;
  modelo: '100' | '303' | '130' | '184';
  ejercicio: number;
  periodo: '1T' | '2T' | '3T' | '4T' | 'anual';
  principal: number;
  recargoTipo: 'voluntario' | 'ejecutivo_5' | 'ejecutivo_10' | 'ejecutivo_15' | 'apremio_20' | 'embargo';
  recargoImporte: number;
  interesesDemora?: number;
  total: number;
  estado: 'voluntario' | 'ejecutivo' | 'apremio' | 'embargo' | 'pagada' | 'aplazada';
  notificada?: string;        // ISO date
  ventanaPlazo?: string;       // ISO date (para pagar a 5%)
  claveLiquidacion?: string;   // ej "A2806524540018133"
  documentIds?: number[];      // refs a `documents`
  pagadaEl?: string;
  notas?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Índices** · `modelo` · `ejercicio` · `estado` · `notificada`

**Migración V70→V71** · solo creación del store · NO mover datos existentes (no hay nada que mover).

**Métodos públicos** ·

```typescript
export async function getDeudaById(id: number): Promise<DeudaFiscal | null>;
export async function getDeudas(filtro?: { estado?: DeudaFiscal['estado'] }): Promise<DeudaFiscal[]>;
export async function getDeudasAbiertas(): Promise<DeudaFiscal[]>;
export async function getTotalAbierto(): Promise<number>;
export async function crearDeuda(input: Omit<DeudaFiscal, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeudaFiscal>;
export async function marcarPagada(id: number, fechaPago: string): Promise<DeudaFiscal>;
export async function actualizarRecargo(id: number, nuevoEstado: DeudaFiscal['estado']): Promise<DeudaFiscal>;
```

**Seed de datos** · NO seed automático · Jose añadirá manualmente la deuda IVA Q3-2024 desde F6 cuando exista la UI.

### §3.6 · Tests sub-tarea 1

CC añade tests unitarios para los 4 huecos · contra los datos reales de Jose 2024 (FA32) ·

| Test | Valor esperado |
|---|---|
| `calculateFiscalSummaryExtended(propertyFA32, 2024).box0102` | 19.675,00 |
| `calculateFiscalSummaryExtended(propertyFA32, 2024).box0149` | 5.334,69 |
| `calculateFiscalSummaryExtended(propertyFA32, 2024).box0150` | 1.390,94 |
| `calculateFiscalSummaryExtended(propertyFA32, 2024).box0154` | 3.943,75 |
| `calculateFiscalSummaryExtended(propertyFA32, 2024).modoDeclaracion` | 'III' |
| `getTimelineMultiAño(2020, 2026).length` | 7 |
| `getResumenGlobal().declarados` | 5 (2020·2021·2022·2023·2024) |
| `getResumenGlobal().pendientes` | 1 (2025) |
| `getResumenGlobal().enCurso` | 1 (2026) |
| `deudasFiscalesService.getTotalAbierto()` | 0 (sin seed) |

**Tolerancia numérica** · ≤ 0,01 € para todos los cálculos.

### §3.7 · Definition of Done sub-tarea 1

- [ ] 4 métodos nuevos exportados
- [ ] 1 store nuevo creado (DB_VERSION 70 → 71)
- [ ] Tests pasan al céntimo contra datos Jose 2024
- [ ] 0 regresiones en tests existentes (43 conocidos siguen igual)
- [ ] PR documenta cada hueco cerrado en descripción
- [ ] Build Netlify OK
- [ ] Jose verifica en producción consultando vía DevTools que los métodos están disponibles · screenshot
- [ ] STOP · esperar luz verde de Jose antes de sub-tarea 2

---

## §4 · SUB-TAREA 2 · F1 Dashboard

### §4.1 · Pre-flight

```bash
# Localizar página actual del dashboard fiscal
ls src/pages/Fiscal/ 2>/dev/null
find src -name "FiscalPage*" -o -name "FiscalDashboard*"
grep -rn "'/fiscal'" src/App.tsx | head -5
```

**Resultado esperado** · existe una página actual que renderiza el "0 en curso · 5 declarados" vacío que Jose vio en capturas · la vamos a reemplazar.

### §4.2 · Componentes a crear

**Carpeta** · `src/pages/Fiscal/v2/`

| Componente | Para qué |
|---|---|
| `FiscalDashboardPage.tsx` | Página raíz · monta header + KPI strip + tabs |
| `FiscalKpiStrip.tsx` | 4 tarjetas KPI (proyección · borrador · deuda · arrastres) |
| `FiscalEjerciciosTab.tsx` | Tab Ejercicios · lista de 7 años con `ej-row` |
| `FiscalDeudasTab.tsx` | Tab Deudas · tabla |
| `FiscalArrastresTab.tsx` | Tab Arrastres · tabla + nota descartable |

### §4.3 · Cableado de datos

| Componente | Llama a |
|---|---|
| Header (counts + campaña) | `fiscalResolverService.getResumenGlobal()` |
| KPI 1 Proyección 2026 | `getResumenGlobal().proyeccionAñoActual` |
| KPI 2 Borrador 2025 | `getResumenGlobal().borradorAñoPendiente` |
| KPI 3 Deuda abierta | `getResumenGlobal().deudaAbierta` |
| KPI 4 Arrastres vivos | `getResumenGlobal().arrastresVivos` |
| Tab Ejercicios | `fiscalResolverService.getTodosLosEjercicios()` + por cada año `resolverDatosEjercicio(año)` para resultado |
| Tab Deudas | `deudasFiscalesService.getDeudasAbiertas()` |
| Tab Arrastres | `carryForwardService.getArrastresVivos()` + `compensacionAhorroService.getDisponibles()` |

### §4.4 · UX · qué hace cada click

| Click | Comportamiento |
|---|---|
| KPI 1 (Proyección 2026) | `navigate('/fiscal/ejercicio/2026')` |
| KPI 2 (Borrador 2025) | `navigate('/fiscal/ejercicio/2025')` |
| KPI 3 (Deuda) | `navigate('/fiscal/acciones?section=deudas')` |
| KPI 4 (Arrastres) | `navigate('/fiscal/acciones?section=arrastres')` |
| Fila ejercicio | `navigate('/fiscal/ejercicio/{año}')` |
| Link "Acciones fiscales →" | `navigate('/fiscal/acciones')` |
| Nota descartable ✕ | localStorage `fiscal.note.{id}.dismissed = true` · al cargar oculta si dismissed |

### §4.5 · Diseño · referencia exacta

CC abre `/mnt/project/atlas-fiscal-v3.html` · busca `id="page-dashboard"` · copia estructura HTML al pie de la letra · aplica clases CSS · valida que pinta como mockup.

**NO inventa elementos** · NO añade botones que el mockup no tiene · NO añade iconos en tabs · NO añade tags `[A.xml]` por línea (eso es parte de los cambios v3 explícitos).

### §4.6 · Borrado

- Borrar página vieja del dashboard fiscal (la que muestra calendario placeholder)
- Borrar componentes huérfanos tras el borrado · `git diff --stat` debe enseñarlos
- Ruta `/fiscal` ahora apunta a `FiscalDashboardPage.tsx`

### §4.7 · Tests sub-tarea 2

- Tests de renderizado con `react-testing-library`
- Mock de `getResumenGlobal()` con datos Jose 2024
- Verificar que aparecen los 4 KPIs con valores correctos
- Verificar navegación al hacer click en cada KPI/fila
- Verificar persistencia localStorage de notas descartadas

### §4.8 · Definition of Done sub-tarea 2

- [ ] `/fiscal` renderiza F1 del mockup v3 al pie de la letra
- [ ] 4 KPIs muestran datos reales (no 0 ni placeholder)
- [ ] Lista 7 ejercicios con resultado IRPF real cada uno
- [ ] Tab Deudas vacío inicialmente (Jose añadirá deuda IVA Q3-2024 desde F6)
- [ ] Tab Arrastres muestra 2 arrastres (1.344,99 + 27.764,23)
- [ ] Nota descartable funciona y persiste en localStorage
- [ ] Build Netlify OK
- [ ] Jose verifica en producción · screenshot
- [ ] STOP · esperar luz verde

---

## §5 · SUB-TAREA 3 · F2 Ejercicio detalle

### §5.1 · Pre-flight

```bash
# Localizar página actual del ejercicio
ls src/pages/Fiscal/ 2>/dev/null
find src -name "FiscalEjercicio*" -o -name "EjercicioPage*"
grep -rn "/fiscal/ejercicio/" src/App.tsx
```

**Resultado esperado** · existe `FiscalEjercicioPage` o similar que muestra "0,00 €" en todas las casillas · la vamos a reemplazar.

### §5.2 · Componentes a crear

**Carpeta** · `src/pages/Fiscal/v2/`

| Componente | Para qué |
|---|---|
| `FiscalEjercicioPage.tsx` | Página raíz · monta header + KPI strip + tabs + 8 secciones casillas |
| `EjercicioHeader.tsx` | Header con título + pill estado + meta-line + link Acciones |
| `EjercicioKpiStrip.tsx` | 4 KPIs (resultado · cuota · retenciones · tipo medio) |
| `EjercicioBoxSection.tsx` | Componente genérico de sección colapsable A-H |
| `BoxRowCasilla.tsx` | Fila genérica de casilla (num · concepto · subtítulo · importe) |
| `InmuebleGroupCard.tsx` | Card de inmueble dentro de sección B · resume y link a F3 |
| `EjercicioVersionesTab.tsx` | Tab Versiones (v1 vs v2 paralela) |
| `EjercicioPagosTab.tsx` | Tab Pagos (pago de cuota diferencial · deudas vinculadas) |
| `EjercicioDocumentosTab.tsx` | Tab Documentos · listado |

### §5.3 · Cableado de datos

**Llamada principal** · `resolverDatosEjercicio(año)` devuelve `DatosFiscalesEjercicio` con `declaracionCompleta: DeclaracionIRPF`.

CC mapea cada sección A-H a campos de `DeclaracionIRPF` (tipo ya existente en `src/types/fiscal.ts`) ·

| Sección | Datos fuente |
|---|---|
| A · Trabajo | `declaracionCompleta.trabajo.*` |
| B · Inmuebles | `declaracionCompleta.inmuebles[]` · por cada uno mostrar resumen via `InmuebleGroupCard` |
| C · Capital mobiliario | `declaracionCompleta.capitalMobiliario.*` |
| D · Actividad económica | `declaracionCompleta.actividades[0]` (Unihouser) |
| E · Ganancias patrimoniales | `declaracionCompleta.gananciasPerdidas.*` · si vacío → mostrar "sin operaciones" + nota "venta T48 aparece en 2025" |
| F · Plan pensiones | `declaracionCompleta.planPensiones.*` |
| G · Bases | `declaracionCompleta.basesYCuotas.baseImponible*` + `baseLiquidable*` |
| H · Cuotas y resultado | `declaracionCompleta.basesYCuotas.cuota*` + `resultadoDeclaracion` |

**Cada casilla** muestra · número (`0003` · `0102` etc) · concepto humano · subtítulo opcional · importe.

**NO se muestran tags `A.xml` / `A.pdf` / `calc` por línea** · la fuente A/B/C se mostrará en drawer al click (futuro · NO en esta sub-tarea).

### §5.4 · Estados visibles

| Estado año | Header pill | KPIs muestran | Tabs visibles |
|---|---|---|---|
| `declarado` | "Declarado" | Resultado real + cuota real + retenciones reales + tipo medio | M100 + Versiones + Pagos + Documentos |
| `pendiente` | "Pendiente declarar" | Borrador calculado · CTA "Marcar declarado" sale en F6 (no aquí) | M100 + Versiones (v1 borrador) + Documentos |
| `en_curso` | "En curso" | Estimación + desglose B+C | M100 + Documentos |
| `prescrito` | "Prescrito" · opacidad 60% | Resultado consultable · "intocable" | M100 + Versiones + Documentos · NO Pagos |

### §5.5 · Sección E · cuando hay venta

Si el año tiene venta (`propertySaleService.getVentasDelAño(año)` devuelve > 0) · sección E muestra ·

- Header "Ganancias y pérdidas patrimoniales" + count
- Por cada venta · una `InmuebleGroupCard` (variante) con resumen ganancia + link a `/fiscal/ejercicio/{año}/venta/{ventaId}` (F4)
- Subtotal casillas 0320 · 0325

### §5.6 · UX click

| Click | Comportamiento |
|---|---|
| Inmueble en sección B | `navigate('/fiscal/ejercicio/{año}/inmueble/{propertyId}')` |
| Venta en sección E | `navigate('/fiscal/ejercicio/{año}/venta/{ventaId}')` |
| Sección colapsable header | toggle clase `collapsed` |
| Link "Acciones fiscales →" | `navigate('/fiscal/acciones?ejercicio={año}')` |

### §5.7 · Definition of Done sub-tarea 3

- [ ] `/fiscal/ejercicio/2024` renderiza los 8 bloques A-H con datos reales de Jose
- [ ] Resultado 0670 muestra −2.899,75 €
- [ ] Base liquidable 0500 muestra 147.665,23 €
- [ ] Cuota líquida 0587 muestra 53.881,09 €
- [ ] Retenciones 0609 muestra 50.981,34 €
- [ ] Plan pensiones 0426 = 1.396,68 y 0427 = 1.862,16
- [ ] Sección B lista los 6 inmuebles con su rendimiento neto reducido cada uno
- [ ] Click en FA32 navega a F3
- [ ] `/fiscal/ejercicio/2025` muestra estado "Pendiente declarar" + sección E con venta T48
- [ ] `/fiscal/ejercicio/2020` muestra estado "Prescrito" con opacidad
- [ ] Tabs Versiones / Pagos / Documentos renderizan (pueden estar vacíos · OK)
- [ ] Build Netlify OK · Jose verifica · screenshots
- [ ] STOP · esperar luz verde

---

## §6 · SUB-TAREA 4 · F3 Inmueble fiscal

### §6.1 · Pre-flight

```bash
# Esta página es NUEVA · no debería existir hoy
find src -name "FiscalInmueble*" -o -name "InmuebleFiscal*"
```

**Resultado esperado** · NO existe · es página nueva.

### §6.2 · Componentes a crear

**Carpeta** · `src/pages/Fiscal/v2/`

| Componente | Para qué |
|---|---|
| `FiscalInmueblePage.tsx` | Página raíz · breadcrumb + header + KPI strip + modo card + nota R10 descartable + 5 box-sections |
| `InmuebleFiscalHeader.tsx` | Header con título + pill estado año + meta-line (RC · días arrendado · habitaciones) |
| `InmuebleFiscalKpiStrip.tsx` | 3 KPIs (ingresos · gastos · rendimiento neto reducido) |
| `ModoDeclaracionCard.tsx` | Card explicando modo I/II/III/IV/V detectado |
| `OptimizacionesNote.tsx` | Nota descartable con resumen R10 (sin acrónimo) |
| `AmortizacionAcumuladaTable.tsx` | Tabla año a año · inmueble + mobiliario + total acumulado |

### §6.3 · Cableado

**Llamada principal** · `fiscalSummaryService.calculateFiscalSummaryExtended(propertyId, año)` (creado en sub-tarea 1)

**Llamadas auxiliares** ·
- `aeatAmortizationService.getAmortizacionInmueble(propertyId, año)` para casillas 0123-0132
- `mobiliarioActivoService.getAmortizacionMobiliario(propertyId, año)` para casilla 0117
- `gananciaPatrimonialService.calcularAmortizacionAcumulada(propertyId, fechaCorte)` para tabla acumulada

### §6.4 · 5 box-sections del mockup

| Sección | Iconito header (color · letra) | Contenido |
|---|---|---|
| Ingresos del año | gold · `€` | casillas 0102 · 0101 |
| Arrastres de años anteriores | warn · `←` | casillas 0103 · 0104 |
| Gastos del año | neg · `−` | casillas 0105-0117 |
| Amortización del inmueble | navy-3 · `A` | casillas 0123-0132 |
| Rendimiento del inmueble | pos · `∑` | casillas 0149 · 0150 · 0154 |

### §6.5 · Modo declaración

`ModoDeclaracionCard` muestra · tag con nombre (no acrónimo R10 · solo nombre tipo "Alquiler mixto") · título "Casos especiales · habitaciones" + body con explicación textual.

**Sin códigos técnicos R10/N4/N2 en UI** · esos se ven en docs internos solamente.

### §6.6 · Tabla amortización acumulada

Renderiza años desde año compra hasta año actual ·

| Columna | Dato |
|---|---|
| Año | número (mono · navy-bold) |
| Días arr. | `propertyOccupancyService.getDiasArrendado(id, año)` |
| Base amort. | de `aeatAmortizationService` |
| Inmueble | `box0131` o `box0132` según modo · de fiscalSummaryService |
| Mobiliario | `box0117` |
| Acumulado total | suma running |

Fila final destacada (navy bg) · "Acumulado a 31/12/{año}" con total.

### §6.7 · Definition of Done sub-tarea 4

- [ ] `/fiscal/ejercicio/2024/inmueble/{idFA32}` renderiza al pie de la letra
- [ ] KPI ingresos · 19.675,00 €
- [ ] KPI rendimiento neto reducido · 3.943,75 €
- [ ] Modo · "Alquiler mixto · Casos especiales · habitaciones"
- [ ] Casilla 0102 · 19.675,00
- [ ] Casilla 0149 · 5.334,69
- [ ] Casilla 0150 · 1.390,94
- [ ] Casilla 0154 · 3.943,75
- [ ] Casilla 0132 · 816,12
- [ ] Tabla amortización acumulada · fila 2024 = 5.031,56 €
- [ ] Build Netlify OK · Jose verifica · screenshots
- [ ] STOP · esperar luz verde

---

## §7 · SUB-TAREA 5 · F4 Venta T48 2025

### §7.1 · Pre-flight

```bash
# Esta página es NUEVA · pero el motor de venta existe completo
grep -n "calcularGananciaPatrimonial" src/services/gananciaPatrimonialService.ts
grep -n "confirmPropertySale" src/services/propertySaleService.ts
ls src/components/inmuebles/VentaWizard*  # existe wizard de venta
```

**Resultado esperado** · `gananciaPatrimonialService.calcularGananciaPatrimonial(saleId)` existe · `propertySales` store con `fiscalSnapshot` poblado existe · `VentaWizard.tsx` existe en `/inmuebles/`.

**F4 es vista de SOLO LECTURA de un propertySale ya confirmado** · NO duplica el wizard · solo presenta el cálculo paso a paso.

### §7.2 · Componentes a crear

**Carpeta** · `src/pages/Fiscal/v2/`

| Componente | Para qué |
|---|---|
| `FiscalVentaPage.tsx` | Página raíz |
| `VentaHeader.tsx` | Header con título · pill borrador/declarado · meta (fechas · precio) |
| `VentaKpiStrip.tsx` | 4 KPIs (transmisión · adquisición · ganancia tributable · impuesto) |
| `VentaOptimizacionesNote.tsx` | Nota descartable R10 sin acrónimo |
| `CalcStep.tsx` | Componente genérico de "calc-step" con cabecera + líneas |

### §7.3 · Cableado

**Llamada principal** · `propertySaleService.getById(ventaId)` + `gananciaPatrimonialService.calcularGananciaPatrimonial(sale)` 

El `fiscalSnapshot` del propertySale ya contiene · ganancia · IRPF estimado · amortizaciones acumuladas. CC monta los 5 calc-steps a partir de ahí.

### §7.4 · 5 calc-steps

| Step | Casilla ref | Líneas (mockup v3) |
|---|---|---|
| 1 · Valor transmisión | 0316 | + precio venta · − gastos venta (5 líneas indent) · = valor transmisión |
| 2 · Valor adquisición actualizado | 0317 | + precio compra · + gastos adquisición · + mejoras · − amortizaciones (5 líneas indent año a año) · = valor adquisición |
| 3 · Ganancia bruta | 0320 | = transmisión − adquisición · − reducción abatimiento (no aplica T48) · = ganancia reducida |
| 4 · Compensación arrastres | 1264-1269 | + ganancia · − saldos pendientes (FIFO automático) · = ganancia tributable |
| 5 · Impuesto | 0610 · 0670 | × tramos base ahorro 2025 · = impuesto · final destacado (navy bg) |

### §7.5 · Definition of Done sub-tarea 5

- [ ] `/fiscal/ejercicio/2025/venta/{ventaT48}` renderiza al pie de la letra
- [ ] KPI ganancia tributable · ~10.481 €
- [ ] KPI impuesto estimado · ~2.081 €
- [ ] Step 1 muestra 185.000 + gastos venta (pendientes o reales si introducidos)
- [ ] Step 2 muestra 139.000 + 12.380,36 − amortizaciones acumuladas por año
- [ ] Step 3 ganancia bruta · ~39.590 €
- [ ] Step 4 compensa 1.344,99 + 27.764,23 = 29.109,22 €
- [ ] Step 5 impuesto final destacado en navy
- [ ] Build Netlify OK · Jose verifica · screenshot
- [ ] STOP · esperar luz verde

---

## §8 · SUB-TAREA 6 · F6 Acciones fiscales

### §8.1 · Pre-flight

```bash
# Página actual de configuración fiscal · la vamos a reemplazar
find src -name "FiscalConfiguracion*" -o -name "FiscalConfig*"
grep -rn "/fiscal/configuracion" src/App.tsx
```

### §8.2 · Componentes a crear

**Carpeta** · `src/pages/Fiscal/v2/`

| Componente | Para qué |
|---|---|
| `FiscalAccionesPage.tsx` | Página raíz · monta 7 acordeones |
| `AccionAccordion.tsx` | Componente genérico de acordeón |
| `PerfilFiscalSection.tsx` | Bloque 1 · perfil (lectura · botón "Editar perfil" → navega a Ajustes general) |
| `ImportarDeclaracionSection.tsx` | Bloque 2 · dropzone + histórico de importaciones |
| `AplicarParalelaSection.tsx` | Bloque 3 · selector ejercicio + wizard CTA + histórico paralelas |
| `ReImportarExportarSection.tsx` | Bloque 4 · selector ejercicio + botones operativos por ejercicio |
| `ArrastresManualesSection.tsx` | Bloque 5 · botón añadir + listado |
| `HistoricoDeclaracionesSection.tsx` | Bloque 6 · listado completo todos modelos |
| `ExportarTodoSection.tsx` | Bloque 7 · botones export JSON/ZIP/CSV |

### §8.3 · Cableado · qué hace cada botón

| Botón | Acción |
|---|---|
| "Importar XML/PDF/TXT del Modelo 100" | abre file picker · llama `declaracionDistributorService.importar(file, año)` |
| "Iniciar wizard paralela" | abre wizard 5 pasos · al confirmar llama `ejercicioResolverService.aplicarParalela(...)` |
| "Re-importar declaración" | mismo que importar pero con flag sobreescribir |
| "Exportar PDF" | genera PDF con datos del año (servicio existente o STOP si no) |
| "Ver versiones" | abre modal con v1 vs v2 (si paralela) |
| "Comparar con otro año" | abre modal side-by-side |
| "+ Añadir arrastre manual" | abre form con campos del schema · llama `carryForwardService.addManual(...)` |
| "Exportar config JSON" | descarga JSON del perfil fiscal |
| "ZIP declaraciones" | descarga ZIP con todas las declaraciones |
| "CSV casillas por año" | descarga CSV |

### §8.4 · Sustitución de botones diseminados

**Importantísimo** · en sub-tareas 2-5 NO se pusieron botones de acción en headers de F1/F2/F3/F4 (solo links "Acciones fiscales →"). En esta sub-tarea CC verifica que ·

- F1 header · solo link "Acciones fiscales →" · NO botones
- F2 header · solo link · NO "Re-importar / Aplicar paralela / Exportar PDF"
- F3 header · solo link · NO "Ficha completa / Comparar"
- F4 header · solo link · NO "Recalcular / Registro venta"

Si algún botón de acción quedó disperso · CC lo elimina y lo trae a F6.

### §8.5 · Definition of Done sub-tarea 6

- [ ] `/fiscal/acciones` renderiza los 7 acordeones del mockup v3
- [ ] Bloque 2 · dropzone funcional · al subir XML 2024 sobreescribe `ejerciciosFiscalesCoord[2024]` correctamente
- [ ] Bloque 3 · wizard paralela funcional (al menos el flujo · puede ser placeholder de UI si servicio no está listo)
- [ ] Bloque 4 · re-importar / exportar PDF funcionales
- [ ] Bloque 5 · añadir arrastre manual funcional
- [ ] Bloque 6 · listado completo · placeholder OK si servicio no expone listado completo
- [ ] Bloque 7 · 3 exports funcionales
- [ ] NINGÚN botón de acción en F1/F2/F3/F4 · todos en F6
- [ ] Build Netlify OK · Jose verifica · screenshots
- [ ] STOP · cierre del spec completo

---

## §9 · Resumen visual del cableado

```
                            ┌─────────────────────────────────────┐
                            │ fiscalResolverService               │
                            │  · resolverDatosEjercicio (existe)  │
                            │  · getTodosLosEjercicios (existe)   │
                            │  · getTimelineMultiAño (NUEVO)      │
                            │  · getResumenGlobal (NUEVO)         │
                            └────────────┬────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
       ┌──────────────┐         ┌──────────────────┐       ┌─────────────┐
       │ F1 Dashboard │         │ F2 Ejercicio     │       │ F3 Inmueble │
       │ (sub 2)      │         │ (sub 3)          │       │ (sub 4)     │
       └──────┬───────┘         └─────┬────────────┘       └──────┬──────┘
              │                       │                           │
              │                       ▼                           ▼
              │                ┌──────────────┐          ┌────────────────────────────┐
              │                │ F4 Venta     │          │ fiscalSummaryService       │
              │                │ (sub 5)      │          │  · calculateFiscalSummary  │
              │                └──────┬───────┘          │  · calculateExtended NUEVO │
              │                       │                  │  + aeatAmortizationService │
              │                       ▼                  │  + mobiliarioActivoService │
              │              ┌─────────────────────┐     │  + propertyOccupancySvc    │
              │              │ gananciaPatrimSvc   │     │  + reduccionAlquilerSvc    │
              │              │ propertySaleService │     │  + carryForwardService     │
              │              │ (TODOS YA EXISTEN)  │     └────────────────────────────┘
              │              └─────────────────────┘
              ▼
       ┌──────────────────┐
       │ F6 Acciones      │
       │ (sub 6)          │
       │  · todos botones │
       │  · TODO el       │
       │    operativo     │
       └──────────────────┘
```

---

## §10 · Checklist v4 sección 22 · obligatorio antes de cada PR

CC verifica antes de pedir merge en CADA sub-tarea ·

- [ ] Solo tokens CSS · cero hex hardcoded
- [ ] Sentence case en todos los textos
- [ ] Sin emojis en UI
- [ ] Lucide-react para iconos (NO svg inline salvo decoración menor)
- [ ] JetBrains Mono para todos los números
- [ ] Inter / IBM Plex para texto
- [ ] Sin colores espurios · solo paleta navy + beige + gold
- [ ] Tabs SIN iconos
- [ ] Botones acción SOLO en F6 (después de sub-tarea 6)
- [ ] Build Netlify pasa
- [ ] Tests existentes siguen igual (43 conocidos en rojo · NO empeorar)
- [ ] Descripción del PR incluye · qué cambia · qué crea · qué borra · screenshots antes/después

---

## §11 · Qué hace Jose en cada sub-tarea

1. CC entrega sub-tarea N · merge en `main` · auto-deploy Netlify
2. Jose abre producción · navega a la URL afectada
3. Jose hace screenshots antes/después
4. Si OK → dice "siguiente" → CC arranca sub-tarea N+1
5. Si NO OK → Jose marca qué falla → CC corrige en mismo PR antes de avanzar

**No avanzamos hasta que la sub-tarea N esté visual y funcionalmente perfecta en producción.**

---

## §12 · Fin del spec

**Total estimado** · 66-93h CC en 6 PRs secuenciales · 4-6 semanas de calendario asumiendo ritmo normal con verificación en producción entre PRs.

**Resultado al cerrar** · sección Fiscal completamente reemplazada · 5 pantallas funcionales · cero placeholders · cero "0,00 €" vacíos · datos reales de Jose visibles en cada pantalla.

**Para el cliente final (mercado de pequeños inversores)** · primera versión vendible de la sección Fiscal · donde el cliente abre · ve sus 7 ejercicios · entra en cualquiera · ve TODAS sus casillas · ve detalle por inmueble · ve cálculo de ventas paso a paso · y dispone de un único sitio "Acciones fiscales" donde hace todas las operaciones sin que se le diseminen botones por toda la app.
