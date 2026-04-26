# ATLAS · Personal · modelo de datos exhaustivo
**v1.1 · 25 abril 2026 · gaps cerrados**

---

## 0 · Por qué este documento

El mockup `atlas-personal-v2.html` reveló que el modelo de datos del módulo Personal está incompleto y duplica entidades. Los fallos detectados no son de presentación · son de modelo:

- Compromisos recurrentes con periodicidad plana ("mensual día 6") cuando la realidad es calendario fino (IBI dos pagos en meses concretos · gas bimestral con anclaje · M130 trimestral fiscal)
- Categorías de gasto incompletas · cuatro o cinco chips cuando un hogar real tiene 14 categorías
- Nómina simplificada al 20% de lo real · ignorando pagas extra · variable · bonus · especies · plan pensiones empresa y trabajador · cuota solidaridad
- Doble alta de vivienda · ficha vivienda + compromiso recurrente alquiler con el mismo dato
- Importes promedio falsos · "92 €/mes" cuando la luz oscila entre 71 € en junio y 138 € en enero
- Gráficos sin valores legibles · barchart bonito pero ilegible para tomar decisiones

Este documento define el modelo de datos para que CC implemente y para que el mockup posterior se construya sobre cimientos correctos. Audiencia · CC para implementar · Jose para validar.

**Compromiso del documento** · cada sección apoyada en decisiones ya tomadas en el proyecto. Marca explícitamente qué reaprovecha · qué amplía · qué es nuevo. Enumera al final los gaps abiertos que necesitan decisión.

---

## 1 · Entidades del módulo Personal · estado real

### 1.1 Stores existentes que se reaprovechan

Provienen del mapa de 54 stores (`ATLAS-mapa-54-stores.md`).

| Store | # | Qué guarda | Estado actual | Acción |
|---|---|---|---|---|
| `personalData` | 44 | NIF · nombre · fecha nac · estado civil · CCAA | ✅ existe · GAP-D1 campos parciales | Ampliar con perfil hogar |
| `nominas` | 13 | "Patrón nómina actual" para proyección futura | ✅ existe · schema mínimo | Ampliar schema (sección 5) |
| `autonomos` | 14 | "Patrón autónomo actual" | ✅ existe · schema mínimo | Ampliar schema |
| `otrosIngresos` | 15 | Ingresos del hogar SIN contraparte de activo · pensiones públicas (jubilación · viudedad · invalidez) · pensiones alimentos · subsidios y ayudas · becas · trabajos esporádicos sin nómina | ✅ existe · acotar alcance | Mantener · acotar |
| `accounts` | 26 | Cuentas bancarias (IBAN) | ✅ existe | Mantener |
| `treasuryEvents` | 38 | Previsiones año en curso/futuro · gastos personales estimados | ✅ existe · pieza crítica | Pasa a ser destino único de eventos generados |

**Regla de alcance · qué NO va en `otrosIngresos`:**
- **Alquileres recibidos** → viven en `contracts` y `rentaMensual` (módulo Inmuebles · son rentas de capital inmobiliario · no se generan "con las manos del hogar")
- **Intereses · dividendos · capital mobiliario** → viven en `inversiones` (módulo Inversiones · son rentas de capital mobiliario)
- **Atribución de rentas (CB)** → vive en `entidadesAtribucion` (módulo Fiscal · son rentas atribuidas por entidad)

Personal solo recoge ingresos del hogar que provienen de · trabajo (en `nominas` o `autonomos`) o transferencias unilaterales sin contraparte de activo (en `otrosIngresos`).

### 1.2 Stores nuevos o a rediseñar

| Store | Acción | Justificación |
|---|---|---|
| `compromisosRecurrentes` | **NUEVO** | Catálogo universal de compromisos del hogar (suministro · suscripción · seguro · cuota · alquiler vivienda · otros). Reemplaza la mezcla actual entre `patronGastosPersonales` y movimientos sueltos. |
| `viviendaHabitual` | **NUEVO** o sub-objeto en `personalData` | Datos de la vivienda donde vive el hogar. Genera compromisos derivados automáticamente. Ver sección 6. |
| `patronGastosPersonales` (#16) | **DEPRECAR** | Sustituido por catálogo de `compromisosRecurrentes` + estimaciones agregadas a partir de Tesorería. |
| `gastosPersonalesReal` (#17) | **🗑 ELIMINAR** | Ya marcado "sin fuente activa" en el mapa. La realidad de gastos vive en `treasuryEvents` confirmados con extracto bancario. |
| `nominas` schema | **AMPLIAR** | Schema actual demasiado básico para una nómina española real. Detalle en sección 5. |
| `opexRules` (#7) | **UNIFICAR con `compromisosRecurrentes`** | Decisión cerrada (G-01) · ambos comparten patrón de calendario y categorización. Schema único con campo discriminador `ambito: 'personal' | 'inmueble'` y `inmuebleId?` opcional. Los registros existentes en `opexRules` se migran al store unificado conservando su `ambito='inmueble'` y `inmuebleId`. |

### 1.3 Concepto fundamental · catálogo vs eventos

Esta separación está implícita en la arquitectura del proyecto · este documento la hace explícita.

**Catálogo** · entidad de alta única que describe un patrón de cobro o pago recurrente. Vive en stores como `nominas` · `compromisosRecurrentes` · etc. El usuario da de alta un catálogo UNA vez. Si cambian las condiciones · edita el catálogo · no introduce eventos sueltos.

**Evento** · una instancia concreta de cobro o pago en un día concreto. Vive en `treasuryEvents`. El usuario NO da de alta eventos directamente desde Personal. Los eventos se generan automáticamente a partir de catálogos · y se concilian contra movimientos bancarios reales cuando llegan.

```
CATÁLOGO              GENERA AUTOMÁTICAMENTE         CONCILIA CONTRA
nomina Orange    →    17 eventos/año en TE      →    CSV bancario
compromiso luz   →    12 eventos/año en TE      →    CSV bancario
ficha vivienda   →    1+ compromisos derivados  →    eventos en TE
```

**Regla** · si el usuario tiene la sensación de "dar de alta dos veces lo mismo" · es que el modelo está mal. La ficha de la vivienda no genera ni renta ni hipoteca como compromiso aparte · los genera derivados. La nómina no se duplica como "compromiso recurrente cobro" · es la nómina la que crea sus eventos.

---

## 2 · Modelo de calendario · la pieza más crítica

Es el modelo que más fallaba en el mockup. Aquí se define un patrón unificado que cubre todos los casos reales.

### 2.1 Ocho tipos de patrones de fechas

Cada compromiso · ingreso o salida del hogar usa uno de estos ocho patrones. Todos se reducen a "dada una fecha de inicio · proyectar las próximas N fechas en las que toca el evento".

#### Patrón A · mensual día fijo

Caso más simple. Mismo día cada mes.

**Ejemplos** · alquiler Madrid (día 28) · cuota gimnasio (día 1)

```typescript
{ tipo: 'mensualDiaFijo', dia: 28 }
```

#### Patrón B · mensual día relativo

Día calculado · no fijo del mes. Útil cuando hay reglas como "último día hábil" o "primer lunes".

**Ejemplos** · nómina Orange (último día hábil · ej. 30 abril · 31 mayo · 30 junio · etc.) · cargo bancario (primer día hábil)

```typescript
{ tipo: 'mensualDiaRelativo', referencia: 'ultimoHabil' | 'primerHabil' | 'primerLunes' | 'ultimoViernes' }
```

#### Patrón C · cada N meses con anclaje

Bimestral · trimestral · semestral · etc. Lo crítico es saber **a partir de qué mes empieza la serie**.

**Ejemplo** · gas natural bimestral empezando en febrero → cargos en feb · abr · jun · ago · oct · dic

**Ejemplo** · cuota colegio cada 2 meses empezando septiembre → cargos en sep · nov · ene · mar · may

```typescript
{ tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: 2, dia: 5 }
```

#### Patrón D · trimestral fiscal

Anclajes naturales en abril · julio · octubre · enero (los trimestres de Hacienda · pago entre el día 1 y el 22 del mes siguiente al cierre del trimestre).

**Ejemplos** · M303 IVA · M130 IRPF pago fraccionado · cuota RETA

```typescript
{ tipo: 'trimestralFiscal', diaPago: 22 }
// Genera eventos en 22 ene · 22 abr · 22 jul · 22 oct
```

Este patrón vive en Fiscal · no en Personal. Se incluye aquí porque Personal lo VE como salidas previstas en Tesorería.

#### Patrón E · anual con N pagos en meses concretos

Pagos puntuales en meses específicos del año. El más típico es el IBI con dos pagos.

**Ejemplos** · IBI 500 € · 250 € en junio + 250 € en noviembre · seguro hogar 380 €/año cobrado en abril · seguro coche 600 €/año cobrado en septiembre

```typescript
{ tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 5 }
// Si importe diferenciado por pago · sección 2.2
```

#### Patrón F · pagas extra (especial nómina)

Las pagas extra son eventos adicionales sobre la mensualidad ordinaria · típicamente en junio y diciembre (algunas empresas en julio · septiembre).

**Ejemplos** · paga extra Orange junio · paga extra diciembre · 14 pagas

```typescript
{ tipo: 'pagasExtra', mesesExtra: [6, 12], referencia: 'ultimoHabil' }
```

#### Patrón G · variable / bonus (especial nómina)

Cobros vinculados a desempeño · por trimestre o anuales. Se proyectan al **objetivo íntegro al 100%** (decisión G-02) · cuando llega el cobro real entrará por encima o por debajo y se reconcilia.

**Ejemplos** · variable Q4 cobrado en marzo · bonus anual cobrado en enero

```typescript
{ tipo: 'variablePorMes', mesesPago: [3], importeObjetivoAnual: 12000 }
// Sin factor de probabilidad · se proyecta el objetivo íntegro
// La realidad ajusta cuando llega el cobro y se reconcilia
```

#### Patrón H · puntual / no recurrente

Un evento aislado · no se repite. No genera eventos futuros · solo el del día concreto.

**Ejemplos** · regalo de cumpleaños · venta de un mueble · devolución IRPF de campaña

```typescript
{ tipo: 'puntual', fecha: '2026-06-30', importe: -250 }
```

### 2.2 Importe por evento

El importe asociado al patrón puede ser:

**Fijo** · siempre el mismo en cada evento. Ejemplo · alquiler 1.350 €/mes.

**Variable** · oscila pero el usuario solo da una estimación media. Ejemplo · ocio · 200 €/mes pero algunos meses 100 € y otros 350 €. ATLAS proyecta con la media y reconcilia contra el real.

**Diferenciado por mes** · un valor distinto por cada mes del año. Caso típico · luz · gas · agua que tienen estacionalidad fuerte.

```typescript
importe: {
  modo: 'diferenciadoPorMes',
  importesPorMes: [138, 122, 92, 87, 74, 71, 78, 80, 88, 95, 110, 124]
  // [enero, febrero, ..., diciembre]
}
```

**Pagos diferenciados (patrón E)** · cuando el patrón es "anual N pagos" y cada pago tiene importe distinto. IBI suele ser 50/50 pero algunos ayuntamientos lo dividen distinto.

```typescript
importe: {
  modo: 'porPago',
  importesPorPago: { 6: 250, 11: 250 }
}
```

**Regla** · ATLAS NUNCA prorratea ficticiamente. Si el IBI son 500 € en junio y noviembre · NO aparece como 41,67 €/mes. Aparece 0 € en mayo y 250 € en junio. Esto es lo que permite que la previsión de tesorería sea fiable.

### 2.3 Patrón de variación · cómo evoluciona el importe

Los importes crecen o cambian con el tiempo. ATLAS modela cuatro patrones de variación.

**Sin variación** · siempre igual. La mayoría de suscripciones digitales hasta que la empresa avisa de subida.

**IPC anual** · revisión cada año en mes concreto · sube por IPC oficial. Ejemplo · alquiler de vivienda con cláusula IPC · revisión cada 1 de junio (aniversario contrato).

```typescript
variacion: { tipo: 'ipcAnual', mesRevision: 6, ultimoIpcAplicado: 0.034 }
```

**Aniversario contrato** · cada año en aniversario · % manual o atado a IPC. Típico en seguros.

**Manual** · el usuario actualiza cuando le llega notificación. ATLAS no proyecta subidas.

---

## 3 · Compromiso recurrente · entidad universal

Store nuevo `compromisosRecurrentes`. Es el catálogo más rico del módulo Personal · porque cubre suministros · suscripciones · seguros · cuotas · alquiler vivienda y otros.

### 3.1 Schema TypeScript completo

```typescript
interface CompromisoRecurrente {
  id: string;
  
  // ─── Ámbito · personal o inmueble (decisión G-01) ───
  ambito: 'personal' | 'inmueble';        // 'personal' = hogar · 'inmueble' = inversión
  inmuebleId?: string;                    // requerido si ambito='inmueble'
  
  // ─── Identificación ───
  alias: string;                          // "Iberdrola luz · vivienda habitual"
  tipo: TipoCompromiso;
  subtipo?: string;                       // 'luz' | 'gas' | 'agua' | 'internet' | 'movil'
  
  proveedor: {
    nombre: string;                       // "Iberdrola Clientes S.A."
    nif?: string;                         // "A95758389"
    referencia?: string;                  // CUPS · ID póliza · número cliente
  };
  
  // ─── Patrón de calendario ───
  patron: PatronRecurrente;               // ver sección 2.1
  
  // ─── Importe ───
  importe: ImporteEvento;                 // ver sección 2.2
  
  // ─── Variación ───
  variacion?: PatronVariacion;            // ver sección 2.3
  
  // ─── Vinculación operativa ───
  cuentaCargo: string;                    // accountId destino del cargo
  conceptoBancario: string;               // texto que aparece en extracto · "IBERDROLA CLIENTES SA"
  metodoPago: 'domiciliacion' | 'transferencia' | 'tarjeta' | 'efectivo';
  
  // ─── Categorización ───
  categoria: CategoriaGasto;              // ver sección 4 · ej. 'vivienda.suministros.luz'
  bolsaPresupuesto: 'necesidades' | 'deseos' | 'ahorroInversion' | 'obligaciones';
  responsable: 'titular' | 'pareja' | 'hogarCompartido';
  porcentajeTitular?: number;             // 0-100 · si hogar compartido y % no es 50/50
  
  // ─── Vigencia ───
  fechaInicio: string;                    // ISO date
  fechaFin?: string;                      // null si indefinido
  estado: 'activo' | 'pausado' | 'baja';
  motivoBaja?: string;
  
  // ─── Origen · si fue derivado de otra entidad ───
  derivadoDe?: {
    fuente: 'viviendaHabitual' | 'manual' | 'importeCSV' | 'opexRule';
    refId?: string;
    bloqueado?: boolean;                  // si true · no se puede editar aquí · solo desde origen
  };
  
  // ─── Auditoría ───
  createdAt: string;
  updatedAt: string;
  notas?: string;
}

type TipoCompromiso = 
  | 'suministro'              // luz · gas · agua · internet · móvil
  | 'suscripcion'             // streaming · prensa · software
  | 'seguro'                  // hogar (NO vivienda habitual) · vida · salud · coche · otros
  | 'cuota'                   // gimnasio · colegio profesional · ONG · membresía
  | 'comunidad'               // SOLO si NO es vivienda habitual ni inmueble de inversión (raro)
  | 'impuesto'                // SOLO si NO es vivienda habitual ni inmueble de inversión (raro)
  | 'otros';
```

**NO existen como tipos de compromiso** · y por tanto NO se dan de alta como compromiso recurrente:

- **Cuota hipoteca vivienda habitual** → derivado automático de `viviendaHabitual.tipo='propietarioConHipoteca'` + cuadro de amortización del préstamo en `prestamos` (Financiación). El importe se actualiza solo cuando cambia la cuota (revisión Euribor · amortización extra).
- **Renta alquiler vivienda habitual** → derivado automático de `viviendaHabitual.tipo='inquilino'` + datos del contrato en la ficha vivienda. Es actualizable por IPC en aniversario.
- **IBI vivienda habitual** → derivado automático de `viviendaHabitual.tipo='propietarioSinHipoteca' | 'propietarioConHipoteca'`.
- **Comunidad vivienda habitual** → derivado automático cuando aplica.
- **Seguro hogar vivienda habitual** → derivado automático de la ficha vivienda.

Los gastos de inmuebles de **inversión** (no vivienda habitual) tampoco viven aquí · viven en `gastosInmueble` (módulo Inmuebles) y se generan desde `opexRules` (sección 1.2).

### 3.2 Generación automática de eventos

A partir de un compromiso · ATLAS genera N eventos en `treasuryEvents` proyectados hasta 24 meses adelante.

```typescript
function generarEventosDesdeCompromiso(
  compromiso: CompromisoRecurrente,
  hasta: Date
): TreasuryEvent[] {
  // 1. Calcular las fechas que toca según patron
  const fechas = expandirPatron(compromiso.patron, compromiso.fechaInicio, hasta);
  
  // 2. Para cada fecha · calcular importe (puede variar por mes)
  return fechas.map(fecha => ({
    id: `compromiso:${compromiso.id}:${fecha.toISOString()}`,
    fecha: fecha.toISOString(),
    importe: -calcularImporte(compromiso.importe, fecha),
    cuentaId: compromiso.cuentaCargo,
    origen: { tipo: 'compromisoRecurrente', refId: compromiso.id },
    categoria: compromiso.categoria,
    bolsaPresupuesto: compromiso.bolsaPresupuesto,
    estado: 'previsto',
    conceptoEsperado: compromiso.conceptoBancario,
    createdAt: new Date().toISOString()
  }));
}
```

### 3.3 Estados del evento y conciliación

Cada evento en `treasuryEvents` pasa por tres estados según la realidad bancaria.

**previsto** · proyección teórica · aún no ha llegado el cargo bancario.

**confirmado** · llegó un movimiento real bancario que cuadra con el evento (concepto bancario · fecha ±3 días · importe ±5%). El evento queda emparejado con el movimiento.

**desviado** · llegó un movimiento parecido pero con discrepancia significativa (importe muy distinto · fecha muy distinta). ATLAS pide confirmación · el usuario decide si conciliar y actualizar el compromiso · o tratar como otro movimiento.

```typescript
interface TreasuryEvent {
  id: string;
  fecha: string;
  importe: number;                        // negativo si pago · positivo si cobro
  cuentaId: string;
  origen: OrigenEvento;
  categoria: CategoriaGasto;
  bolsaPresupuesto: string;
  estado: 'previsto' | 'confirmado' | 'desviado';
  conceptoEsperado: string;
  movimientoVinculado?: string;           // ID en `movements` · cuando confirmado
  desviaciones?: {
    importeReal?: number;
    fechaReal?: string;
    motivoDesviacion: 'importe' | 'fecha' | 'concepto' | 'multiple';
  };
  createdAt: string;
  updatedAt: string;
}
```

---

## 4 · Categorías de gasto del hogar

Catorce categorías base + obligaciones aparte. Mapeadas a las tres bolsas del 50/30/20 del presupuesto.

### 4.1 Necesidades · objetivo 50%

| Código | Categoría | Subcategorías | Notas |
|---|---|---|---|
| `vivienda.alquiler` | Alquiler vivienda habitual | — | Solo si inquilino |
| `vivienda.hipoteca` | Cuota hipoteca vivienda habitual | capital · interés | Solo si propietario · vinculada con Financiación |
| `vivienda.suministros` | Suministros | luz · gas · agua · internet · móvil | Cada subtipo es un compromiso aparte |
| `vivienda.comunidad` | Comunidad de propietarios | mensual · derrama | Solo si propietario en régimen comunidad |
| `vivienda.ibi` | IBI vivienda habitual | — | Solo si propietario |
| `vivienda.seguros` | Seguros vivienda | hogar · vida hipoteca | Si hipoteca · seguro vida + hogar suelen ser obligatorios |
| `alimentacion` | Alimentación | supermercado · panadería · mercado | Categoría flexible · llegará casi siempre por extracto |
| `transporte` | Transporte esencial | combustible · transporte público · seguro coche · ITV · taller | Mezcla compromisos (seguro coche anual) y movimientos (combustible) |
| `salud` | Salud | mutua · farmacia · dentista · óptica | Mutua = compromiso · resto = movimientos |
| `educacion` | Educación | colegio · universidad · academia | Suelen ser cuotas mensuales |

### 4.2 Deseos · objetivo 30%

| Código | Categoría | Subcategorías | Notas |
|---|---|---|---|
| `ocio` | Ocio y restaurantes | restaurantes · cines · bares · eventos | Mayoría movimientos categorizados |
| `viajes` | Viajes | vuelos · hoteles · escapadas | Pico estacional · julio · diciembre |
| `suscripciones` | Suscripciones digitales | streaming · prensa · gimnasio · software | Compromisos típicos |
| `personal` | Ropa y cuidado personal | ropa · peluquería · cosmética | Mayoría movimientos |
| `regalos` | Regalos | cumpleaños · navidad · bodas | Picos noviembre-diciembre |
| `tecnologia` | Tecnología y electrónica | dispositivos · accesorios | Compras puntuales · CAPEX hogar |

### 4.3 Ahorro+inversión · objetivo 20%

No son "gastos" estrictamente · son aportaciones a productos. Pero salen de caja igual y se contabilizan como destino del 20% del presupuesto.

| Código | Categoría | Notas |
|---|---|---|
| `ahorro.aporteFondo` | Aporte fondo de inversión | Indexa Capital · MyInvestor Roboadvisor · etc. |
| `ahorro.aportePension` | Aporte plan pensiones | Reduce base IRPF · tope 1.500 € individual + 8.500 € empresa |
| `ahorro.amortizacionExtra` | Amortización extraordinaria hipoteca | Reduce capital · puede liberar cuota |
| `ahorro.cuentaTarget` | Aporte cuenta inversión target | Por ejemplo · ahorrar entrada próximo inmueble |
| `ahorro.cajaLiquida` | Acumulación en cuenta líquida sin destinar | Dinero que se queda en cuenta nominal sin invertir · sigue siendo ahorro válido · suma al 20% del presupuesto |

Importante · los buckets nombrados (cuál es el fondo · cuál es la cuenta target específica) viven en **Mi Plan > Fondos de ahorro** · no en Personal. Personal solo conoce el agregado por categoría.

**Definición de "ahorro válido" para el 20%** · el ahorro NO es solo lo que se invierte en productos. También cuenta como ahorro el dinero que se queda en una cuenta nominal sin destinarlo · porque sigue sin estar consumido. La línea entre ahorro productivo y caja líquida la cruza el usuario cuando decide invertirlo · pero el cálculo del cumplimiento del 20% suma ambos.

### 4.4 Obligaciones fiscales · NO entran en 50/30/20

Salen de caja pero NO se contabilizan en el presupuesto · porque son obligaciones estructurales · no consumo ni ahorro decidido.

| Código | Categoría | Origen |
|---|---|---|
| `obligaciones.irpfPagar` | IRPF resultado a pagar | Fiscal · campaña anual abril-junio |
| `obligaciones.irpfFraccionamiento` | IRPF segundo plazo (40% noviembre) | Fiscal · solo si fraccionado |
| `obligaciones.m130` | Modelo 130 trimestral | Fiscal · autónomos |
| `obligaciones.reta` | Cuota RETA | Fiscal · autónomos |
| `obligaciones.cuotasProf` | Cuotas profesionales | Colegios · sindicatos |
| `obligaciones.multas` | Sanciones | Tráfico · administrativas |
| `obligaciones.donaciones` | Donaciones | ONG · partidos |

**Regla** · estas categorías aparecen en Tesorería como salidas previstas · pero el dashboard de cumplimiento de presupuesto las EXCLUYE del cálculo. El presupuesto mide consumo y ahorro voluntario · no obligaciones fiscales.

---

## 5 · Modelo nómina · detalle real

El store `nominas` actual está infrasizado. El schema siguiente cubre una nómina española real basada en las nóminas reales de Jose en Orange España (datos 2025).

### 5.1 Schema TypeScript completo

```typescript
interface Nomina {
  id: string;
  titular: 'titular' | 'pareja';
  
  // ─── Empresa ───
  empresa: {
    nombre: string;                       // "Orange España S.A.U."
    cif: string;                          // "A82009812"
    centroTrabajo?: string;               // "La Finca Ed.05"
    centroCoste?: string;                 // "MP1000"
  };
  
  // ─── Contrato ───
  contrato: {
    tipo: 'indefinidoCompleta' | 'indefinidoParcial' | 'temporal' | 'practicas' | 'formacion';
    fechaAlta: string;                    // antigüedad · ISO date
    grupoCotizacion: string;              // "01"
    grupoProfesional?: string;            // "F.ACUERD"
    posicion?: string;                    // "Manager"
    area?: string;                        // "Operations"
    horasJornada: number;                 // 160 · 168 · 40
  };
  
  // ─── Estructura salarial base ───
  salarioBruto: {
    bruto: number;                        // 131.040 anual
    numeroPagas: 12 | 14 | 15;            // 14 = 12 mensuales + 2 extras
    mesesExtra?: number[];                // [6, 12] · paga junio + diciembre
    importePorPagaExtra?: number;         // 6.474,72 (en bruto)
  };
  
  // ─── Variables y bonus ───
  variable?: {
    objetivoAnual: number;                // 12.000 bruto · se proyecta al 100% (decisión G-02)
    pagaderoEnMeses: number[];            // [3] · variable Q4 anterior cobrado en marzo
    // Nota · NO hay factorRealizacion · se proyecta el objetivo íntegro
    // Cuando llegue el cobro real · entrará por encima o por debajo y se reconcilia
  };
  bonus?: {
    importeAnual: number;                 // se proyecta al 100% igual que variable
    pagaderoEnMes: number;                // 1 = enero
  };
  
  // ─── Especies y ayudas (no entran en líquido pero sí en base IRPF · salvo exentas) ───
  especies: {
    seguroVida?: number;                  // 17,91 mensual · no exento
    seguroMedicoExento?: number;          // 83,34 mensual · exento art. 42.3.c LIRPF
    seguroMedicoNoExento?: number;        // 5,78 mensual
    ayudaComida?: number;                 // 50 mensual · exento hasta 11 €/día laboral
    ayudaTransporte?: number;             // 60 mensual
    traficoTelefonico?: number;           // 140,20 mensual
    planPensionesEmpresa?: number;        // 155,18 mensual · aporte EMPRESA · NO reduce base IRPF del trabajador
    ayudasOftalmologia?: { meses: number[], importe: number };
    otras?: { concepto: string, importe: number, exenta: boolean }[];
  };
  
  // ─── Aportaciones del trabajador (descuento neto · cuentan como gasto deducible) ───
  aportaciones: {
    planPensionesPropio?: {
      importeMensual: number;             // 116,39 · descuento mensual de la nómina
      productoId: string;                 // ID del producto plan pensiones · ver G-07
      // Cuando se confirma el evento de cobro de nómina en Tesorería · ATLAS genera
      // automáticamente un evento de aportación a este producto. Reduce base IRPF.
    };
    cuotaSolidaridad?: number;            // 5,47 mensual · sueldos altos · base > 4.909,50 €/mes · usuario lo rellena al alta nómina (decisión G-04)
    otras?: { concepto: string, importe: number, productoId?: string }[];
  };
  
  // ─── IRPF ───
  irpf: {
    tipoRetencion: number;                // 32.4 · porcentaje real aplicado
    retencionAnualEstimada: number;       // 47.913 €/año
    retencionMensualMedia: number;        // 4.000 € aprox
    irpfAcumuladoEjercicio?: number;      // viene del último recibo · útil para validar
  };
  
  // ─── Cotización Seguridad Social ───
  ss: {
    porcentajeTrabajador: number;         // 6.48 (4.83 contigencias + 1.55 desempleo + 0.10 formación)
    cuotaMensual: number;                 // 318,14 €
    baseCotizacion: number;               // 4.909,50 (topada al máximo)
  };
  
  // ─── Cuenta destino ───
  cuentaCobro: {
    accountId: string;                    // ref a `accounts`
    iban: string;                         // ES61 0049 0052 6322 1041 2715
    diaAbono: number | 'ultimoHabil';     // 30 · o "ultimoHabil"
    conceptoBancario: string;             // "NOMINA ORANGE ESPAÑA SAU"
  };
  
  // ─── Vigencia ───
  vigenciaDesde: string;                  // ISO date
  vigenciaHasta?: string;                 // null si actual
  estado: 'activa' | 'cesada' | 'baja';
  
  // ─── Auditoría ───
  createdAt: string;
  updatedAt: string;
  ultimaNominaImportada?: {
    mes: string;
    pdfDocumentoId: string;
  };
}
```

### 5.2 Cómo se proyecta a eventos en Tesorería

A partir de UNA nómina · ATLAS genera múltiples eventos al año. Para Orange España con 14 pagas + variable + bonus:

| Evento | Cantidad/año | Mes | Importe estimado | Patrón |
|---|---|---|---|---|
| Nómina mensual | 12 | todos | ~7.500 € líquido (mes ordinario) | mensual día relativo "ultimoHabil" |
| Paga extra junio | 1 | junio | ~8.092 € líquido | mes 6 · ultimoHabil |
| Paga extra diciembre | 1 | diciembre | ~8.092 € líquido | mes 12 · ultimoHabil |
| Variable Q4 | 1 | marzo | importe íntegro al 100% (decisión G-02) | mes 3 |
| Bonus anual | 1 (si aplica) | enero | importe íntegro al 100% | mes 1 |

**Total · 15-17 eventos anuales por nómina activa.**

**Variable y bonus al 100%** (decisión G-02) · ATLAS proyecta el objetivo íntegro · sin descuento por probabilidad de realización. Cuando llegue el cobro real · entrará por encima o por debajo y la conciliación lo refleja como desviación. Esto evita falsa precisión y deja al usuario ver la "foto plena" de su nómina si todo se cumple.

**Aportación al plan de pensiones del trabajador** (decisión G-07) · cuando un evento de cobro de nómina pasa a estado **confirmado** (porque llega el extracto bancario y el usuario concilia) · ATLAS genera automáticamente un evento adicional:

```typescript
// Pseudocódigo · al confirmar evento de nómina cobrada
function onNominaConfirmada(eventoNomina: TreasuryEvent, nomina: Nomina) {
  if (nomina.aportaciones.planPensionesPropio) {
    const aportacion = nomina.aportaciones.planPensionesPropio;
    
    // 1. Crea movimiento de aportación al producto plan pensiones
    crearAportacionProducto({
      productoId: aportacion.productoId,
      fecha: eventoNomina.fecha,
      importe: aportacion.importeMensual,
      origen: { tipo: 'nominaConfirmada', refId: eventoNomina.id }
    });
    
    // 2. Suma a aportaciones acumuladas del año (para reducción IRPF)
    sumarAportacionAnualPP(aportacion.productoId, aportacion.importeMensual);
  }
}
```

Implicaciones:
- El plan de pensiones del trabajador es un **producto identificado en Inversiones** (o store equivalente). Al dar de alta la nómina · el usuario debe vincularlo · si no existe · puede crearlo en el alta.
- Las aportaciones acumuladas del año reducen base IRPF en Fiscal · con tope 1.500 € individual.
- Las especies (no salen del bolsillo · ver decisión G-03) NO generan eventos · solo cuentan en Fiscal.

### 5.3 Caso real Jose · validación

Tu nómina junio 2025 (PDF subido):

- Salario base · 6.474,71 € bruto
- Paga extra junio · 6.474,72 € bruto
- Ayuda oftalmología · 90 € bruto
- IRPF retenido · 4.502,07 € (34,78%)
- SS trabajador · 318,14 €
- Plan pensiones trabajador · 116,39 €
- Cuota solidaridad · 5,56 €
- Líquido a recibir · 8.092,27 €

Tu nómina agosto 2025 (PDF subido):

- Salario base · 6.474,71 € bruto
- IRPF retenido · 2.219,53 € (34,28%)
- SS trabajador · 318,14 €
- Plan pensiones trabajador · 116,39 €
- Cuota solidaridad · 5,47 €
- Líquido a recibir · 3.815,18 €

ATLAS necesita capturar estos **15 conceptos diferentes** para reproducir tu nómina y proyectar futuras. El schema actual de `nominas` no captura ni la mitad. La ampliación es necesaria para dogfooding · si no funciona para ti como caso real · no funciona para nadie.

---

## 6 · Vivienda habitual · derivaciones automáticas

### 6.1 Concepto · ficha única · compromisos derivados

La vivienda habitual del hogar (donde vive el usuario) es UNA ficha. A partir de esa ficha · ATLAS genera automáticamente los compromisos recurrentes derivados (alquiler · hipoteca · IBI · comunidad · seguros).

**Regla absoluta** · NUNCA se da de alta el alquiler · cuota hipoteca · IBI · comunidad o seguro hogar de la vivienda habitual como compromiso recurrente independiente. Se gestiona desde la ficha vivienda y se deriva automáticamente.

Hay tres situaciones · cada una genera distintos compromisos derivados.

### 6.2 Caso A · inquilino

```typescript
interface ViviendaHabitual_Inquilino {
  tipo: 'inquilino';
  
  direccion: {
    calle: string;
    municipio: string;
    cp: string;
    referenciaCatastral?: string;
  };
  
  contrato: {
    arrendador: { nombre: string, nif?: string };
    fechaFirma: string;
    vigenciaDesde: string;
    vigenciaHasta: string;                // 5 años LAU
    rentaMensual: number;                 // 1.350
    diaCobro: number;                     // 5
    fianza: number;
    garantiasAdicionales?: number;
    revisionIPC: { aplica: boolean, mesRevision?: number };
    gastosIncluidos: string[];            // ['comunidad'] · marca qué hay dentro de la renta
  };
  
  cuentaCargo: string;                    // mi cuenta de la que sale
  conceptoBancarioEsperado: string;
}
```

**Genera automáticamente:**

- **N eventos mensuales** en `treasuryEvents` · uno por mes hasta el fin del contrato · día 5 · importe = renta · cuenta cargo · `origen.tipo='viviendaHabitual'`. NO se crea ningún `compromisoRecurrente` intermedio · el alquiler de vivienda habitual es excepción al modelo · va directo de ficha vivienda a Tesorería.
- Variación · si revisionIPC.aplica · revisión anual aniversario contrato (los eventos posteriores a la fecha de revisión se actualizan al nuevo importe)

**NO genera** suministros · esos son compromisos aparte si están a tu nombre. Si el contrato incluye agua y comunidad · esos NO van como compromiso (van implícitos en la renta).

### 6.3 Caso B · propietario sin hipoteca

```typescript
interface ViviendaHabitual_Propietario {
  tipo: 'propietarioSinHipoteca';
  
  direccion: { /* igual */ };
  catastro: {
    referenciaCatastral: string;
    valorCatastral: number;
    superficie: number;
    porcentajeTitularidad: number;        // 100 si privativa · 50 si gananciales
  };
  
  adquisicion: {
    fecha: string;
    precio: number;
    gastosAdquisicion: number;
    mejorasAcumuladas: { fecha: string, descripcion: string, importe: number }[];
  };
  
  comunidad?: {
    importe: number;                      // 95 mensual
    diaCargo: number;                     // 5
  };
  
  ibi: {
    importeAnual: number;                 // 612
    mesesPago: number[];                  // [6, 11] · 50/50
    importesPorPago?: { [mes: number]: number };  // si distinto al 50/50
    diaPago: number;                      // 5
  };
  
  seguros: {
    hogar: { importeAnual: number, mesPago: number, diaPago: number };
    vida?: { importeAnual: number, mesPago: number, diaPago: number };
  };
  
  cuentaCargo: string;
}
```

**Genera automáticamente eventos directos en `treasuryEvents`:**

- N eventos mensuales `comunidad` día Y (uno por mes)
- N eventos `vivienda.ibi` en los meses concretos del año (típicamente 6 y 11) con sus importes específicos
- 1 evento `vivienda.seguros` por seguro · al año · en el mes de cobro

Todos con `origen.tipo='viviendaHabitual'`. **NO se crean compromisos recurrentes intermedios** · porque editar la ficha vivienda actualiza directamente los eventos futuros.

**NO genera** suministros automáticos · van como compromisos aparte si están a tu nombre.

### 6.4 Caso C · propietario con hipoteca

Caso B + integración con módulo Financiación.

```typescript
interface ViviendaHabitual_Hipoteca {
  tipo: 'propietarioConHipoteca';
  
  // Todos los campos del caso B
  
  hipoteca: {
    prestamoId: string;                   // ref a `prestamos` en Financiación
    // El resto de datos (capital pendiente · cuota · etc) se LEEN del préstamo · no se duplican aquí
  };
  
  beneficioFiscal: {
    aplica: boolean;                      // solo hipotecas anteriores a 31/12/2012
    porcentajeDeduccion?: number;         // 15% estatal · variable autonómico
  };
}
```

**Genera automáticamente eventos directos en `treasuryEvents`:**

- N eventos mensuales `vivienda.hipoteca` con el importe de cuota actual del cuadro de amortización del préstamo en Financiación
- Cuando se modifica el cuadro de amortización (revisión Euribor · amortización extraordinaria) · los eventos posteriores se recalculan automáticamente con el nuevo importe
- Cuando termina el préstamo · los eventos posteriores se eliminan
- Cada evento tiene `origen.tipo='viviendaHabitual'` y `origen.prestamoId=...` para trazabilidad

Plus los eventos del Caso B (comunidad · IBI · seguros).

### 6.5 Regla absoluta de no duplicación

CC tiene que validar · cuando el usuario va a crear un compromiso recurrente · si el alias propuesto coincide con un compromiso ya derivado de viviendaHabitual · ATLAS bloquea la creación y redirige a la ficha vivienda.

Como `alquilerVivienda` y `hipoteca` ya **no existen como tipos de compromiso** (sección 3.1) · el usuario directamente NO PUEDE intentar crearlos como tales. La única vía es la ficha vivienda habitual.

Para tipos que sí existen (suministros · seguros · etc.) · ATLAS valida coincidencia por proveedor + concepto bancario para evitar duplicados con derivados:

```typescript
function puedeCrearCompromiso(nuevo: Partial<CompromisoRecurrente>): ValidationResult {
  // El propio TypeScript ya bloquea tipos eliminados (alquilerVivienda · hipoteca)
  
  // Para suministros · seguros · etc. · validar que no choquen con derivados
  if (existeViviendaHabitual()) {
    const vh = getViviendaHabitual();
    
    if (nuevo.tipo === 'seguro' && nuevo.subtipo === 'hogar' && vh.seguros?.hogar) {
      return { ok: false, motivo: 'Seguro hogar de vivienda habitual gestionado en ficha vivienda' };
    }
    
    if (nuevo.tipo === 'comunidad' && vh.tipo !== 'inquilino' && vh.comunidad) {
      return { ok: false, motivo: 'Comunidad de vivienda habitual gestionada en ficha vivienda' };
    }
    
    if (nuevo.tipo === 'impuesto' && esIBI(nuevo) && vh.tipo !== 'inquilino' && vh.ibi) {
      return { ok: false, motivo: 'IBI de vivienda habitual gestionado en ficha vivienda' };
    }
  }
  
  // Validar que no choque con compromisos derivados de inmuebles de inversión
  if (esGastoInmuebleInversion(nuevo)) {
    return { ok: false, motivo: 'Gasto de inmueble de inversión · gestionar en módulo Inmuebles' };
  }
  
  return { ok: true };
}
```

---

## 7 · Reglas de oro · catorce axiomas

CC asume estas reglas como inviolables. Cualquier diseño que las contradiga es bug · no feature.

1. **Cada compromiso se da de alta UNA VEZ · genera N eventos automáticamente.** El usuario nunca introduce eventos · solo catálogos.

2. **Vivienda habitual genera automáticamente sus compromisos derivados.** Hipoteca · alquiler · IBI · comunidad · seguro hogar de la vivienda donde vive el hogar NO son tipos de compromiso recurrente · no se dan de alta como tales. Salen de la ficha vivienda habitual + (en caso de hipoteca) cuadro de amortización del préstamo en Financiación.

3. **Vivienda de inversión NO entra en Personal.** Vive en Inmuebles · sus gastos van a `gastosInmueble`.

4. **El calendario es REAL · no plano.** IBI no es 41,67 €/mes · es 250 € en junio + 250 € en noviembre. Gas no es bimestral abstracto · es bimestral empezando en febrero.

5. **El importe puede variar por mes.** Luz 138 € en enero · 71 € en junio. ATLAS proyecta el real · no la media falsa.

6. **El presupuesto 50/30/20 mide cumplimiento del % objetivo.** Los buckets de ahorro nombrados viven en Mi Plan · no en Personal.

7. **Nómina española real tiene 12-15 conceptos.** La ficha tiene que capturarlos todos · no solo bruto/neto/IRPF.

8. **Pagas extra · variable · bonus se proyectan en el mes que tocan.** No prorrateadas en el mes ordinario. Variable y bonus al 100% del objetivo · sin descuento por probabilidad (decisión G-02).

9. **Tesorería es la fuente única de verdad de eventos.** Personal · Inmuebles · Financiación · Fiscal aportan compromisos · Tesorería los proyecta y los concilia con bancos.

10. **Obligaciones fiscales (M303 · M130 · IRPF anual · RETA) viven en Fiscal.** Solo aparecen en Tesorería como salidas previstas. NO entran en el presupuesto 50/30/20.

11. **El motor de proyección de Mi Plan lee de Tesorería · no recalcula.** Ningún módulo duplica el cálculo.

12. **Rentas NUNCA van a `gastosInmueble`** (regla heredada del proyecto). Rentas a `contracts` y `rentaMensual` · gastos del inmueble a `gastosInmueble`.

13. **Confirmar una nómina en Tesorería genera aportación al plan de pensiones del trabajador.** Cuando un evento de cobro de nómina pasa a confirmado · ATLAS aporta automáticamente el descuento mensual de plan pensiones (`aportaciones.planPensionesPropio.importeMensual`) al producto plan de pensiones identificado por `productoId`. Suma a aportaciones acumuladas anuales · reduce base IRPF · aparece en historial del producto en Inversiones (decisión G-07).

14. **Las especies de la nómina (seguro vida · médico · ayuda comida · etc.) NO generan eventos en Tesorería.** No salen del bolsillo del trabajador. Sí se contabilizan en Fiscal para la base IRPF (decisión G-03).

---

## 8 · Decisiones cerradas · cierre de gaps

Las decisiones tomadas tras revisión con Jose el 25 abril 2026.

**G-01 · `opexRules` y `compromisosRecurrentes` · UNIFICAR · cerrado**
Schema único con discriminador `ambito: 'personal' | 'inmueble'` y `inmuebleId?` opcional. Aplicado en sección 1.2 y 3.1. Migración · los registros existentes de `opexRules` se mueven al store unificado conservando `ambito='inmueble'` y su `inmuebleId`.

**G-02 · proyección de variable y bonus · AL 100% · cerrado**
Variable y bonus se proyectan al **objetivo íntegro** sin factor de realización. Cuando llegue el cobro real · entrará por encima o por debajo y la conciliación lo refleja como desviación. Aplicado en sección 5.1 (schema sin `factorRealizacion`) y 5.2 (proyección).

**G-03 · especies en Tesorería · NO · cerrado**
Las especies (seguro vida en nómina · ayuda comida · gasolina · etc.) NO generan eventos en Tesorería porque no salen del bolsillo del trabajador. Sí se contabilizan en Fiscal para la base IRPF del trabajador. Aplicado en sección 5.2.

**G-04 · cuota solidaridad · usuario la rellena al alta · cerrado**
La cuota solidaridad NO la calcula el motor IRPF · la introduce el usuario en el alta de la nómina (extraída de su recibo). Esto evita errores de modelo. Aplicado en sección 5.1 con el comentario en el campo del schema.

**G-05 · pareja co-titular y nóminas · DOS REGISTROS · cerrado**
Si la pareja tiene su propia nómina · son dos registros en `nominas` · cada uno con `titular: 'titular' | 'pareja'`. Aplicado en sección 5.1.

**G-06 · pagas extra prorrateadas · cubierto por `numeroPagas: 12 | 14 | 15` · cerrado**
El campo cubre los tres casos comunes. En el mockup posterior · cuando el usuario seleccione 12 pagas · ATLAS muestra explícitamente "el bruto anual es el mismo · solo cambia el reparto · no hay pagas extra como evento separado". Para evitar confusión.

**G-07 · plan pensiones trabajador · APORTACIÓN ACTIVA AL CONFIRMAR NÓMINA · cerrado**
Cuando un evento de cobro de nómina pasa a estado confirmado en Tesorería (porque llega el extracto bancario) · ATLAS genera automáticamente una **aportación al producto plan de pensiones del trabajador**. El plan de pensiones es un producto identificado en Inversiones · vinculado en el alta de la nómina mediante `productoId`. Esta aportación · suma a aportaciones acumuladas del año · reduce base IRPF · aparece en el historial del producto. Aplicado en sección 5.1 (schema con `productoId`) y 5.2 (función `onNominaConfirmada`).

**G-08 · CSB43 importer y conciliación · LEARNING RULES · cerrado**
Cada vez que el usuario confirma un emparejamiento entre movimiento bancario y compromiso/evento · se crea o refuerza una regla en `movementLearningRules`. Próximas conciliaciones automáticas usan esas reglas. Cuando hay duda · pregunta al usuario.

**G-09 · arquitectura datos personales · cerrado**
`personalData` para datos demográficos y fiscales · `viviendaHabitual` para los de la vivienda donde vive el hogar · ambos enlazan a `accounts` para cuentas bancarias. Sin solapamiento.

**G-10 · histórico vs futuro de compromisos · cerrado**
El histórico de cada compromiso vive en `treasuryEvents` confirmados (cada cargo es un evento conciliado). El catálogo de compromisos solo guarda el patrón presente. Si el usuario quiere ver "luz mes a mes los últimos 24 meses" · es una consulta sobre `treasuryEvents` filtrada por origen.

---

## 9 · Próximos pasos

Una vez validado este modelo:

1. **CC implementa** stores nuevos (`compromisosRecurrentes` · `viviendaHabitual` ampliado) y schema ampliado de `nominas` y `autonomos`
2. **CC implementa el generador de eventos** · función `generarEventosDesdeCompromiso` y equivalente para nómina
3. **CC implementa el integrador** "ficha vivienda → compromisos derivados" con bloqueo de duplicación
4. **CC implementa el reconciliador** · cuando llega CSV bancario · empareja con eventos previstos · pasa a confirmado o desviado
5. **Mockup Personal v3** se diseña sobre el modelo correcto · resolviendo todos los fallos visuales señalados (gráficos con números legibles · subtítulos correctos · sin doble alta)
6. **Mockup Mi Plan v2** se diseña encima · con la Proyección como columna vertebral · leyendo de los catálogos de Personal · Inmuebles · Financiación · Inversiones y Fiscal

---

**Fin del documento v1**
